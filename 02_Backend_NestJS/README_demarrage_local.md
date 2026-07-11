# Démarrage en local — sans Docker

Ce guide couvre le cas où vous avez PostgreSQL et Redis installés
directement sur votre machine (Homebrew, Postgres.app...) plutôt que de
tout faire passer par Docker Compose. C'est le mode le plus pratique
pour développer activement (rechargement à chaud), mais il demande
une étape manuelle que Docker fait automatiquement : créer la base et
l'utilisateur PostgreSQL vous-même.

## 1. Prérequis

- PostgreSQL 15+ installé et démarré (`brew services start postgresql@15` sous macOS)
- Redis installé et démarré (`brew services start redis`) — requis pour les tâches planifiées (BullMQ)
- Node.js 20+

## 2. Créer la base et l'utilisateur PostgreSQL (une seule fois)

```bash
cd 06_Base_de_donnees
psql postgres -f setup_local_db.sql
```

Si `psql postgres` demande un mot de passe que vous ne connaissez pas,
c'est que votre installation utilise un autre compte superutilisateur
(souvent votre nom d'utilisateur macOS) : essayez `psql -U $(whoami) postgres`.

Le script utilise le mot de passe `changeme_dev_only` par défaut — libre
à vous de le changer dans le fichier avant de l'exécuter, du moment que
vous mettez la même valeur dans `DATABASE_URL` à l'étape suivante.

## 3. Configurer le backend

```bash
cd ../02_Backend_NestJS
npm install
cp .env.example .env
```

Vérifiez que `DATABASE_URL` dans `.env` correspond au mot de passe choisi :

```
DATABASE_URL="postgresql://gymcloud_app:changeme_dev_only@localhost:5432/gymcloud?schema=public"
```

## 4. Appliquer les migrations et peupler les données de référence

```bash
npx prisma migrate dev
npm run prisma:seed
```

Le seed crée les rôles système, les 3 plans SaaS par défaut, et un
premier compte SUPER_ADMIN (`+22600000000` / `GymCloud@2026` — à changer
immédiatement après connexion).

## 5. Appliquer les policies de sécurité (RLS)

```bash
psql -U gymcloud_app -d gymcloud -f ../06_Base_de_donnees/rls_policies.sql
```

## 6. Démarrer le backend

```bash
npm run start:dev
```

L'API est disponible sur http://localhost:3000, la documentation Swagger sur http://localhost:3000/api/docs.

## 7. Démarrer le frontend (autre terminal)

```bash
cd ../03_Frontend_NextJS
npm install
cp .env.local.example .env.local
npm run dev
```

Le site est disponible sur http://localhost:3001.

## Erreurs fréquentes

| Erreur | Cause | Solution |
|---|---|---|
| `P1010: User denied access` | Étape 2 non faite, ou mot de passe différent entre Postgres et `.env` | Refaire l'étape 2, vérifier `DATABASE_URL` |
| `P3014: could not create the shadow database` | L'utilisateur `gymcloud_app` n'a pas le droit `CREATEDB` (nécessaire uniquement pour `migrate dev`, pas pour `migrate deploy` en production) | `psql postgres` puis `ALTER USER gymcloud_app CREATEDB;` |
| `P1001: Can't reach database server` | PostgreSQL non démarré | `brew services start postgresql@15` |
| Erreurs BullMQ / Redis au démarrage | Redis non démarré | `brew services start redis` |
| `relation "xxx" does not exist` | Migrations non appliquées | `npx prisma migrate dev` |
