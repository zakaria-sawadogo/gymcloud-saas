'use client';

import Link from 'next/link';
import { Users, Wallet, Activity, Building2 } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { StatCard } from './StatCard';
import { DownloadReportButton } from './DownloadReportButton';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import type { ProprietaireDashboard } from '@/types';

export function ProprietaireDashboardView({ proprietaireId }: { proprietaireId: string }) {
  const { data, isLoading, error } = useApi<ProprietaireDashboard>(
    `/reporting/proprietaire/${proprietaireId}/dashboard`,
  );

  if (isLoading) return <p className="text-sm text-ink-400">Chargement...</p>;
  if (error || !data) return <p className="text-sm text-red-600">{error ?? 'Aucune donnée'}</p>;

  // §14.x — utilise le signal explicite du backend
  // (currency/hasMixedCurrencies) plutôt que de supposer la devise de
  // la première salle — un propriétaire peut avoir des salles dans
  // des pays différents, auquel cas additionner les montants n'aurait
  // aucun sens (voir ReportingService.getProprietaireDashboard).
  const consolidatedCurrency = data.currency ?? undefined;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Vue consolidée</h1>
        <DownloadReportButton
          path={`/reporting/proprietaire/${proprietaireId}/pdf`}
          filename="rapport-consolide.pdf"
        />
      </div>

      {data.hasMixedCurrencies && (
        <p className="mb-4 rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700">
          Vos salles sont dans des pays à devises différentes — les revenus consolidés ne sont pas additionnés (voir
          le détail par salle ci-dessous pour les montants exacts).
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Adhérents actifs (toutes salles)"
          value={data.consolidated.totalAdherentsActifs}
          icon={<Users className="h-5 w-5" />}
          accent="primary"
        />
        <StatCard
          label="Revenus aujourd'hui"
          value={data.hasMixedCurrencies ? '—' : formatCurrency(data.consolidated.revenusAujourdHui, consolidatedCurrency)}
          icon={<Wallet className="h-5 w-5" />}
          accent="accent"
        />
        <StatCard
          label="Revenus ce mois"
          value={data.hasMixedCurrencies ? '—' : formatCurrency(data.consolidated.revenusCeMois, consolidatedCurrency)}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          label="Présents actuellement"
          value={data.consolidated.presentsActuellement}
          icon={<Activity className="h-5 w-5" />}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Détail par salle</CardTitle>
        </CardHeader>
        <div className="divide-y divide-ink-100">
          {data.salles.map((salle) => (
            <Link
              key={salle.salleId}
              href={`/salles/${salle.salleId}`}
              className="flex items-center justify-between py-3 hover:bg-ink-50 -mx-5 px-5"
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-ink-400" />
                <span className="text-sm font-medium text-ink-900">{salle.salleName}</span>
              </div>
              <div className="flex items-center gap-6 text-sm text-ink-600">
                <span>{salle.adherents.actifs} adhérents</span>
                <span>{formatCurrency(salle.revenus.ceMois, salle.currency)}</span>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
