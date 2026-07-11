'use client';

import { Users, Wallet, Activity, CalendarCheck } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { StatCard } from './StatCard';
import { formatCurrency } from '@/lib/utils';
import type { GestionnaireDashboard } from '@/types';

export function GestionnaireDashboardView({ salleId }: { salleId: string }) {
  const { data, isLoading, error } = useApi<GestionnaireDashboard>(`/reporting/salle/${salleId}/dashboard`);

  if (isLoading) return <DashboardSkeleton />;
  if (error || !data) return <p className="text-sm text-red-600">{error ?? 'Aucune donnée'}</p>;

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-semibold text-ink-900">Tableau de bord</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Adhérents actifs"
          value={data.adherents.actifs}
          icon={<Users className="h-5 w-5" />}
          accent="primary"
          trend={{ value: `+${data.adherents.nouveauxCeMois} ce mois`, positive: true }}
        />
        <StatCard
          label="Revenus aujourd'hui"
          value={formatCurrency(data.revenus.aujourdHui)}
          icon={<Wallet className="h-5 w-5" />}
          accent="accent"
        />
        <StatCard
          label="Présents actuellement"
          value={data.frequentation.presentsActuellement}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          label="Réservations (7j)"
          value={data.reservations.confirmeesSeptJoursAVenir}
          icon={<CalendarCheck className="h-5 w-5" />}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="En grâce" value={data.adherents.enGrace} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Expirés" value={data.adherents.expires} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Suspendus" value={data.adherents.suspendus} icon={<Users className="h-5 w-5" />} />
      </div>

      <div className="mt-6">
        <StatCard
          label="Revenus ce mois"
          value={formatCurrency(data.revenus.ceMois)}
          icon={<Wallet className="h-5 w-5" />}
          accent="primary"
        />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-card bg-ink-100" />
      ))}
    </div>
  );
}
