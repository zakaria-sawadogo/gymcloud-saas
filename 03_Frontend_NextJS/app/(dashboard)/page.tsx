'use client';

import { useAuth } from '@/lib/auth-context';
import { GestionnaireDashboardView } from '@/components/dashboard/GestionnaireDashboardView';
import { ProprietaireDashboardView } from '@/components/dashboard/ProprietaireDashboardView';
import { SuperAdminDashboardView } from '@/components/dashboard/SuperAdminDashboardView';
import { CoachPlanningView } from '@/components/dashboard/CoachPlanningView';

/**
 * Point d'entrée unique du dashboard — délègue à la vue appropriée
 * selon le rôle connecté (§2.3).
 */
export default function DashboardHomePage() {
  const { user } = useAuth();
  if (!user) return null;

  switch (user.roleCode) {
    case 'SUPER_ADMIN':
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
      return (
        <p className="text-sm text-ink-600">
          Aucun tableau de bord disponible pour ce rôle sur l'application web.
        </p>
      );
  }
}
