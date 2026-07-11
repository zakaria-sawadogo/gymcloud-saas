#!/bin/sh
set -e

echo "→ Application des migrations Prisma..."
npx prisma migrate deploy

echo "→ Démarrage de l'API GymCloud..."
exec node dist/main
