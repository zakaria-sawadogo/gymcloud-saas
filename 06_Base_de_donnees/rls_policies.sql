-- ═══════════════════════════════════════════════════════════════════════
-- GYMCLOUD SAAS — ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════
-- Filet de sécurité au niveau base de données, en complément du filtrage
-- applicatif Prisma (TenantMiddleware). Même si un développeur oublie un
-- filtre salleId dans une requête, PostgreSQL refusera de retourner des
-- lignes appartenant à une autre salle.
--
-- Principe : chaque connexion applicative définit la variable de session
-- "app.current_salle_id" (et "app.is_super_admin") au début de chaque
-- requête HTTP via le TenantMiddleware NestJS (voir
-- 02_Backend_NestJS/src/common/middleware/tenant.middleware.ts).
--
-- À exécuter après chaque `prisma migrate deploy` (non généré
-- automatiquement par Prisma — Prisma ne gère pas nativement le RLS).
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- Fonction utilitaire : le SUPER_ADMIN et les rôles internes GymCloud
-- avec accès global outrepassent le RLS (via un rôle de connexion dédié).
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION current_salle_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_salle_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_global_access() RETURNS boolean AS $$
  SELECT COALESCE(current_setting('app.is_global_access', true)::boolean, false);
$$ LANGUAGE sql STABLE;

-- ───────────────────────────────────────────────────────────────────────
-- Activation du RLS sur toutes les tables porteuses de salle_id
-- ───────────────────────────────────────────────────────────────────────

ALTER TABLE salles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE salle_documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestionnaire_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE adherent_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE abonnement_catalogues     ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE cours_collectifs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────────────────────────────────
-- Policies : accès autorisé si (a) accès global (SUPER_ADMIN / rôle
-- interne habilité) OU (b) la ligne appartient à la salle courante.
-- ───────────────────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation_salles ON salles
  USING (is_global_access() OR id = current_salle_id());

CREATE POLICY tenant_isolation_salle_documents ON salle_documents
  USING (is_global_access() OR salle_id = current_salle_id());

CREATE POLICY tenant_isolation_gestionnaires ON gestionnaire_profiles
  USING (is_global_access() OR salle_id = current_salle_id());

CREATE POLICY tenant_isolation_coachs ON coach_profiles
  USING (is_global_access() OR salle_id = current_salle_id());

CREATE POLICY tenant_isolation_adherents ON adherent_profiles
  USING (is_global_access() OR salle_id = current_salle_id());

CREATE POLICY tenant_isolation_abonnements ON abonnement_catalogues
  USING (is_global_access() OR salle_id = current_salle_id());

CREATE POLICY tenant_isolation_access_logs ON access_logs
  USING (is_global_access() OR salle_id = current_salle_id());

CREATE POLICY tenant_isolation_cours ON cours_collectifs
  USING (is_global_access() OR salle_id = current_salle_id());

CREATE POLICY tenant_isolation_bookings ON bookings
  USING (is_global_access() OR salle_id = current_salle_id());

CREATE POLICY tenant_isolation_payments ON payments
  USING (is_global_access() OR salle_id = current_salle_id());

CREATE POLICY tenant_isolation_campaigns ON marketing_campaigns
  USING (is_global_access() OR salle_id = current_salle_id());

CREATE POLICY tenant_isolation_coupons ON coupons
  USING (is_global_access() OR salle_id = current_salle_id());

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  USING (is_global_access() OR salle_id = current_salle_id() OR salle_id IS NULL);

-- ───────────────────────────────────────────────────────────────────────
-- Rôle de connexion applicatif restreint (bonnes pratiques — le pool
-- Prisma se connecte avec ce rôle, jamais avec le superuser postgres)
-- ───────────────────────────────────────────────────────────────────────

-- CREATE ROLE gymcloud_app LOGIN PASSWORD '__A_DEFINIR_VIA_SECRETS_MANAGER__';
-- GRANT CONNECT ON DATABASE gymcloud TO gymcloud_app;
-- GRANT USAGE ON SCHEMA public TO gymcloud_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gymcloud_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gymcloud_app;
-- Important : gymcloud_app ne doit PAS avoir l'attribut BYPASSRLS.
