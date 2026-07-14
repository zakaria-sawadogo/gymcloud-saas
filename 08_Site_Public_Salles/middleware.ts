import { NextRequest, NextResponse } from 'next/server';

/**
 * §3.2 — Chaque salle a une adresse publique dédiée
 * (fitnessclub.gymcloud.africa). En production, le DNS générique
 * (*.gymcloud.africa) pointe vers ce déploiement ; ce middleware
 * détecte le sous-domaine demandé et réécrit en interne vers
 * /s/[subdomain] — la seule route qui existe réellement.
 *
 * En développement local, sans DNS générique, on accède directement
 * à /s/[subdomain] sans passer par un sous-domaine — le middleware ne
 * réécrit alors rien (host = localhost).
 */
const ROOT_HOSTS = new Set(['localhost', 'gymcloud.africa', 'www.gymcloud.africa']);

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const hostname = host.split(':')[0]; // retire le port éventuel (localhost:3002)

  // Pas de sous-domaine détecté (accès direct, IP, ou domaine racine) — laisser passer tel quel.
  const isRootHost = ROOT_HOSTS.has(hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
  if (isRootHost) {
    return NextResponse.next();
  }

  const subdomain = hostname.split('.')[0];
  if (!subdomain || subdomain === 'app' || subdomain === 'api') {
    // "app." et "api." sont les autres sous-domaines du produit
    // (application d'administration, API) — jamais des salles.
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = `/s/${subdomain}${req.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf fichiers statiques et internes Next.js.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
