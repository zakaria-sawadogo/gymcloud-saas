'use client';

import { useState, type FormEvent } from 'react';
import { Download, CalendarCheck, Wallet, Star } from 'lucide-react';
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
import type { AdherentAbonnement, AbonnementCatalogue, Booking, Payment, CoursCollectif, CoachForBooking } from '@/types';

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
  const { data: bookings, isLoading: loadingBookings, refetch: refetchBookings } = useApi<Booking[]>(`/bookings/adherent/${adherentId}`);
  const { data: payments, isLoading: loadingPayments } = useApi<Payment[]>(`/payments/adherent/${adherentId}`);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
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
          <div className="flex items-center justify-between p-5 pb-0">
            <CardHeader className="mb-0">
              <CardTitle>Réservations à venir</CardTitle>
            </CardHeader>
            <Button size="sm" onClick={() => setIsBookingOpen(true)}>
              Réserver
            </Button>
          </div>
          {loadingBookings ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-ink-50" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<CalendarCheck className="h-6 w-6" />} title="Aucune réservation à venir" />
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {upcoming.map((b) => (
                <div key={b.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-ink-900">
                    {b.coursCollectif?.name ?? 'Séance individuelle'}
                  </p>
                  <p className="text-xs text-ink-400">{formatDateTime(b.startAt)}</p>
                  {b.status !== 'CONFIRMEE' && (
                    <span className="mt-1 inline-block">
                      <StatusBadge status={b.status} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
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

      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        onBooked={() => {
          refetchBookings();
        }}
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

/**
 * §7.2, §7.4, §7.6 — Réserver depuis le web : rejoindre un cours
 * collectif déjà planifié, ou demander une séance personnalisée
 * (individuelle) avec le coach de son choix. Jusqu'ici, cette
 * capacité n'existait que côté mobile — l'adhérent connecté sur le
 * web n'avait aucun moyen de consulter le planning ni de réserver.
 */
function BookingModal({
  isOpen,
  onClose,
  onBooked,
}: {
  isOpen: boolean;
  onClose: () => void;
  onBooked: () => void;
}) {
  const [tab, setTab] = useState<'cours' | 'seance'>('cours');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Réserver">
      <div className="mb-4 flex gap-2 border-b border-ink-100">
        <button
          onClick={() => setTab('cours')}
          className={`px-3 py-2 text-sm font-medium ${tab === 'cours' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-ink-400'}`}
        >
          Cours collectifs
        </button>
        <button
          onClick={() => setTab('seance')}
          className={`px-3 py-2 text-sm font-medium ${tab === 'seance' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-ink-400'}`}
        >
          Séance personnalisée
        </button>
      </div>
      {tab === 'cours' ? <CoursCollectifsTab onBooked={onBooked} /> : <SeancePersonnaliseeTab onBooked={onBooked} />}
    </Modal>
  );
}

function CoursCollectifsTab({ onBooked }: { onBooked: () => void }) {
  const { user } = useAuth();
  const salleId = user?.salle?.id;
  const { data: cours, isLoading, refetch } = useApi<CoursCollectif[]>(
    salleId ? `/salles/${salleId}/cours-collectifs` : null,
  );
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const upcoming = (cours ?? [])
    .filter((c) => new Date(c.startAt) > new Date())
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const handleBook = async (c: CoursCollectif) => {
    setBookingId(c.id);
    setMessage(null);
    try {
      const res = await apiClient.post<{ status: string; position?: number }>(`/bookings/cours-collectifs/${c.id}`, {
        adherentId: user?.adherentId,
      });
      setMessage(
        res.status === 'LISTE_ATTENTE'
          ? `Cours complet — vous êtes en liste d'attente (position ${res.position})`
          : `Réservation confirmée pour "${c.name}"`,
      );
      refetch();
      onBooked();
    } catch (err) {
      setMessage(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setBookingId(null);
    }
  };

  if (isLoading) return <div className="py-8 text-center text-sm text-ink-400">Chargement...</div>;
  if (upcoming.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-400">Aucun cours prévu pour le moment.</p>;
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      {message && <p className="mb-3 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700">{message}</p>}
      <div className="space-y-2">
        {upcoming.map((c) => {
          const placesRestantes = c.capacity - (c._count?.bookings ?? 0);
          const isFull = placesRestantes <= 0;
          return (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-ink-900">{c.name}</p>
                <p className="text-xs text-ink-400">
                  {formatDateTime(c.startAt)}
                  {c.coach && ` · ${c.coach.user.firstName} ${c.coach.user.lastName}`}
                  {' · '}
                  {isFull ? 'Complet' : `${placesRestantes} place(s)`}
                </p>
              </div>
              <Button size="sm" isLoading={bookingId === c.id} onClick={() => handleBook(c)}>
                {isFull ? "File d'attente" : 'Réserver'}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SeancePersonnaliseeTab({ onBooked }: { onBooked: () => void }) {
  const { user } = useAuth();
  const salleId = user?.salle?.id;
  const { data: coachs, isLoading } = useApi<CoachForBooking[]>(
    salleId ? `/coachs/salle/${salleId}/for-booking` : null,
  );
  const [selectedCoach, setSelectedCoach] = useState<CoachForBooking | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequest = async () => {
    if (!selectedCoach || !date || !salleId) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const startAt = new Date(`${date}T${time}`);
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
      await apiClient.post(`/bookings/salle/${salleId}/seance-individuelle`, {
        adherentId: user?.adherentId,
        coachId: selectedCoach.id,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      });
      setMessage(`Demande envoyée à ${selectedCoach.firstName} — en attente de sa validation.`);
      setSelectedCoach(null);
      setDate('');
      onBooked();
    } catch (err) {
      setMessage(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="py-8 text-center text-sm text-ink-400">Chargement...</div>;
  if (!coachs || coachs.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-400">Aucun coach disponible pour une séance personnalisée.</p>;
  }

  if (selectedCoach) {
    return (
      <div>
        <button onClick={() => setSelectedCoach(null)} className="mb-3 text-sm text-primary-600 hover:underline">
          ← Choisir un autre coach
        </button>
        <p className="mb-3 text-sm font-medium text-ink-900">
          Séance avec {selectedCoach.firstName} {selectedCoach.lastName}
        </p>
        {selectedCoach.pricePerSession != null && (
          <p className="mb-3 text-xs text-ink-500">
            Tarif : {formatCurrency(selectedCoach.pricePerSession, selectedCoach.currency ?? 'XOF')}/séance — à régler
            une fois la demande validée par le coach, non inclus dans l&apos;abonnement.
          </p>
        )}
        <Field label="Date">
          <Input type="date" required min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Heure">
          <Input type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        {message && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}
        <Button onClick={handleRequest} isLoading={isSubmitting} disabled={!date} className="w-full">
          Envoyer la demande
        </Button>
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      {message && <p className="mb-3 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700">{message}</p>}
      <div className="space-y-2">
        {coachs.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCoach(c)}
            className="flex w-full items-center gap-3 rounded-lg border border-ink-100 px-3 py-2.5 text-left hover:bg-ink-50"
          >
            {c.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700">
                {c.firstName.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">
                {c.firstName} {c.lastName}
              </p>
              <p className="truncate text-xs text-ink-400">
                {c.specialties.join(', ')}
                {c.pricePerSession != null && ` · ${formatCurrency(c.pricePerSession, c.currency ?? 'XOF')}/séance`}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
