CREATE OR REPLACE FUNCTION current_salle_id() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.current_salle_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_global_access() RETURNS boolean AS $$
  SELECT COALESCE(current_setting('app.is_global_access', true)::boolean, false);
$$ LANGUAGE sql STABLE;

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
