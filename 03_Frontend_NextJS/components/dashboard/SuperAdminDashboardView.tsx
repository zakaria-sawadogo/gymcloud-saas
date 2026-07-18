'use client';

import { Building2, UserCog, Users, Wallet, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { StatCard } from './StatCard';
import { DownloadReportButton } from './DownloadReportButton';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import type { SuperAdminDashboard, SaasKpis } from '@/types';

function formatPct(value: number | null, decimals = 1): string {
  if (value === null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function SuperAdminDashboardView() {
  const { data, isLoading, error } = useApi<SuperAdminDashboard>('/reporting/admin/dashboard');
  const { data: kpis } = useApi<SaasKpis>('/reporting/admin/kpis');

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

      {/* §9.15 — KPI SaaS */}
      {kpis && (
        <>
          <h2 className="font-display mb-3 mt-8 text-lg font-semibold text-ink-900">KPI SaaS</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="MRR" value={formatCurrency(kpis.revenus.mrr)} icon={<Wallet className="h-5 w-5" />} accent="primary" />
            <StatCard label="ARR" value={formatCurrency(kpis.revenus.arr)} icon={<Wallet className="h-5 w-5" />} accent="primary" />
            <StatCard label="Revenu moyen / salle" value={formatCurrency(kpis.revenus.revenuMoyenParSalle)} icon={<Building2 className="h-5 w-5" />} />
            <StatCard
              label="Revenu moyen / propriétaire"
              value={formatCurrency(kpis.revenus.revenuMoyenParProprietaire)}
              icon={<UserCog className="h-5 w-5" />}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Taux de rétention"
              value={`${(kpis.fidelisation.tauxRetention * 100).toFixed(1)}%`}
              icon={<TrendingUp className="h-5 w-5" />}
              accent={kpis.fidelisation.tauxRetention > 0.8 ? 'primary' : 'accent'}
            />
            <StatCard
              label="Taux de churn"
              value={`${(kpis.fidelisation.churnRate * 100).toFixed(1)}%`}
              icon={<TrendingDown className="h-5 w-5" />}
              accent={kpis.fidelisation.churnRate > 0.2 ? 'accent' : undefined}
            />
            <StatCard
              label="Taux de renouvellement (90j)"
              value={kpis.fidelisation.tauxRenouvellement !== null ? `${(kpis.fidelisation.tauxRenouvellement * 100).toFixed(1)}%` : '—'}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <StatCard
              label="LTV (valeur vie client)"
              value={kpis.rentabilite.ltv !== null ? formatCurrency(kpis.rentabilite.ltv) : '—'}
              icon={<Wallet className="h-5 w-5" />}
            />
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Croissance (nouveaux propriétaires vs période précédente)</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { label: 'Mensuelle', value: kpis.croissance.mensuelle },
                { label: 'Trimestrielle', value: kpis.croissance.trimestrielle },
                { label: 'Annuelle', value: kpis.croissance.annuelle },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-center gap-1">
                    {item.value === null ? (
                      <Minus className="h-4 w-4 text-ink-400" />
                    ) : item.value >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-primary-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span
                      className={`font-display text-lg font-semibold ${
                        item.value === null ? 'text-ink-400' : item.value >= 0 ? 'text-primary-600' : 'text-red-600'
                      }`}
                    >
                      {formatPct(item.value)}
                    </span>
                  </div>
                  <p className="text-xs text-ink-400">{item.label}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
