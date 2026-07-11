'use client';

import { useAuth } from '@/lib/auth-context';
import { SallePaymentsView } from '@/components/dashboard/SallePaymentsView';

/**
 * Route Gestionnaire — délègue au composant partagé, paramétré par sa
 * propre salle. Le SUPER_ADMIN et le PROPRIETAIRE accèdent aux
 * paiements de n'importe quelle salle via `/salles/[id]` à la place.
 */
export default function PaymentsPage() {
  const { user } = useAuth();
  const salleId = user?.salle?.id;

  if (!salleId) return null;
  return <SallePaymentsView salleId={salleId} />;
}
