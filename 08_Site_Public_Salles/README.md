# Site public par salle (§3.2)

Chaque salle dispose d'une adresse publique dédiée
(`fitnessclub.gymcloud.africa`, `gymfit.gymcloud.africa`...) : présentation,
consultation des activités, inscription en ligne, demande d'essai gratuit.
**Aucune fonction d'administration n'est accessible depuis ces adresses** —
celles-ci restent exclusivement sur `app.gymcloud.africa`.

## Démarrage local

```bash
cp .env.example .env.local
npm install
npm run dev   # → http://localhost:3002
```

## Tester une salle en local (sans DNS générique)

En production, un DNS wildcard (`*.gymcloud.africa`) pointe vers ce
déploiement et le middleware (`middleware.ts`) détecte le sous-domaine
demandé. En local, sans ce DNS, accédez directement à la route interne :

```
http://localhost:3002/s/fitnessclub
```

en remplaçant `fitnessclub` par le sous-domaine configuré sur une salle
(champ "Site public" de la fiche salle, dans l'application d'administration).

## Ce que ce projet ne fait PAS

- Pas de connexion, pas de session, pas de rôle
- Pas de création de compte adhérent (l'inscription en ligne crée un simple
  **prospect** — le gestionnaire rappelle et convertit lui-même)
- Pas de réservation réelle (la demande d'essai gratuit crée aussi un simple
  **prospect** lié au cours visé)
- Pas d'accès aux données d'autres salles, ni à des informations financières
  internes (voir `PublicService` côté backend — seuls des champs explicitement
  listés comme publics sont jamais retournés)
