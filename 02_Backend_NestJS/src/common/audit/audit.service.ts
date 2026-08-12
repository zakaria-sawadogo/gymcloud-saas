import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../modules/notifications/email.service';

interface AuditEntry {
  userId?: string;
  salleId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Service transverse de journalisation (§13.12 « Journal d'Audit »).
 *
 * Utilisé par tous les modules pour tracer les actions sensibles :
 * création/suspension de salle, modification tarifaire, validation de
 * paiement, etc. — conformément à l'exigence « Toutes les actions
 * critiques doivent être auditées » (§13.22).
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: entry.userId,
        salleId: entry.salleId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata as any,
        ipAddress: entry.ipAddress,
      },
    });
  }

  /**
   * §14.x — Journal d'activité consultable par le propriétaire : les
   * entrées liées à SA salle uniquement (filtre naturel — la plupart
   * des actions plateforme/SaaS n'ont pas de salleId, donc n'apparaissent
   * jamais ici). Filtres optionnels par auteur (utile dès que plusieurs
   * gestionnaires opèrent sur la même salle) et par type d'action.
   * Paginé (50 par page) plutôt qu'une liste illimitée — ce journal
   * grossit vite avec l'usage quotidien.
   */
  async list(
    salleId: string,
    filters: { userId?: string; action?: string; page?: number; since?: Date } = {},
  ) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = 50;
    const where = {
      salleId,
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.since ? { createdAt: { gte: filters.since } } : {}),
    };

    const [entries, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, roleId: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { entries, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * §14.x — Liste des auteurs distincts ayant une entrée pour cette
   * salle — alimente le filtre "par gestionnaire" côté web sans que
   * le propriétaire ait à deviner qui a déjà agi sur sa salle.
   */
  async listDistinctActors(salleId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: { salleId, userId: { not: null } },
      select: { user: { select: { id: true, firstName: true, lastName: true } } },
      distinct: ['userId'],
    });
    type Row = { user: { id: string; firstName: string; lastName: string } | null };
    return (rows as Row[]).map((r) => r.user).filter((u): u is NonNullable<typeof u> => u !== null);
  }

  /**
   * §14.x — Vue globale du journal d'activité, réservée SUPER_ADMIN
   * (support) : toutes les entrées de la plateforme, pas seulement
   * une salle — y compris les actions plateforme/SaaS sans salleId
   * (jamais visibles depuis la vue propriétaire, scopée à une salle).
   * salleId optionnel ici, contrairement à list() : filtre si fourni,
   * sinon montre tout.
   */
  async listGlobal(
    filters: { salleId?: string; userId?: string; action?: string; page?: number; since?: Date } = {},
  ) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = 50;
    const where = {
      ...(filters.salleId ? { salleId: filters.salleId } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.since ? { createdAt: { gte: filters.since } } : {}),
    };

    const [entries, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, roleId: true } },
          salle: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { entries, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * §14.x — Envoi par e-mail des entrées correspondant aux filtres
   * actuels (support) — jusqu'à 500 entrées les plus récentes, au
   * format HTML simple. Volontairement pas de pièce jointe (CSV/PDF) :
   * un tableau HTML direct dans le corps du mail suffit pour un usage
   * support ponctuel, et évite de dépendre du module PDF pour ça.
   */
  async sendByEmail(
    filters: { salleId?: string; userId?: string; action?: string; since?: Date },
    recipientEmail: string,
  ): Promise<boolean> {
    const where = {
      ...(filters.salleId ? { salleId: filters.salleId } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.since ? { createdAt: { gte: filters.since } } : {}),
    };

    const entries = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true } },
        salle: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const rows = entries
      .map(
        (e: (typeof entries)[number]) => `<tr>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;">${e.createdAt.toLocaleString('fr-FR')}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;">${e.action}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;">${e.user ? `${e.user.firstName} ${e.user.lastName}` : 'Système'}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;">${e.salle?.name ?? '—'}</td>
        </tr>`,
      )
      .join('');

    const body = `
      <p>Export du journal d'activité GymCloud — ${entries.length} entrée(s) (max. 500 les plus récentes).</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead>
          <tr style="text-align:left;background:#f5f5f5;">
            <th style="padding:4px 8px;">Date</th>
            <th style="padding:4px 8px;">Action</th>
            <th style="padding:4px 8px;">Auteur</th>
            <th style="padding:4px 8px;">Salle</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    return this.emailService.send(recipientEmail, 'Export — Journal d\'activité GymCloud', body);
  }
}
