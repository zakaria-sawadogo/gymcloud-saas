# Infrastructure GymCloud

## Démarrage local complet

```bash
cd 05_Infrastructure/docker
cp .env.example .env          # ajuster les secrets si besoin
docker compose up --build
```

Cela démarre : PostgreSQL, Redis, MinIO, l'API NestJS (migrations Prisma appliquées automatiquement au démarrage via `docker-entrypoint.sh`), le frontend Next.js, et Nginx en façade sur `http://localhost`.

## Étape manuelle obligatoire après le tout premier démarrage

Les **policies Row Level Security** (`06_Base_de_donnees/rls_policies.sql`) ne peuvent pas être appliquées automatiquement au boot de PostgreSQL : elles référencent des tables créées par les migrations Prisma, qui ne s'exécutent qu'après le démarrage du conteneur `api`. Une fois `docker compose up` stabilisé (première migration passée) :

```bash
docker compose exec -T postgres psql -U gymcloud_app -d gymcloud \
  < ../../06_Base_de_donnees/rls_policies.sql
```

Puis peupler les données de référence (rôles système, plans SaaS) :

```bash
docker compose exec api npm run prisma:seed
```

## Important — Contexte de build Docker

Les deux `Dockerfile.backend` et `Dockerfile.frontend` utilisent la **racine du projet** (`GymCloud_SaaS/`) comme contexte de build, pas leurs propres dossiers respectifs. C'est nécessaire car `Dockerfile.backend` copie le script `docker-entrypoint.sh` situé dans `05_Infrastructure/`, hors de `02_Backend_NestJS/` — Docker interdit `COPY` d'un chemin situé hors du contexte de build. Ne pas déplacer ces fichiers sans ajuster les chemins `COPY` en conséquence.

## CI/CD — GitHub Actions

Le fichier `ci-cd/github-actions-ci.yml` est stocké ici pour rester à côté du reste de l'infrastructure, mais **GitHub n'exécute que les workflows situés dans `.github/workflows/`** à la racine du dépôt Git. Une fois ce dossier poussé vers un vrai dépôt GitHub :

```bash
mkdir -p .github/workflows
cp 05_Infrastructure/ci-cd/github-actions-ci.yml .github/workflows/ci.yml
```

Le workflow couvre : lint + vérification des types + build pour le backend et le frontend, exécution des tests backend contre une vraie instance PostgreSQL éphémère, puis build des images Docker sur push vers `main` (le push vers un registre et le déclenchement du déploiement sont à brancher selon l'hébergeur retenu — non figés ici volontairement).

## Répartition des ports (développement)

| Service | Port | Usage |
|---|---|---|
| Nginx | 80 | Point d'entrée unique recommandé |
| API NestJS | 3000 | Accès direct (dev/debug), Swagger sur `/api/docs` |
| Frontend Next.js | 3001 | Accès direct (dev/debug) |
| PostgreSQL | 5432 | Accès direct (dev/debug uniquement) |
| Redis | 6379 | Accès direct (dev/debug uniquement) |
| MinIO API | 9000 | Stockage S3-compatible |
| MinIO Console | 9001 | Interface web d'administration |
