import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Service Prisma unique, injecté dans tous les modules.
 *
 * Le filtrage multi-tenant applicatif se fait via les services métier
 * (chaque repository ajoute `where: { salleId }`). Ce service expose en
 * complément `setTenantContext()`, appelé par le TenantMiddleware, pour
 * définir les variables de session PostgreSQL consommées par les
 * policies RLS (voir 06_Base_de_donnees/rls_policies.sql) — double
 * verrou décrit dans la note d'architecture.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Définit le contexte tenant pour la connexion courante.
   * À appeler en tout début de traitement d'une requête HTTP.
   */
  async setTenantContext(salleId: string | null, isGlobalAccess: boolean): Promise<void> {
    await this.$executeRawUnsafe(
      `SELECT set_config('app.current_salle_id', $1, true), set_config('app.is_global_access', $2, true)`,
      salleId ?? '',
      String(isGlobalAccess),
    );
  }
}
