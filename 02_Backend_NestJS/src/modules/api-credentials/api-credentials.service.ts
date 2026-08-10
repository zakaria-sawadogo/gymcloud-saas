import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { AuditService } from '../../common/audit/audit.service';
import { TenantContext } from '../../common/middleware/tenant.middleware';
import { SetSalleCredentialDto } from './dto/api-credentials.dto';

/**
 * §14.x — Identifiants marchand Mobile Money par salle (Orange Money
 * en premier, potentiellement Moov/Wave ensuite) — chaque salle a son
 * propre compte marchand, encaisse directement, sans passer par un
 * agrégateur centralisé côté GymCloud. Réservé au propriétaire de la
 * salle concernée (c'est lui qui a signé le contrat avec l'opérateur)
 * et au SUPER_ADMIN (support).
 */
@Injectable()
export class ApiCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
  ) {}

  private async assertCanManage(salleId: string, actor: TenantContext): Promise<void> {
    if (actor.roleCode === 'SUPER_ADMIN') return;
    const salle = await this.prisma.salle.findUnique({ where: { id: salleId }, select: { proprietaireId: true } });
    if (!salle) throw new NotFoundException('Salle introuvable');
    if (actor.roleCode !== 'PROPRIETAIRE' || salle.proprietaireId !== actor.proprietaireId) {
      throw new ForbiddenException(
        'Seul le propriétaire de cette salle (ou le support GymCloud) peut gérer ses identifiants marchand.',
      );
    }
  }

  async setSalleCredential(salleId: string, dto: SetSalleCredentialDto, actor: TenantContext) {
    await this.assertCanManage(salleId, actor);

    const encryptedValue = this.encryption.encrypt(JSON.stringify(dto.credentials));

    // §14.x — un seul identifiant actif par salle+opérateur : on
    // révoque l'ancien (jamais supprimé, pour garder une trace) avant
    // d'en créer un nouveau plutôt qu'un upsert qui écraserait
    // silencieusement l'historique.
    await this.prisma.apiCredential.updateMany({
      where: { provider: dto.provider, scope: 'SALLE', scopeRefId: salleId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const credential = await this.prisma.apiCredential.create({
      data: {
        id: randomUUID(),
        provider: dto.provider,
        scope: 'SALLE',
        scopeRefId: salleId,
        encryptedValue,
      },
    });

    await this.audit.log({
      userId: actor.userId,
      salleId,
      action: 'api_credential.set',
      entityType: 'ApiCredential',
      entityId: credential.id,
      metadata: { provider: dto.provider },
    });

    return { id: credential.id, provider: credential.provider, lastRotatedAt: credential.lastRotatedAt };
  }

  /**
   * §14.x — Statut de configuration, jamais le secret déchiffré —
   * cette route ne doit jamais pouvoir servir à exfiltrer un
   * identifiant marchand, même pour le propriétaire lui-même (une
   * fois saisi, on ne le raffiche plus ; en cas d'oubli, on le
   * remplace, on ne le récupère pas).
   */
  async getSalleCredentialStatus(salleId: string, provider: string, actor: TenantContext) {
    await this.assertCanManage(salleId, actor);
    const credential = await this.prisma.apiCredential.findFirst({
      where: { provider, scope: 'SALLE', scopeRefId: salleId, revokedAt: null },
    });
    return { configured: credential !== null, lastRotatedAt: credential?.lastRotatedAt ?? null };
  }

  async revokeSalleCredential(salleId: string, provider: string, actor: TenantContext) {
    await this.assertCanManage(salleId, actor);
    await this.prisma.apiCredential.updateMany({
      where: { provider, scope: 'SALLE', scopeRefId: salleId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      userId: actor.userId,
      salleId,
      action: 'api_credential.revoke',
      entityType: 'ApiCredential',
      metadata: { provider },
    });
    return { revoked: true };
  }

  /**
   * §14.x — Usage interne uniquement (jamais exposé via un endpoint
   * HTTP) : récupère et déchiffre l'identifiant actif d'une salle
   * pour un opérateur donné, au moment d'appeler l'API réelle du
   * fournisseur Mobile Money. Lève une erreur explicite si rien n'est
   * configuré, plutôt que de laisser l'appel échouer silencieusement
   * plus loin dans la chaîne.
   */
  async getDecryptedCredential(salleId: string, provider: string): Promise<Record<string, string>> {
    const credential = await this.prisma.apiCredential.findFirst({
      where: { provider, scope: 'SALLE', scopeRefId: salleId, revokedAt: null },
    });
    if (!credential) {
      throw new NotFoundException(
        `Aucun identifiant ${provider} configuré pour cette salle — à saisir depuis les paramètres.`,
      );
    }
    return JSON.parse(this.encryption.decrypt(credential.encryptedValue));
  }
}
