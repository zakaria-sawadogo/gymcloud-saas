#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Script de déploiement — à exécuter SUR LE VPS (pas en local).
# Récupère le dernier code depuis GitHub, reconstruit les images
# Docker si nécessaire, applique les migrations, redémarre les
# services. Idempotent : peut être relancé sans risque.
#
# Utilisation manuelle : ./deploy.sh
# Utilisation automatique : appelé par GitHub Actions via SSH
# (voir 05_Infrastructure/ci-cd/github-actions-ci.yml, job "deploy").
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

REPO_DIR="$HOME/gymcloud-saas"   # ajustez si votre clone vit ailleurs
COMPOSE_DIR="$REPO_DIR/05_Infrastructure/docker"

echo "→ Récupération du dernier code..."
cd "$REPO_DIR"
git fetch origin main
git reset --hard origin/main

echo "→ Reconstruction et redémarrage des services..."
cd "$COMPOSE_DIR"
docker compose pull --ignore-pull-failures || true
docker compose up -d --build

echo "→ Application des migrations Prisma..."
# Redondant avec docker-entrypoint.sh (qui migre déjà au démarrage du
# conteneur api) — gardé ici comme filet de sécurité explicite, sans
# danger : `prisma migrate deploy` est idempotent.
docker compose exec -T api npx prisma migrate deploy

echo "→ Nettoyage des anciennes images (libère de l'espace disque)..."
docker image prune -f

echo "✓ Déploiement terminé."
docker compose ps
