'use client';

import Link from 'next/link';
import { Users, Wallet, Activity, Building2 } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { StatCard } from './StatCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import type { ProprietaireDashboard } from '@/types';

export function ProprietaireDashboardView({ proprietaireId }: { proprietaireId: string }) {
  const { data, isLoading, error } = useApi<ProprietaireDashboard>(
    `/reporting/proprietaire/${proprietaireId}/dashboard`,
  );

  if (isLoading) return <p className="text-sm text-ink-400">Chargement...</p>;
  if (error || !data) return <p className="text-sm text-red-600">{error ?? 'Aucune donnée'}</p>;

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-semibold text-ink-900">Vue consolidée</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Adhérents actifs (toutes salles)"
          value={data.consolidated.totalAdherentsActifs}
          icon={<Users className="h-5 w-5" />}
          accent="primary"
        />
        <StatCard
          label="Revenus aujourd'hui"
          value={formatCurrency(data.consolidated.revenusAujourdHui)}
          icon={<Wallet className="h-5 w-5" />}
          accent="accent"
        />
        <StatCard
          label="Revenus ce mois"
          value={formatCurrency(data.consolidated.revenusCeMois)}
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
                <span>{formatCurrency(salle.revenus.ceMois)}</span>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
