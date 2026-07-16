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
--
-- ⚠️ Deux points de vigilance corrigés ici, découverts au premier
-- déploiement réel (jamais testés contre une vraie base avant) :
--   1. Prisma stocke les identifiants en colonnes TEXT (pas le type
--      uuid natif de Postgres, sauf @db.Uuid explicite — jamais utilisé
--      dans ce schéma) — la fonction current_salle_id() doit donc
--      renvoyer TEXT, pas uuid, sous peine de "operator does not
--      exist: text = uuid" sur chaque policy.
--   2. Les COLONNES générées par Prisma restent en camelCase
--      (ex: "salleId") même quand le NOM DE TABLE est réécrit en
--      snake_case via @@map (ex: salle_documents) — un simple
--      @@map ne change pas la casse des colonnes. Toute référence à
--      une colonne camelCase DOIT être entre guillemets doubles, sinon
--      PostgreSQL la réduit en minuscules ("salleid") et elle ne
--      correspondra plus à la vraie colonne.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- Fonction utilitaire : le SUPER_ADMIN et les rôles internes GymCloud
-- avec accès global outrepassent le RLS (via un rôle de connexion dédié).
-- ───────────────────────────────────────────────────────────────────────

-- DROP explicite avant CREATE OR REPLACE : PostgreSQL refuse de
-- changer le type de retour d'une fonction existante via CREATE OR
-- REPLACE seul (erreur "cannot change return type of existing
-- function") — pertinent si ce script a déjà tourné une fois avec
-- une version antérieure (ex: avant la correction text/uuid ci-dessous).
DROP FUNCTION IF EXISTS current_salle_id();

CREATE OR REPLACE FUNCTION current_salle_id() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.current_salle_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_global_access() RETURNS boolean AS $$
  SELECT COALESCE(current_setting('app.is_global_access', true)::boolean, false);
$$ LANGUAGE sql STABLE;

-- ───────────────────────────────────────────────────────────────────────
-- Activation du RLS sur toutes les tables porteuses de salleId
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
  USING (is_global_access() OR "salleId" = current_salle_id());

CREATE POLICY tenant_isolation_gestionnaires ON gestionnaire_profiles
  USING (is_global_access() OR "salleId" = current_salle_id());

CREATE POLICY tenant_isolation_coachs ON coach_profiles
  USING (is_global_access() OR "salleId" = current_salle_id());

CREATE POLICY tenant_isolation_adherents ON adherent_profiles
  USING (is_global_access() OR "salleId" = current_salle_id());

CREATE POLICY tenant_isolation_abonnements ON abonnement_catalogues
  USING (is_global_access() OR "salleId" = current_salle_id());

CREATE POLICY tenant_isolation_access_logs ON access_logs
  USING (is_global_access() OR "salleId" = current_salle_id());

CREATE POLICY tenant_isolation_cours ON cours_collectifs
  USING (is_global_access() OR "salleId" = current_salle_id());

CREATE POLICY tenant_isolation_bookings ON bookings
  USING (is_global_access() OR "salleId" = current_salle_id());

CREATE POLICY tenant_isolation_payments ON payments
  USING (is_global_access() OR "salleId" = current_salle_id());

CREATE POLICY tenant_isolation_campaigns ON marketing_campaigns
  USING (is_global_access() OR "salleId" = current_salle_id());

CREATE POLICY tenant_isolation_coupons ON coupons
  USING (is_global_access() OR "salleId" = current_salle_id());

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  USING (is_global_access() OR "salleId" = current_salle_id() OR "salleId" IS NULL);

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
