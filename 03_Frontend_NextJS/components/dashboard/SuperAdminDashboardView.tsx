'use client';

import { Building2, UserCog, Users, TrendingUp, Wallet, Clock } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { StatCard } from './StatCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import type { SuperAdminDashboard } from '@/types';

export function SuperAdminDashboardView() {
  const { data, isLoading, error } = useApi<SuperAdminDashboard>('/reporting/admin/dashboard');

  if (isLoading) return <p className="text-sm text-ink-400">Chargement...</p>;
  if (error || !data) return <p className="text-sm text-red-600">{error ?? 'Aucune donnée'}</p>;

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-semibold text-ink-900">Vue globale de la plateforme</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Salles actives"
          value={data.plateforme.totalSalles}
          icon={<Building2 className="h-5 w-5" />}
          accent="primary"
          trend={{ value: `+${data.plateforme.nouvellesSallesCeMois} ce mois`, positive: true }}
        />
        <StatCard
          label="Propriétaires"
          value={data.plateforme.totalProprietaires}
          icon={<UserCog className="h-5 w-5" />}
        />
        <StatCard
          label="Adhérents (total)"
          value={data.plateforme.totalAdherents}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Revenu SaaS encaissé ce mois"
          value={formatCurrency(data.saas.revenuEncaisseCeMois)}
          icon={<Wallet className="h-5 w-5" />}
          accent="accent"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Répartition par plan SaaS</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {data.saas.repartitionParPlan.map((p) => (
              <div key={p.planCode} className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-800">{p.planCode}</span>
                <span className="font-display text-lg font-semibold text-ink-900">{p.count}</span>
              </div>
            ))}
          </div>
        </Card>

        <StatCard
          label="Revenu SaaS en attente de paiement"
          value={formatCurrency(data.saas.revenuEnAttente)}
          icon={<Clock className="h-5 w-5" />}
        />
      </div>
    </div>
  );
}
