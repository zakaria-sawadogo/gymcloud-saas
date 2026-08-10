'use client';

import { useState } from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDateTime } from '@/lib/utils';

interface PaymentsClosingStatus {
  isClosed: boolean;
  closing: {
    id: string;
    cashAmount: number;
    mobileMoneyAmount: number;
    paymentsCount: number;
    closedAt: string;
    closedBy: { firstName: string; lastName: string };
  } | null;
}

interface Closing {
  id: string;
  businessDate: string;
  cashAmount: number;
  mobileMoneyAmount: number;
  paymentsCount: number;
  closedAt: string;
  closedBy: { firstName: string; lastName: string };
}

/**
 * §14.x — Clôture des paiements d'abonnements en espèces du jour —
 * même principe que CaisseClosureCard (boutique), mais pour les
 * paiements d'abonnements adhérents. Volontairement limitée aux
 * espèces : le Mobile Money est déjà tracé numériquement.
 */
export function PaymentsClosureCard({
  salleId,
  currency,
  canClose,
}: {
  salleId: string;
  currency: string;
  canClose: boolean;
}) {
  const {
    data: status,
    isLoading,
    refetch,
  } = useApi<PaymentsClosingStatus>(`/payments/salle/${salleId}/caisse/today-status`);
  const { data: closings } = useApi<Closing[]>(`/payments/salle/${salleId}/caisse/closings`);

  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClose = async () => {
    setIsClosing(true);
    setError(null);
    try {
      await apiClient.post(`/payments/salle/${salleId}/caisse/close`, {});
      setShowConfirm(false);
      refetch();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Erreur lors de la clôture');
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Clôture des paiements du jour</CardTitle>
      </CardHeader>

      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-ink-50" />
      ) : status?.isClosed && status.closing ? (
        <div className="flex items-start gap-3 rounded-lg bg-primary-50 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-primary-600" />
          <div>
            <p className="text-sm font-medium text-ink-900">
              Paiements clôturés — {formatCurrency(status.closing.cashAmount, currency)} en espèces (
              {status.closing.paymentsCount} paiement{status.closing.paymentsCount > 1 ? 's' : ''})
            </p>
            <p className="text-xs text-ink-500">
              Par {status.closing.closedBy.firstName} {status.closing.closedBy.lastName} à{' '}
              {formatDateTime(status.closing.closedAt)}
            </p>
          </div>
        </div>
      ) : canClose ? (
        <>
          {!showConfirm ? (
            <Button onClick={() => setShowConfirm(true)}>
              <Lock className="h-4 w-4" />
              Clôturer les paiements du jour
            </Button>
          ) : (
            <div className="rounded-lg border border-ink-200 p-4">
              <p className="mb-3 text-sm text-ink-700">
                Cette action fige l&apos;état des paiements en espèces du jour et ne peut pas être annulée.
                Confirmer ?
              </p>
              {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <Button onClick={handleClose} isLoading={isClosing}>
                  Confirmer la clôture
                </Button>
                <Button variant="secondary" onClick={() => setShowConfirm(false)} disabled={isClosing}>
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-400">Aucune clôture pour aujourd&apos;hui.</p>
      )}
    </Card>

      <Card className="p-0">
        <div className="p-5 pb-0">
          <CardHeader>
            <CardTitle>Historique des clôtures</CardTitle>
          </CardHeader>
        </div>
        {!closings || closings.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<Lock className="h-6 w-6" />} title="Aucune clôture pour le moment" />
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {closings.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    {new Date(c.businessDate).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </p>
                  <p className="text-xs text-ink-400">
                    {c.closedBy.firstName} {c.closedBy.lastName} · {c.paymentsCount} paiement
                    {c.paymentsCount > 1 ? 's' : ''}
                  </p>
                </div>
                <span className="whitespace-nowrap text-sm font-semibold text-ink-900">
                  {formatCurrency(c.cashAmount, currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
