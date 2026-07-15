'use client';

import { useState } from 'react';
import { UserPlus, CheckCircle2, XCircle, PhoneCall } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/Input';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { SaasSubscriptionRequest } from '@/types';

const STATUS_FILTERS = [
  { value: '', label: 'Toutes' },
  { value: 'NOUVELLE', label: 'Nouvelles' },
  { value: 'CONTACTEE', label: 'Contactées' },
  { value: 'CONVERTIE', label: 'Converties' },
  { value: 'REJETEE', label: 'Rejetées' },
];

/**
 * §3.2, §9.5 — Demandes d'abonnement captées depuis le formulaire
 * "Demander une démo" du site vitrine GymCloud. Une demande n'est
 * jamais transformée automatiquement en compte propriétaire : on la
 * contacte, puis on crée le compte soi-même via "Propriétaires" →
 * "Nouveau propriétaire" une fois le contact établi — "Convertie" ici
 * ne fait que refléter ce constat dans le suivi, sans lien technique
 * avec le futur compte.
 */
export default function DemandesAbonnementPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [rejectingRequest, setRejectingRequest] = useState<SaasSubscriptionRequest | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const path = `/subscription-requests${statusFilter ? `?status=${statusFilter}` : ''}`;
  const { data: requests, isLoading, error, refetch } = useApi<SaasSubscriptionRequest[]>(path, [statusFilter]);

  const handleContacted = async (id: string) => {
    setActioningId(id);
    try {
      await apiClient.patch(`/subscription-requests/${id}/contacted`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setActioningId(null);
    }
  };

  const handleConverted = async (id: string) => {
    setActioningId(id);
    try {
      await apiClient.patch(`/subscription-requests/${id}/converted`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">Demandes d'abonnement</h1>
          <p className="mt-1 text-sm text-ink-400">
            Captées depuis le site vitrine — à rappeler pour finaliser l'inscription.
          </p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === f.value ? 'bg-primary-600 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-ink-50" />
            ))}
          </div>
        ) : error ? (
          <p className="p-5 text-sm text-red-600">{error}</p>
        ) : !requests || requests.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="h-6 w-6" />}
            title="Aucune demande"
            description="Apparaît ici dès que quelqu'un remplit le formulaire de demande d'abonnement sur le site vitrine."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase text-ink-400">
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Salle envisagée</th>
                <th className="px-5 py-3">Plan souhaité</th>
                <th className="px-5 py-3">Reçue le</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-ink-900">
                      {r.firstName} {r.lastName}
                    </p>
                    <p className="text-xs text-ink-400">
                      {r.phone}
                      {r.email && ` · ${r.email}`}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-ink-600">
                    {r.companyName ?? '—'}
                    {r.city && <span className="text-xs text-ink-400"> ({r.city})</span>}
                  </td>
                  <td className="px-5 py-3 text-ink-600">
                    {r.desiredPlan ? `${r.desiredPlan.name} — ${formatCurrency(r.desiredPlan.priceMonthly)}/mois` : '—'}
                  </td>
                  <td className="px-5 py-3 text-ink-600">{formatDateTime(r.createdAt)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    {(r.status === 'NOUVELLE' || r.status === 'CONTACTEE') && (
                      <div className="flex justify-end gap-2">
                        {r.status === 'NOUVELLE' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            isLoading={actioningId === r.id}
                            onClick={() => handleContacted(r.id)}
                          >
                            <PhoneCall className="h-3.5 w-3.5" />
                            Contactée
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          isLoading={actioningId === r.id}
                          onClick={() => handleConverted(r.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Convertie
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRejectingRequest(r)}>
                          <XCircle className="h-3.5 w-3.5" />
                          Rejeter
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {rejectingRequest && (
        <RejectRequestModal
          request={rejectingRequest}
          onClose={() => setRejectingRequest(null)}
          onRejected={() => {
            setRejectingRequest(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function RejectRequestModal({
  request,
  onClose,
  onRejected,
}: {
  request: SaasSubscriptionRequest;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!note.trim()) {
      setError('Un motif est requis');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/subscription-requests/${request.id}/rejected`, { note });
      onRejected();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Rejeter la demande — ${request.firstName} ${request.lastName}`}>
      <Field label="Motif">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: hors zone couverte, ne répond plus..." />
      </Field>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button onClick={handleSubmit} isLoading={isSubmitting} className="w-full">
        Confirmer
      </Button>
    </Modal>
  );
}
