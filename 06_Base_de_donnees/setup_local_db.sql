-- ═══════════════════════════════════════════════════════════════════════
-- BOOTSTRAP POSTGRESQL LOCAL (hors Docker Compose)
-- ═══════════════════════════════════════════════════════════════════════
-- À exécuter UNE SEULE FOIS, en tant que superutilisateur, avant le tout
-- premier `npx prisma migrate dev`.
--
-- Cette étape est automatique dans docker-compose.yml (les variables
-- POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB créent l'utilisateur et
-- la base au premier démarrage du conteneur). Pour un PostgreSQL installé
-- localement (Homebrew, Postgres.app, etc.), elle doit être faite à la main.
--
-- Usage :
--   psql postgres -f setup_local_db.sql
-- (ou copier-coller le contenu dans `psql postgres` ouvert manuellement)
-- ═══════════════════════════════════════════════════════════════════════

-- Remplacer 'changeme_dev_only' par un mot de passe de votre choix, et
-- utiliser EXACTEMENT le même dans DATABASE_URL (fichier .env).
--
-- CREATEDB est nécessaire uniquement en développement local : `prisma
-- migrate dev` crée une base "fantôme" (shadow database) temporaire à
-- chaque migration pour calculer les différences de schéma. Ce droit
-- N'EST PAS accordé en production, où seul `prisma migrate deploy` est
-- utilisé (il n'a pas besoin de shadow database) — voir
-- rls_policies.sql pour le rôle applicatif de production, plus restreint.
CREATE USER gymcloud_app WITH PASSWORD 'changeme_dev_only' CREATEDB;

-- Si l'utilisateur existe déjà (script relancé après une première
-- exécution sans CREATEDB), la ligne ci-dessus échoue avec "role
-- already exists" — exécuter à la place :
--   ALTER USER gymcloud_app CREATEDB;

CREATE DATABASE gymcloud OWNER gymcloud_app;

GRANT ALL PRIVILEGES ON DATABASE gymcloud TO gymcloud_app;

-- Nécessaire depuis PostgreSQL 15 : le propriétaire d'une base n'a plus
-- automatiquement tous les droits sur le schéma "public" par défaut.
\c gymcloud
GRANT ALL ON SCHEMA public TO gymcloud_app;

-- Vérification
\du gymcloud_app
\l gymcloud
