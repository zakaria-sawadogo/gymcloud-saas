'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { GestionnaireDashboardView } from '@/components/dashboard/GestionnaireDashboardView';
import { ProprietaireDashboardView } from '@/components/dashboard/ProprietaireDashboardView';
import { SuperAdminDashboardView } from '@/components/dashboard/SuperAdminDashboardView';
import { CoachPlanningView } from '@/components/dashboard/CoachPlanningView';

// Redirection par défaut pour les rôles internes sans vue "/" dédiée —
// chacun atterrit directement sur la première page à laquelle il a
// effectivement accès (§2.2), plutôt que sur un message générique.
const DEFAULT_REDIRECT_BY_ROLE: Record<string, string> = {
  RESPONSABLE_SUPPORT: '/salles',
  RESPONSABLE_FINANCE: '/facturation-saas',
  RESPONSABLE_COMMERCIAL: '/proprietaires',
  RESPONSABLE_MARKETING: '/salles',
  SUPERVISEUR_PAYS: '/salles',
};

/**
 * Point d'entrée unique du dashboard — délègue à la vue appropriée
 * selon le rôle connecté (§2.3, §2.2).
 */
export default function DashboardHomePage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && DEFAULT_REDIRECT_BY_ROLE[user.roleCode]) {
      router.replace(DEFAULT_REDIRECT_BY_ROLE[user.roleCode]);
    }
  }, [user, router]);

  if (!user) return null;

  switch (user.roleCode) {
    case 'SUPER_ADMIN':
    case 'ADMIN_GYMCLOUD':
      return <SuperAdminDashboardView />;
    case 'PROPRIETAIRE':
      return user.proprietaireId ? (
        <ProprietaireDashboardView proprietaireId={user.proprietaireId} />
      ) : null;
    case 'GESTIONNAIRE':
      return user.salle ? <GestionnaireDashboardView salleId={user.salle.id} /> : null;
    case 'COACH':
      return user.coachId ? <CoachPlanningView coachId={user.coachId} /> : null;
    default:
      return DEFAULT_REDIRECT_BY_ROLE[user.roleCode] ? null : (
        <p className="text-sm text-ink-600">
          Aucun tableau de bord disponible pour ce rôle sur l'application web.
        </p>
      );
  }
}
