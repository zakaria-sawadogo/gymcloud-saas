'use client';

import { useState } from 'react';
import { Building2, UserCog, Wallet, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/hooks/use-api';
import { StatCard } from '@/components/dashboard/StatCard';
import { SalleStatsPanel } from '@/components/dashboard/SalleStatsPanel';
import { DownloadReportButton } from '@/components/dashboard/DownloadReportButton';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import type { SaasKpis, Salle } from '@/types';

function formatPct(value: number | null, decimals = 1): string {
  if (value === null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/**
 * §11 — Onglet Statistiques/BI, distinct du Tableau de bord : chiffres
 * de fond (revenus dans le temps, fréquentation, rétention, KPI SaaS)
 * plutôt que le pilotage du quotidien.
 */
export default function StatistiquesPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-semibold text-ink-900">Statistiques</h1>
      {user?.roleCode === 'SUPER_ADMIN' && <SuperAdminStats />}
      {user?.roleCode === 'PROPRIETAIRE' && <ProprietaireStats />}
      {user?.roleCode === 'GESTIONNAIRE' && user.salle && <SalleStatsPanel salleId={user.salle.id} />}
    </div>
  );
}

function SuperAdminStats() {
  const { data: kpis, isLoading } = useApi<SaasKpis>('/reporting/admin/kpis');

  if (isLoading) return <p className="text-sm text-ink-400">Chargement...</p>;
  if (!kpis) return <p className="text-sm text-red-600">Aucune donnée</p>;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <DownloadReportButton path="/reporting/admin/pdf" filename="rapport-plateforme.pdf" />
      </div>

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
    </div>
  );
}

function ProprietaireStats() {
  const { data: salles, isLoading } = useApi<Salle[]>('/salles');
  const [selectedSalleId, setSelectedSalleId] = useState<string>('');

  const activeSalleId = selectedSalleId || salles?.[0]?.id;

  if (isLoading) return <p className="text-sm text-ink-400">Chargement...</p>;
  if (!salles || salles.length === 0) {
    return <p className="text-sm text-ink-400">Aucune salle pour l'instant.</p>;
  }

  return (
    <div>
      <div className="mb-6 max-w-xs">
        <Select value={activeSalleId} onChange={(e) => setSelectedSalleId(e.target.value)}>
          {salles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      {activeSalleId && <SalleStatsPanel salleId={activeSalleId} />}
    </div>
  );
}
