'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/use-api';
import { Select } from '@/components/ui/Input';
import { CaisseClosureCard } from '@/components/dashboard/CaisseClosureCard';
import { PaymentsClosureCard } from '@/components/dashboard/PaymentsClosureCard';
import { GeneralClosingSummary } from '@/components/dashboard/GeneralClosingSummary';
import type { Salle } from '@/types';

/**
 * §14.x — Page dédiée au suivi des clôtures pour le propriétaire —
 * centralise ce qui était auparavant dispersé dans la vue boutique
 * (boutique + paiements + vue générale), pour un accès direct sans
 * devoir naviguer dans un module optionnel (boutique) pour voir des
 * informations qui concernent aussi les paiements, toujours actifs.
 */
export default function CloturePage() {
  const { data: salles, isLoading } = useApi<Salle[]>('/salles');
  const [selectedSalleId, setSelectedSalleId] = useState('');

  const activeSalleId = selectedSalleId || salles?.[0]?.id;
  const activeSalleCurrency = salles?.find((s) => s.id === activeSalleId)?.country?.currency;

  if (isLoading) return <p className="text-sm text-ink-400">Chargement...</p>;
  if (!salles || salles.length === 0) {
    return <p className="text-sm text-ink-400">Aucune salle pour l'instant.</p>;
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink-900">Clôture</h1>
      <p className="mb-6 text-sm text-ink-500">
        Suivi des clôtures de caisse — boutique et paiements d&apos;abonnements, jour par jour.
      </p>

      {salles.length > 1 && (
        <div className="mb-6 max-w-xs">
          <Select value={activeSalleId} onChange={(e) => setSelectedSalleId(e.target.value)}>
            {salles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {activeSalleId && (
        <div className="space-y-6">
          <GeneralClosingSummary salleId={activeSalleId} currency={activeSalleCurrency ?? 'XOF'} />
          <CaisseClosureCard salleId={activeSalleId} currency={activeSalleCurrency ?? 'XOF'} canClose={false} />
          <PaymentsClosureCard salleId={activeSalleId} currency={activeSalleCurrency ?? 'XOF'} canClose={false} />
        </div>
      )}
    </div>
  );
}
