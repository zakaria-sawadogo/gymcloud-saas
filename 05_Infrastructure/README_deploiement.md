# Déploiement en production — VPS + GitHub

Ce guide couvre le déploiement du backend NestJS et du frontend
Next.js sur un VPS (Hostinger VPS, DigitalOcean, etc.), avec mise à
jour automatique à chaque `git push` sur `main`. Depuis le 16/07/2026,
la page d'accueil publique (présentation, tarifs, formulaire de
demande) est directement intégrée à l'app Next.js elle-même — plus de
site vitrine séparé à héberger ni de domaine distinct à maintenir
(l'ancien dossier `07_Site_Vitrine` et l'hébergement Hostinger associé
sont abandonnés).

**Domaine utilisé dans les exemples** : `gymcloud.sahelsystem.com` —
remplacez par le vôtre partout où il apparaît (`nginx.conf`, ce guide).

---

## Partie A — Mise en place initiale du VPS (une seule fois)

### A.1 — Pointer le domaine vers le VPS

Chez votre registrar (ou le gestionnaire DNS de `sahelsystem.com`),
créez un enregistrement **A** :

```
gymcloud.sahelsystem.com  →  <adresse IP de votre VPS>
```

Attendez la propagation DNS (`ping gymcloud.sahelsystem.com` doit
répondre avec l'IP du VPS — peut prendre de quelques minutes à
quelques heures).

### A.2 — Installer Docker sur le VPS

Connectez-vous en SSH à votre VPS, puis :

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker   # ou reconnectez-vous en SSH pour que ça prenne effet
```

Vérifiez : `docker --version` et `docker compose version`.

### A.3 — Ouvrir les ports nécessaires (pare-feu)

```bash
sudo ufw allow 22/tcp    # SSH — ne le fermez jamais, ou vous perdez l'accès
sudo ufw allow 80/tcp    # HTTP (redirection + validation certbot)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### A.4 — Cloner le dépôt

```bash
cd ~
git clone https://github.com/<votre-compte>/<votre-repo>.git gymcloud-saas
cd gymcloud-saas/05_Infrastructure/docker
```

*(Si le dépôt est privé, configurez une clé de déploiement GitHub —
`ssh-keygen`, ajoutez la clé publique dans GitHub → Settings → Deploy
keys du repo, puis clonez via `git@github.com:...` au lieu de `https://`.)*

### A.5 — Configurer les secrets réels

```bash
cp .env.example .env
nano .env
```

Renseignez, au minimum :

```
POSTGRES_PASSWORD=<mot de passe fort, généré aléatoirement>
JWT_ACCESS_SECRET=<chaîne aléatoire d'au moins 32 caractères>
JWT_REFRESH_SECRET=<autre chaîne aléatoire d'au moins 32 caractères>
MINIO_ROOT_USER=gymcloud_admin
MINIO_ROOT_PASSWORD=<mot de passe fort>
CORS_ORIGINS="https://gymcloud.sahelsystem.com"
NEXT_PUBLIC_API_URL="https://gymcloud.sahelsystem.com/api/v1"
```

Générer une chaîne aléatoire forte : `openssl rand -base64 32`

### A.6 — Premier démarrage (HTTP uniquement, avant le certificat TLS)

Le certificat n'existe pas encore — `nginx.conf` tel quel référence un
certificat qui n'a pas encore été émis, ce qui empêcherait nginx de
démarrer. Temporairement, simplifiez le bloc HTTPS :

```bash
nano nginx.conf
```

Commentez (ou supprimez temporairement) tout le second bloc
`server { listen 443 ssl; ... }`, et remplacez le `location /` du
premier bloc (`listen 80`) par un simple proxy vers le frontend, le
temps d'obtenir le certificat :

```nginx
location / {
    proxy_pass http://gymcloud_web;
    proxy_set_header Host $host;
}
```

Puis démarrez tout :

```bash
docker compose up -d --build
```

Vérifiez que tout tourne : `docker compose ps` (tous les services
doivent être "Up" ou "healthy").

Appliquez la RLS et le seed (comme en local — voir
`README_infrastructure.md`) :

