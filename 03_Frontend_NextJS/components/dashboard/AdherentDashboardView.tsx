'use client';

import { useState, type FormEvent } from 'react';
import { Download, CalendarCheck, Wallet } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth-context';
import { apiClient, ApiClientError, tokenStorage } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { AdherentAbonnement, AbonnementCatalogue, Booking, Payment } from '@/types';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  ESPECES: 'Espèces (à la salle)',
  ORANGE_MONEY: 'Orange Money',
  MOOV_MONEY: 'Moov Money',
  WAVE: 'Wave',
};

/**
 * §4, §5, §7 — Espace adhérent côté web : jusqu'ici, aucun tableau de
 * bord n'existait pour ce rôle sur l'application web (page vide,
 * "Aucun tableau de bord disponible") — l'expérience adhérent était
 * entièrement mobile. Reprend les mêmes actions clés que l'app :
 * statut d'abonnement, réabonnement, carte, réservations à venir,
 * historique de paiements.
 */
export function AdherentDashboardView({ adherentId }: { adherentId: string }) {
  const { data: history, isLoading: loadingHistory } = useApi<AdherentAbonnement[]>(`/adherents/${adherentId}/history`);
  const { data: bookings, isLoading: loadingBookings } = useApi<Booking[]>(`/bookings/adherent/${adherentId}`);
  const { data: payments, isLoading: loadingPayments } = useApi<Payment[]>(`/payments/adherent/${adherentId}`);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const currentSubscription = history?.find((h) => h.status === 'ACTIF' || h.status === 'EN_GRACE');
  const upcoming = (bookings ?? [])
    .filter((b) => b.status === 'CONFIRMEE' && new Date(b.startAt) > new Date())
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const handleDownloadCard = async () => {
    setIsDownloading(true);
    try {
      const token = tokenStorage.getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/adherents/${adherentId}/card`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Téléchargement impossible');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'carte-membre.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Impossible de télécharger la carte pour le moment');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-semibold text-ink-900">Mon espace</h1>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mon abonnement</CardTitle>
          </CardHeader>
          {loadingHistory ? (
            <div className="h-16 animate-pulse rounded-lg bg-ink-50" />
          ) : currentSubscription ? (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="font-medium text-ink-900">{currentSubscription.abonnementCatalogue?.name ?? 'Abonnement'}</p>
                <StatusBadge status={currentSubscription.status} />
              </div>
              <p className="text-sm text-ink-500">Jusqu'au {formatDate(currentSubscription.endDate)}</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => setIsRenewOpen(true)}>
                  Se réabonner par avance
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-sm text-ink-500">Aucun abonnement actif pour le moment.</p>
              <Button size="sm" onClick={() => setIsRenewOpen(true)}>
                Se réabonner
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ma carte de membre</CardTitle>
          </CardHeader>
          <p className="mb-3 text-sm text-ink-500">
            Contient votre QR code personnel, à présenter à l'entrée ou à scanner depuis l'app mobile.
          </p>
          <Button size="sm" variant="secondary" onClick={handleDownloadCard} isLoading={isDownloading}>
            <Download className="h-3.5 w-3.5" />
            Télécharger ma carte
          </Button>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-0">
          <div className="p-5 pb-0">
            <CardHeader>
              <CardTitle>Réservations à venir</CardTitle>
            </CardHeader>
          </div>
          {loadingBookings ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-ink-50" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <EmptyState icon={<CalendarCheck className="h-6 w-6" />} title="Aucune réservation à venir" />
          ) : (
            <div className="divide-y divide-ink-100">
              {upcoming.map((b) => (
                <div key={b.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-ink-900">
                    {b.coursCollectif?.name ?? 'Séance individuelle'}
                  </p>
                  <p className="text-xs text-ink-400">{formatDateTime(b.startAt)}</p>
                </div>
              ))}
            </div>
          )}
          <p className="border-t border-ink-100 px-5 py-3 text-xs text-ink-400">
            Réservez un cours ou une séance personnalisée depuis l'application mobile.
          </p>
        </Card>

        <Card className="p-0">
          <div className="p-5 pb-0">
            <CardHeader>
              <CardTitle>Derniers paiements</CardTitle>
            </CardHeader>
          </div>
          {loadingPayments ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-ink-50" />
              ))}
            </div>
          ) : !payments || payments.length === 0 ? (
            <EmptyState icon={<Wallet className="h-6 w-6" />} title="Aucun paiement enregistré" />
          ) : (
            <div className="divide-y divide-ink-100">
              {payments.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{formatCurrency(p.amount, p.currency)}</p>
                    <p className="text-xs text-ink-400">{formatDate(p.createdAt)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <RenewSubscriptionModal
        isOpen={isRenewOpen}
        onClose={() => setIsRenewOpen(false)}
        onDone={() => setIsRenewOpen(false)}
      />
    </div>
  );
}

function RenewSubscriptionModal({
  isOpen,
  onClose,
  onDone,
}: {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const salleId = user?.salle?.id;
  const { data: catalogue } = useApi<AbonnementCatalogue[]>(
    isOpen && salleId ? `/salles/${salleId}/abonnement-catalogue` : null,
  );
  const [catalogueId, setCatalogueId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('ESPECES');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post('/adherents/me/request-subscription', {
        abonnementCatalogueId: catalogueId,
        paymentMethod,
        phoneNumber: paymentMethod !== 'ESPECES' ? phoneNumber : undefined,
      });
      setIsDone(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setIsDone(false);
        setCatalogueId('');
        onClose();
      }}
      title="Se réabonner"
    >
      {isDone ? (
        <div className="text-center">
          <p className="mb-4 text-sm text-ink-600">
            Demande envoyée. La salle va confirmer votre paiement et activer votre abonnement.
          </p>
          <Button onClick={onDone} className="w-full">
            Fermer
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <Field label="Formule">
            <Select required value={catalogueId} onChange={(e) => setCatalogueId(e.target.value)}>
              <option value="">Sélectionner une formule</option>
              {(catalogue ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {formatCurrency(c.price, c.currency)} ({c.durationDays} jours)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Moyen de paiement">
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          {paymentMethod !== 'ESPECES' && (
            <Field label="Numéro Mobile Money">
              <Input required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
            </Field>
          )}

          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button type="submit" isLoading={isSubmitting} disabled={!catalogueId} className="w-full">
            Envoyer la demande
          </Button>
        </form>
      )}
    </Modal>
  );
}
