'use client';

import { useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, RotateCcw } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { StatCard } from './StatCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';

interface RevenueReport {
  total: number;
  transactionCount: number;
  byMethod: Record<string, number>;
  byDay: Record<string, number>;
}

interface OccupancyReport {
  totalVisits: number;
  byDay: Record<string, number>;
}

interface RetentionReport {
  totalAdherents: number;
  adherentsActifs: number;
  adherentsExpires: number;
  tauxRetentionApproximatif: number | null;
  nombreDeReabonnements: number;
}

const METHOD_LABELS: Record<string, string> = {
  ESPECES: 'Espèces',
  ORANGE_MONEY: 'Orange Money',
  MOOV_MONEY: 'Moov Money',
  WAVE: 'Wave',
};

/** Transforme un Record<jour, valeur> en tableau trié, prêt pour recharts. */
function toSeries(byDay: Record<string, number>): Array<{ date: string; value: number }> {
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date: date.slice(5), value })); // "MM-JJ" pour l'axe
}

/**
 * §11 — Statistiques détaillées d'une salle sur les 30 derniers jours :
 * revenus (courbe + répartition par moyen de paiement), fréquentation,
 * rétention. Utilisé par Gestionnaire (sa propre salle) et Propriétaire
 * (salle sélectionnée) — mêmes endpoints, mêmes vérifications
 * d'appartenance déjà en place côté API.
 */
export function SalleStatsPanel({ salleId }: { salleId: string }) {
  const { from, to } = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const { data: revenue, isLoading: loadingRevenue } = useApi<RevenueReport>(
    `/reporting/salle/${salleId}/revenue?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  const { data: occupancy, isLoading: loadingOccupancy } = useApi<OccupancyReport>(
    `/reporting/salle/${salleId}/occupancy?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  const { data: retention, isLoading: loadingRetention } = useApi<RetentionReport>(
    `/reporting/salle/${salleId}/retention`,
  );

  const revenueSeries = revenue ? toSeries(revenue.byDay) : [];
  const occupancySeries = occupancy ? toSeries(occupancy.byDay) : [];

  return (
    <div className="space-y-6">
      <p className="text-xs text-ink-400">Période : 30 derniers jours</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Revenus (30 jours)"
          value={revenue ? formatCurrency(revenue.total) : '—'}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="primary"
        />
        <StatCard
          label="Visites (30 jours)"
          value={occupancy?.totalVisits ?? '—'}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Taux de rétention"
          value={retention?.tauxRetentionApproximatif != null ? `${(retention.tauxRetentionApproximatif * 100).toFixed(1)}%` : '—'}
          icon={<RotateCcw className="h-5 w-5" />}
          accent={retention && retention.tauxRetentionApproximatif !== null && retention.tauxRetentionApproximatif > 0.8 ? 'primary' : 'accent'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenus par jour</CardTitle>
        </CardHeader>
        {loadingRevenue ? (
          <div className="h-64 animate-pulse rounded-lg bg-ink-50" />
        ) : revenueSeries.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">Aucun paiement validé sur cette période.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={revenueSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7E8" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Line type="monotone" dataKey="value" stroke="#0F6E56" strokeWidth={2} dot={false} name="Revenus" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fréquentation par jour</CardTitle>
        </CardHeader>
        {loadingOccupancy ? (
          <div className="h-64 animate-pulse rounded-lg bg-ink-50" />
        ) : occupancySeries.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">Aucune visite enregistrée sur cette période.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={occupancySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7E8" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#2E75B6" name="Visites" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenus par moyen de paiement</CardTitle>
          </CardHeader>
          {revenue && Object.keys(revenue.byMethod).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(revenue.byMethod).map(([method, amount]) => (
                <div key={method} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-800">{METHOD_LABELS[method] ?? method}</span>
                  <span className="font-display text-sm font-semibold text-ink-900">{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-ink-400">Aucune donnée.</p>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adhérents & rétention</CardTitle>
          </CardHeader>
          {loadingRetention || !retention ? (
            <div className="h-24 animate-pulse rounded-lg bg-ink-50" />
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-600">Total adhérents</span>
                <span className="font-medium text-ink-900">{retention.totalAdherents}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-600">Actifs</span>
                <span className="font-medium text-ink-900">{retention.adherentsActifs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-600">Expirés</span>
                <span className="font-medium text-ink-900">{retention.adherentsExpires}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-600">Réabonnements (total)</span>
                <span className="font-medium text-ink-900">{retention.nombreDeReabonnements}</span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
