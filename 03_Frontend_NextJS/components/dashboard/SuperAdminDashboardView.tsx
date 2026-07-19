'use client';

import { Building2, UserCog, Users, Wallet, Clock, TrendingUp } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { StatCard } from './StatCard';
import { DownloadReportButton } from './DownloadReportButton';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import type { SuperAdminDashboard } from '@/types';

export function SuperAdminDashboardView() {
  const { data, isLoading, error } = useApi<SuperAdminDashboard>('/reporting/admin/dashboard');

  if (isLoading) return <p className="text-sm text-ink-400">Chargement...</p>;
  if (error || !data) return <p className="text-sm text-red-600">{error ?? 'Aucune donnée'}</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Vue globale de la plateforme</h1>
        <DownloadReportButton path="/reporting/admin/pdf" filename="rapport-plateforme.pdf" />
      </div>

      {/* §9.14 — Vue globale */}
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
          trend={{ value: `+${data.plateforme.nouveauxProprietairesCeMois} ce mois`, positive: true }}
        />
        <StatCard
          label="Gestionnaires / Coachs"
          value={`${data.plateforme.totalGestionnaires} / ${data.plateforme.totalCoachs}`}
          icon={<UserCog className="h-5 w-5" />}
        />
        <StatCard
          label="Adhérents (total)"
          value={data.plateforme.totalAdherents}
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      {/* §9.14 — Activité SaaS */}
      <h2 className="font-display mb-3 mt-8 text-lg font-semibold text-ink-900">Activité SaaS</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Salles en grâce" value={data.activiteSaas.sallesEnGrace} icon={<Clock className="h-5 w-5" />} accent="accent" />
        <StatCard label="Salles suspendues" value={data.activiteSaas.sallesSuspendues} icon={<Clock className="h-5 w-5" />} />
        <StatCard label="Renouvellements ce mois" value={data.activiteSaas.renouvellementsCeMois} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard
          label="Upgrades / Downgrades"
          value={`${data.activiteSaas.upgradesCeMois} / ${data.activiteSaas.downgradesCeMois}`}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {/* §9.14 — Revenus */}
      <h2 className="font-display mb-3 mt-8 text-lg font-semibold text-ink-900">Revenus</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Aujourd'hui" value={formatCurrency(data.revenus.aujourdHui)} icon={<Wallet className="h-5 w-5" />} accent="accent" />
        <StatCard label="Ce mois" value={formatCurrency(data.revenus.ceMois)} icon={<Wallet className="h-5 w-5" />} accent="accent" />
        <StatCard label="Cette année" value={formatCurrency(data.revenus.cetteAnnee)} icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="En attente de paiement" value={formatCurrency(data.revenus.enAttente)} icon={<Clock className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Répartition par plan SaaS</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {data.revenus.repartitionParPlan.map((p) => (
              <div key={p.planCode} className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-800">{p.planCode}</span>
                <span className="font-display text-lg font-semibold text-ink-900">{p.count}</span>
              </div>
            ))}
          </div>
        </Card>
        <StatCard
          label="Revenus salles supplémentaires (ce mois)"
          value={formatCurrency(data.revenus.sallesSupplementairesCeMois)}
          icon={<Building2 className="h-5 w-5" />}
        />
      </div>
    </div>
  );
}
