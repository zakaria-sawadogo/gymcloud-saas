'use client';

import { useState } from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDateTime } from '@/lib/utils';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  ESPECES: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  CARTE: 'Carte',
};

interface ClosingStatus {
  isClosed: boolean;
  closing: {
    id: string;
    totalAmount: number;
    byMethodJson: Record<string, number>;
    salesCount: number;
    closedAt: string;
    closedBy: { firstName: string; lastName: string };
  } | null;
}

interface Closing {
  id: string;
  businessDate: string;
  totalAmount: number;
  byMethodJson: Record<string, number>;
  salesCount: number;
  closedAt: string;
  closedBy: { firstName: string; lastName: string };
}

/**
 * §14.x — Clôture de caisse boutique : contrairement à la synthèse
 * "Caisse" (recalculée à la volée, consultable n'importe quand), la
 * clôture fige l'état du jour une fois pour toutes — un clic,
 * impossible de re-clôturer la même journée (le bouton se change en
 * état "déjà clôturée" avec qui et quand). L'historique en dessous
 * sert au suivi du propriétaire.
 */
export function CaisseClosureCard({
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
    error: statusError,
    refetch,
  } = useApi<ClosingStatus>(`/salles/${salleId}/boutique/caisse/today-status`);
  const { data: closings } = useApi<Closing[]>(`/salles/${salleId}/boutique/caisse/closings`);

  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClose = async () => {
    setIsClosing(true);
    setError(null);
    try {
      await apiClient.post(`/salles/${salleId}/boutique/caisse/close`, {});
      setShowConfirm(false);
      refetch();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Erreur lors de la clôture');
    } finally {
      setIsClosing(false);
    }
  };

  // §14.x — utilisée aussi sur la page Clôture du propriétaire, où
  // une salle sans l'add-on boutique actif ne doit pas afficher une
  // erreur — juste ne rien montrer, silencieusement (l'add-on est
  // optionnel, contrairement aux paiements toujours actifs).
  if (statusError) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Clôture du jour</CardTitle>
        </CardHeader>

        {isLoading ? (
          <div className="h-16 animate-pulse rounded-lg bg-ink-50" />
        ) : status?.isClosed && status.closing ? (
          <div className="flex items-start gap-3 rounded-lg bg-primary-50 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary-600" />
            <div>
              <p className="text-sm font-medium text-ink-900">
                Journée clôturée — {formatCurrency(status.closing.totalAmount, currency)} (
                {status.closing.salesCount} vente{status.closing.salesCount > 1 ? 's' : ''})
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
                Clôturer la journée
              </Button>
            ) : (
              <div className="rounded-lg border border-ink-200 p-4">
                <p className="mb-3 text-sm text-ink-700">
                  Cette action fige l&apos;état de la caisse du jour et ne peut pas être annulée. Confirmer ?
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
                    {c.closedBy.firstName} {c.closedBy.lastName} · {c.salesCount} vente
                    {c.salesCount > 1 ? 's' : ''}
                    {Object.entries(c.byMethodJson).length > 0 && (
                      <>
                        {' · '}
                        {Object.entries(c.byMethodJson)
                          .map(([m, amt]) => `${PAYMENT_METHOD_LABELS[m] ?? m}: ${formatCurrency(amt, currency)}`)
                          .join(', ')}
                      </>
                    )}
                  </p>
                </div>
                <span className="whitespace-nowrap text-sm font-semibold text-ink-900">
                  {formatCurrency(c.totalAmount, currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
