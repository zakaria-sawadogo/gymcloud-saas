'use client';

import { useAuth } from '@/lib/auth-context';
import { SallePaymentsView } from '@/components/dashboard/SallePaymentsView';
import { PaymentsClosureCard } from '@/components/dashboard/PaymentsClosureCard';
import { GeneralClosingSummary } from '@/components/dashboard/GeneralClosingSummary';

/**
 * Route Gestionnaire — délègue au composant partagé, paramétré par sa
 * propre salle. Le SUPER_ADMIN et le PROPRIETAIRE accèdent aux
 * paiements de n'importe quelle salle via `/salles/[id]` à la place.
 */
export default function PaymentsPage() {
  const { user } = useAuth();
  const salleId = user?.salle?.id;

  if (!salleId) return null;
  const currency = user?.salle?.currency ?? 'XOF';
  return (
    <div className="space-y-6">
      <SallePaymentsView salleId={salleId} currency={currency} />
      <PaymentsClosureCard salleId={salleId} currency={currency} canClose />
      <GeneralClosingSummary salleId={salleId} currency={currency} />
    </div>
  );
}
