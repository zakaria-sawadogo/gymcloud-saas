'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { LandingPage } from '@/components/landing/LandingPage';

/**
 * §3.2, §9.5 — Racine publique de l'app. Remplace l'ancien site
 * vitrine séparé (07_Site_Vitrine, hébergement Hostinger distinct) :
 * un visiteur non connecté voit directement la présentation
 * marketing ici, sur le même domaine que l'application elle-même —
 * plus de CDN/DNS/SSL séparés à maintenir pour un simple site
 * statique.
 *
 * Un utilisateur déjà connecté est redirigé vers /dashboard — cette
 * page reste donc toujours "publique" au sens où son contenu ne
 * dépend jamais de req.tenant/de données protégées.
 */
export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard');
    }
  }, [isLoading, user, router]);

  if (isLoading || user) {
    // Écran neutre pendant la vérification de session / la redirection —
    // évite un flash de contenu marketing pour un utilisateur déjà connecté.
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return <LandingPage />;
}
