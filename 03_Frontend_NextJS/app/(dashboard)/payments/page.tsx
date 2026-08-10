'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { SallePaymentsView } from '@/components/dashboard/SallePaymentsView';
import { PaymentsClosureCard } from '@/components/dashboard/PaymentsClosureCard';
import { GeneralClosingSummary } from '@/components/dashboard/GeneralClosingSummary';

/**
 * Route Gestionnaire — délègue au composant partagé, paramétré par sa
 * propre salle. Le SUPER_ADMIN et le PROPRIETAIRE accèdent aux
 * paiements de n'importe quelle salle via `/salles/[id]` à la place.
 *
 * §14.x — Sous-onglets Paiements / Clôture, même principe que la
 * page Boutique — sépare l'encaissement au quotidien de la clôture
 * de fin de journée plutôt que de tout empiler sur une seule page.
 */
export default function PaymentsPage() {
  const { user } = useAuth();
  const salleId = user?.salle?.id;
  const [activeTab, setActiveTab] = useState<'paiements' | 'cloture'>('paiements');

  if (!salleId) return null;
  const currency = user?.salle?.currency ?? 'XOF';

  return (
    <div>
      <div className="mb-6 flex overflow-hidden rounded-lg border border-ink-200" style={{ width: 'fit-content' }}>
        {(
          [
            ['paiements', 'Paiements'],
            ['cloture', 'Clôture'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm ${activeTab === key ? 'bg-primary-600 text-white' : 'text-ink-600 hover:bg-ink-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'paiements' && <SallePaymentsView salleId={salleId} currency={currency} />}

      {activeTab === 'cloture' && (
        <div className="space-y-6">
          <PaymentsClosureCard salleId={salleId} currency={currency} canClose />
          <GeneralClosingSummary salleId={salleId} currency={currency} />
        </div>
      )}
    </div>
  );
}
