'use client';

import { useState, type FormEvent } from 'react';
import { Plus, CalendarCheck, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { formatDateTime } from '@/lib/utils';
import type { CoursCollectif, AdherentProfile } from '@/types';

interface CoachOption {
  id: string;
  user: { firstName: string; lastName: string };
}

const DAY_OPTIONS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
  { value: 7, label: 'Dim' },
];

export default function BookingsPage() {
  const { user } = useAuth();
  const salleId = user?.salle?.id;
  const isCoach = user?.roleCode === 'COACH';
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [bookingTarget, setBookingTarget] = useState<CoursCollectif | null>(null);

  const { data: cours, isLoading, refetch } = useApi<CoursCollectif[]>(
    salleId ? `/salles/${salleId}/cours-collectifs` : null,
  );
  // Un coach n'a pas le droit de lister les autres coachs (§2.2) — il
  // n'en a de toute façon pas besoin, il ne peut planifier qu'en son
  // propre nom (restriction vérifiée côté service).
  const { data: coachs } = useApi<CoachOption[]>(salleId && !isCoach ? `/coachs/salle/${salleId}` : null);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Réservations</h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Planifier un cours
        </Button>
      </div>

      <Card className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-ink-50" />
            ))}
          </div>
        ) : !cours || cours.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck className="h-6 w-6" />}
            title="Aucun cours planifié"
            description="Créez un cours collectif pour commencer à recevoir des réservations."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase text-ink-400">
                <th className="px-5 py-3">Cours</th>
                <th className="px-5 py-3">Coach</th>
                <th className="px-5 py-3">Horaire</th>
                <th className="px-5 py-3">Places</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {cours.map((c) => {
                const booked = c._count?.bookings ?? 0;
                const isFull = booked >= c.capacity;
                return (
                  <tr key={c.id}>
                    <td className="px-5 py-3 font-medium text-ink-900">{c.name}</td>
                    <td className="px-5 py-3 text-ink-600">
                      {c.coach ? `${c.coach.user.firstName} ${c.coach.user.lastName}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-ink-600">{formatDateTime(c.startAt)}</td>
                    <td className="px-5 py-3">
                      <span className={isFull ? 'font-medium text-accent-600' : 'text-ink-600'}>
                        {booked}/{c.capacity}
                        {isFull && ' (complet)'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setBookingTarget(c)}>
                        <Users className="h-3.5 w-3.5" />
                        Réserver
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {salleId && (
        <CreateCoursModal
          salleId={salleId}
          coachs={coachs ?? []}
          ownCoach={isCoach && user?.coachId ? { id: user.coachId, name: `${user.firstName} ${user.lastName}` } : null}
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false);
            refetch();
          }}
        />
      )}

      {bookingTarget && salleId && (
        <BookAdherentModal
          cours={bookingTarget}
          salleId={salleId}
          onClose={() => setBookingTarget(null)}
          onBooked={() => {
            setBookingTarget(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function CreateCoursModal({
  salleId,
  coachs,
  ownCoach,
  isOpen,
  onClose,
  onCreated,
}: {
  salleId: string;
  coachs: CoachOption[];
  ownCoach: { id: string; name: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [coachId, setCoachId] = useState(ownCoach?.id ?? '');
  const [capacity, setCapacity] = useState('15');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [recurrenceWeeks, setRecurrenceWeeks] = useState('8');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ occurrencesGenerated: number }>(`/salles/${salleId}/cours-collectifs`, {
        name,
        coachId,
        capacity: Number(capacity),
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        recurring,
        daysOfWeek: recurring && daysOfWeek.length > 0 ? daysOfWeek : undefined,
        recurrenceWeeks: recurring ? Number(recurrenceWeeks) : undefined,
      });
      if (res.occurrencesGenerated > 1) {
        setSuccessMessage(`${res.occurrencesGenerated} séances créées sur les prochaines semaines.`);
        setTimeout(onCreated, 1200);
      } else {
        onCreated();
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Planifier un cours collectif">
      <form onSubmit={handleSubmit}>
        <Field label="Nom du cours">
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Zumba, CrossFit..." />
        </Field>
        <Field label="Coach">
          {ownCoach ? (
            <Input value={ownCoach.name} disabled />
          ) : (
            <Select required value={coachId} onChange={(e) => setCoachId(e.target.value)}>
              <option value="">Sélectionner un coach</option>
              {coachs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.user.firstName} {c.user.lastName}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Capacité">
          <Input type="number" min="1" required value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </Field>
        <Field label="Début">
          <Input type="datetime-local" required value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </Field>
        <Field label="Fin">
          <Input type="datetime-local" required value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        </Field>

        <label className="mb-3 flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
          Cours récurrent (se répète chaque semaine)
        </label>

        {recurring && (
          <>
            <Field label="Jours de répétition">
              <div className="flex flex-wrap gap-1.5">
                {DAY_OPTIONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      daysOfWeek.includes(d.value)
                        ? 'bg-primary-600 text-white'
                        : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-400">
                Le jour de la date de début est toujours inclus, même s&apos;il n&apos;est pas coché ci-dessus.
              </p>
            </Field>
            <Field label="Nombre de semaines à générer">
              <Input
                type="number"
                min="1"
                max="26"
                value={recurrenceWeeks}
                onChange={(e) => setRecurrenceWeeks(e.target.value)}
              />
            </Field>
          </>
        )}

        {successMessage && (
          <p className="mb-4 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700">{successMessage}</p>
        )}
        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Planifier
        </Button>
      </form>
    </Modal>
  );
}

function BookAdherentModal({
  cours,
  salleId,
  onClose,
  onBooked,
}: {
  cours: CoursCollectif;
  salleId: string;
  onClose: () => void;
  onBooked: () => void;
}) {
  const { data: adherents } = useApi<AdherentProfile[]>(`/adherents/salle/${salleId}?status=ACTIF`);
  const [selected, setSelected] = useState('');
  const [result, setResult] = useState<{ status: string; position?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selected) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ status: string; position?: number }>(
        `/bookings/cours-collectifs/${cours.id}`,
        { adherentId: selected },
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Réserver — ${cours.name}`}>
      {result ? (
        <div className="text-center">
          {result.status === 'LISTE_ATTENTE' ? (
            <p className="rounded-lg bg-accent-50 px-3 py-3 text-sm text-accent-700">
              Cours complet — adhérent placé en liste d'attente, position n°{result.position}.
            </p>
          ) : (
            <p className="rounded-lg bg-primary-50 px-3 py-3 text-sm text-primary-700">
              Réservation confirmée !
            </p>
          )}
          <Button onClick={onBooked} className="mt-4 w-full">
            Fermer
          </Button>
        </div>
      ) : (
        <>
          <Field label="Adhérent">
            <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Sélectionner un adhérent</option>
              {(adherents ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.user.firstName} {a.user.lastName} ({a.memberCode})
                </option>
              ))}
            </Select>
          </Field>

          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button onClick={handleSubmit} disabled={!selected} isLoading={isSubmitting} className="w-full">
            Confirmer la réservation
          </Button>
        </>
      )}
    </Modal>
  );
}
