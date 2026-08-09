import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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
}
