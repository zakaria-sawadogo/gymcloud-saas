'use client';

import { History, Download } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { tokenStorage } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { SaasSubscriptionHistoryEntry, SaasSubscriptionHistoryType } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

const TYPE_LABELS: Record<SaasSubscriptionHistoryType, string> = {
  SOUSCRIPTION_INITIALE: 'Souscription initiale',
  CHANGEMENT_PLAN: 'Changement de plan',
  REABONNEMENT: 'Réabonnement',
  RENOUVELLEMENT_AUTOMATIQUE: 'Renouvellement automatique',
  ESSAI_TERMINE: "Fin d'essai",
};

const TYPE_STYLES: Record<SaasSubscriptionHistoryType, string> = {
  SOUSCRIPTION_INITIALE: 'bg-primary-50 text-primary-700',
  CHANGEMENT_PLAN: 'bg-accent-50 text-accent-700',
  REABONNEMENT: 'bg-ink-100 text-ink-600',
  RENOUVELLEMENT_AUTOMATIQUE: 'bg-ink-100 text-ink-600',
  ESSAI_TERMINE: 'bg-primary-50 text-primary-700',
};

async function downloadInvoicePdf(invoiceId: string, invoiceNumber: string) {
  const token = tokenStorage.getAccessToken();
  const res = await fetch(`${API_URL}/saas/invoices/${invoiceId}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    alert('Téléchargement impossible');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `facture-${invoiceNumber}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * §9.6, §9.12 — Historique des abonnements et changements de plan.
 * Chaque ligne correspond à un événement qui a réellement démarré une
 * nouvelle période de facturation (jamais une simple demande encore
 * en attente de validation) — avec, systématiquement, la facture
 * associée téléchargeable, même à 0 XOF pendant un essai.
 */
export function SubscriptionHistoryTable({ apiPath }: { apiPath: string }) {
  const { data: history, isLoading } = useApi<SaasSubscriptionHistoryEntry[]>(apiPath);

  return (
    <Card className="p-0">
      <div className="p-5 pb-0">
        <CardHeader>
          <CardTitle>Historique des abonnements</CardTitle>
        </CardHeader>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-ink-50" />
          ))}
        </div>
      ) : !history || history.length === 0 ? (
        <EmptyState
          icon={<History className="h-6 w-6" />}
          title="Aucun historique pour l'instant"
          description="Chaque souscription initiale, changement de plan ou réabonnement apparaîtra ici, avec sa facture."
        />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase text-ink-400">
              <th className="px-5 py-3">Événement</th>
              <th className="px-5 py-3">Plan</th>
              <th className="px-5 py-3">Période</th>
              <th className="px-5 py-3">Facture</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {history.map((h) => (
              <tr key={h.id}>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TYPE_STYLES[h.type]}`}>
                    {TYPE_LABELS[h.type]}
                  </span>
                </td>
                <td className="px-5 py-3 text-ink-600">
                  {h.fromPlan && h.fromPlan.name !== h.toPlan.name ? (
                    <>
                      {h.fromPlan.name} → <span className="font-medium text-ink-900">{h.toPlan.name}</span>
                    </>
                  ) : (
                    <span className="font-medium text-ink-900">{h.toPlan.name}</span>
                  )}
                  <span className="ml-1 text-xs text-ink-400">({h.toBillingCycle === 'ANNUEL' ? 'annuel' : 'mensuel'})</span>
                </td>
                <td className="px-5 py-3 text-ink-600">
                  {formatDate(h.periodStart)} → {formatDate(h.periodEnd)}
                </td>
                <td className="px-5 py-3">
                  {h.invoice ? (
                    <div className="flex items-center gap-2">
                      <span className="text-ink-600">{formatCurrency(h.invoice.totalAmount, h.invoice.currency)}</span>
                      <StatusBadge status={h.invoice.status} />
                    </div>
                  ) : (
                    <span className="text-xs text-ink-400">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-ink-600">{formatDate(h.createdAt)}</td>
                <td className="px-5 py-3 text-right">
                  {h.invoice && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => downloadInvoicePdf(h.invoice!.id, h.invoice!.invoiceNumber)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
