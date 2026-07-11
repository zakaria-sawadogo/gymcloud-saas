'use client';

import { useState } from 'react';
import { CheckCircle2, Receipt } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { SaasInvoice } from '@/types';

const STATUS_FILTERS = [
  { value: '', label: 'Toutes' },
  { value: 'EMISE', label: 'En attente' },
  { value: 'PAYEE', label: 'Payées' },
  { value: 'EN_RETARD', label: 'En retard' },
];

/**
 * §9.13 — Facturation SaaS : GymCloud facture ses propriétaires
 * (distinct des paiements adhérent → salle, gérés par ailleurs). Les
 * factures sont générées automatiquement par le moteur SaaS
 * (abonnement mensuel/annuel + salles supplémentaires) ; cette page
 * permet au SUPER_ADMIN de les consulter et de constater leur
 * règlement (viré hors plateforme à ce niveau B2B).
 */
export default function FacturationSaasPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  const { data: invoices, isLoading, error, refetch } = useApi<SaasInvoice[]>(
    `/saas/invoices${statusFilter ? `?status=${statusFilter}` : ''}`,
    [statusFilter],
  );

  const handleMarkPaid = async (invoiceId: string) => {
    setMarkingPaidId(invoiceId);
    try {
      await apiClient.patch(`/saas/invoices/${invoiceId}/mark-paid`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setMarkingPaidId(null);
    }
  };

  const totalEnAttente = (invoices ?? [])
    .filter((i) => i.status === 'EMISE')
    .reduce((sum, i) => sum + Number(i.totalAmount), 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Facturation SaaS</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-ink-100 bg-white px-3 text-sm outline-none focus:border-primary-400"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {totalEnAttente > 0 && (
        <Card className="mb-6">
          <p className="mb-1 text-sm text-ink-400">Total en attente de règlement</p>
          <p className="font-display text-2xl font-semibold text-accent-600">
            {formatCurrency(totalEnAttente)}
          </p>
        </Card>
      )}

      <Card className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-ink-50" />
            ))}
          </div>
        ) : error ? (
          <p className="p-5 text-sm text-red-600">{error}</p>
        ) : !invoices || invoices.length === 0 ? (
          <EmptyState icon={<Receipt className="h-6 w-6" />} title="Aucune facture SaaS pour ce filtre" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase text-ink-400">
                <th className="px-5 py-3">N° Facture</th>
                <th className="px-5 py-3">Propriétaire</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Période</th>
                <th className="px-5 py-3">Montant</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-5 py-3 font-mono text-xs text-ink-600">{inv.invoiceNumber}</td>
                  <td className="px-5 py-3 font-medium text-ink-900">
                    {inv.subscription.proprietaire.user.firstName} {inv.subscription.proprietaire.user.lastName}
                  </td>
                  <td className="px-5 py-3 text-ink-600">{inv.subscription.saasPlan.name}</td>
                  <td className="px-5 py-3 text-ink-600">
                    {formatDate(inv.periodStart)} → {formatDate(inv.periodEnd)}
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-medium text-ink-900">{formatCurrency(inv.totalAmount, inv.currency)}</span>
                    {inv.extraSallesCount > 0 && (
                      <span className="ml-1 text-xs text-ink-400">
                        (dont {inv.extraSallesCount} salle{inv.extraSallesCount > 1 ? 's' : ''} suppl.)
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    {inv.status === 'EMISE' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        isLoading={markingPaidId === inv.id}
                        onClick={() => handleMarkPaid(inv.id)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Marquer payée
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
