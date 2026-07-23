'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, CalendarCheck } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/utils';
import type { Booking } from '@/types';

/**
 * Planning du coach côté web (§7.11) — équivalent de
 * PlanningScreen.dart côté mobile. Manquait entièrement : le menu
 * proposait "Mon planning" pour ce rôle sans qu'aucune vue ne soit
 * jamais construite derrière.
 */
export function CoachPlanningView({ coachId }: { coachId: string }) {
  const [actioningId, setActioningId] = useState<string | null>(null);
  const { data: bookings, isLoading, error, refetch } = useApi<Booking[]>(`/bookings/coach/${coachId}`);

  const handleAttendance = async (bookingId: string, present: boolean) => {
    setActioningId(bookingId);
    try {
      await apiClient.patch(`/bookings/${bookingId}/${present ? 'attendance' : 'absence'}`);
      refetch();
    } catch (err) {
      // Erreur silencieuse acceptable ici — le statut affiché ne change
      // simplement pas, l'utilisateur peut réessayer.
      console.error(err instanceof ApiClientError ? err.message : err);
    } finally {
      setActioningId(null);
    }
  };

  const handleApprove = async (bookingId: string) => {
    setActioningId(bookingId);
    try {
      await apiClient.patch(`/bookings/${bookingId}/approve-seance`);
      refetch();
    } catch (err) {
      console.error(err instanceof ApiClientError ? err.message : err);
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    if (!confirm('Refuser cette demande de séance ?')) return;
    setActioningId(bookingId);
    try {
      await apiClient.patch(`/bookings/${bookingId}/reject-seance`);
      refetch();
    } catch (err) {
      console.error(err instanceof ApiClientError ? err.message : err);
    } finally {
      setActioningId(null);
    }
  };

  const sorted = [...(bookings ?? [])].sort((a, b) => a.startAt.localeCompare(b.startAt));
  // §7.7 — Demandes de séance individuelle initiées par l'adhérent
  // depuis l'app mobile, pas encore validées par le coach.
  const pendingRequests = sorted.filter((b) => b.type === 'SEANCE_INDIVIDUELLE' && b.status === 'EN_ATTENTE');
  const upcoming = sorted.filter((b) => b.status === 'CONFIRMEE' && new Date(b.startAt) > new Date());
  const past = sorted.filter((b) => !upcoming.includes(b) && !pendingRequests.includes(b));

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-semibold text-ink-900">Mon planning</h1>

      {pendingRequests.length > 0 && (
        <Card className="mb-6 p-0">
          <div className="p-5 pb-0">
            <CardHeader>
              <CardTitle>Demandes de séance individuelle à valider</CardTitle>
            </CardHeader>
          </div>
          <div className="divide-y divide-ink-100">
            {pendingRequests.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    {b.adherent ? `${b.adherent.user.firstName} ${b.adherent.user.lastName}` : 'Adhérent'}
                  </p>
                  <p className="text-xs text-ink-400">{formatDateTime(b.startAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    isLoading={actioningId === b.id}
                    onClick={() => handleApprove(b.id)}
                  >
                    Valider
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    isLoading={actioningId === b.id}
                    onClick={() => handleReject(b.id)}
                  >
                    <XCircle className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-0">
        <div className="p-5 pb-0">
          <CardHeader>
            <CardTitle>Séances</CardTitle>
          </CardHeader>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-ink-50" />
            ))}
          </div>
        ) : error ? (
          <p className="p-5 text-sm text-red-600">{error}</p>
        ) : sorted.length === 0 ? (
          <EmptyState icon={<CalendarCheck className="h-6 w-6" />} title="Aucune séance planifiée" />
        ) : (
          <div className="divide-y divide-ink-100">
            {[...upcoming, ...past].map((b) => {
              const canPoint =
                b.status === 'CONFIRMEE' &&
                new Date(b.startAt).getTime() < Date.now() + 60 * 60 * 1000; // ouvre 1h avant

              return (
                <div key={b.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink-900">
                      {b.coursCollectif?.name ?? 'Séance individuelle'}
                      {b.adherent && (
                        <span className="ml-2 text-ink-400">
                          — {b.adherent.user.firstName} {b.adherent.user.lastName}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-ink-400">{formatDateTime(b.startAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={b.status} />
                    {canPoint && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          isLoading={actioningId === b.id}
                          onClick={() => handleAttendance(b.id, true)}
                          aria-label="Présent"
                        >
                          <CheckCircle2 className="h-4 w-4 text-primary-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          isLoading={actioningId === b.id}
                          onClick={() => handleAttendance(b.id, false)}
                          aria-label="Absent"
                        >
                          <XCircle className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
