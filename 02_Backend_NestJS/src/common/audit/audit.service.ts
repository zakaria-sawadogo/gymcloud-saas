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
}