```bash
docker compose exec -T postgres psql -U gymcloud_app -d gymcloud \
  < ../../06_Base_de_donnees/rls_policies.sql
docker compose exec api npm run prisma:seed
```

À ce stade, `http://gymcloud.sahelsystem.com` doit déjà afficher
l'application (en HTTP, sans cadenas).

### A.7 — Obtenir le certificat TLS (Let's Encrypt)

```bash
docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
  -d gymcloud.sahelsystem.com \
  --email <votre-email> --agree-tos --no-eff-email" certbot
```

Si ça réussit, les certificats sont écrits dans le volume
`certbot_certs`. Remettez `nginx.conf` dans son état d'origine (les
deux blocs `listen 80` + `listen 443`, tel que livré dans ce dossier),
puis rechargez nginx :

```bash
docker compose up -d --build nginx
```

`https://gymcloud.sahelsystem.com` doit maintenant répondre avec un
certificat valide. Le renouvellement est automatique ensuite (service
`certbot` du `docker-compose.yml`, déjà configuré).

---

## Partie B — Déploiement automatique depuis GitHub

### B.1 — Générer une clé SSH dédiée au déploiement

**Sur votre machine locale** (pas sur le VPS) :

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ./gymcloud_deploy_key -N ""
```

Ça crée deux fichiers : `gymcloud_deploy_key` (privée) et
`gymcloud_deploy_key.pub` (publique).

### B.2 — Autoriser cette clé sur le VPS

```bash
cat gymcloud_deploy_key.pub | ssh <user>@<ip-vps> "cat >> ~/.ssh/authorized_keys"
```

### B.3 — Ajouter les secrets dans GitHub

Dans votre dépôt GitHub → **Settings → Secrets and variables →
Actions → New repository secret**, créez trois secrets :

| Nom | Valeur |
|---|---|
| `VPS_HOST` | L'adresse IP (ou le domaine) de votre VPS |
| `VPS_USER` | L'utilisateur SSH (ex: `root` ou votre utilisateur) |
| `VPS_SSH_KEY` | Le contenu **complet** de `gymcloud_deploy_key` (la clé privée) |

⚠️ Supprimez ensuite `gymcloud_deploy_key` de votre machine locale une
fois copiée dans GitHub — ne la laissez pas traîner sur disque.

### B.4 — C'est tout — chaque push sur `main` déploie automatiquement

Le workflow `05_Infrastructure/ci-cd/github-actions-ci.yml` fait déjà
tout le nécessaire : tests → build → **connexion SSH au VPS → exécution
de `deploy.sh`** (`git pull` + reconstruction Docker + migrations
Prisma + redémarrage). Rien d'autre à faire de votre côté qu'un
`git push origin main` normal.

Pour suivre le déploiement en cours : onglet **Actions** de votre
dépôt GitHub.

---

## Déploiement manuel (sans passer par GitHub Actions)

Si vous préférez déployer à la main plutôt qu'automatiquement :

```bash
ssh <user>@<ip-vps>
bash ~/gymcloud-saas/05_Infrastructure/docker/deploy.sh
```

C'est exactement ce que GitHub Actions exécute pour vous — vous pouvez
le lancer vous-même à tout moment.

---

## Vérifier que tout fonctionne

```bash
docker compose ps                          # tous les services "Up"
docker compose logs -f api                 # logs backend en direct
curl -I https://gymcloud.sahelsystem.com   # doit répondre 200
```

## Problèmes fréquents

- **Le certificat échoue à s'émettre** : vérifiez que le DNS pointe
  bien vers le VPS (`dig gymcloud.sahelsystem.com`) et que le port 80
  est bien accessible depuis l'extérieur (`sudo ufw status`).
- **Le frontend appelle encore `localhost`** : `NEXT_PUBLIC_API_URL`
  est figé au moment du build de l'image Docker — un `docker compose
  restart web` ne suffit pas après avoir changé `.env`, il faut
  `docker compose up -d --build web`.
- **`git pull` échoue dans `deploy.sh`** : vérifiez que le dépôt cloné
  sur le VPS n'a pas de modifications locales non commitées
  (`git status` dans `~/gymcloud-saas`) — `deploy.sh` utilise
  `git reset --hard`, qui écrase tout changement local volontairement.
