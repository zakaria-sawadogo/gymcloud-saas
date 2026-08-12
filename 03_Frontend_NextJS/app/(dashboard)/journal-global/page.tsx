'use client';

import { useState } from 'react';
import { History, Mail } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatDateTime } from '@/lib/utils';
import type { Salle } from '@/types';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string; roleId: string } | null;
  salle: { name: string } | null;
}

interface AuditLogResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// §14.x — même liste que le journal d'activité propriétaire (pas
// exhaustive sur les 80+ actions du système), plus quelques actions
// plateforme/SaaS visibles uniquement ici (jamais salle-scopées).
const ACTION_LABELS: Record<string, string> = {
  'adherent.create': 'Nouvel adhérent créé',
  'adherent.update': 'Fiche adhérent modifiée',
  'adherent.suspend': 'Adhérent suspendu',
  'adherent.reactivate': 'Adhérent réactivé',
  'payment.cash_recorded': 'Paiement espèces encaissé',
  'payment.mobile_money_confirmed': 'Paiement Mobile Money confirmé',
  'product_sale.create': 'Vente boutique enregistrée',
  'booking.create': 'Réservation créée',
  'booking.cancel': 'Réservation annulée',
  'expense.create': 'Dépense enregistrée',
  'gestionnaire.create': 'Gestionnaire ajouté',
  'salle.create': 'Salle créée',
  'salle.settings_update': 'Paramètres de la salle modifiés',
  'saas_plan.tarif_update': 'Tarif de plan SaaS modifié',
  'saas_subscription_request.converted': "Demande d'abonnement convertie",
  'saas_subscription_request.rejected': "Demande d'abonnement rejetée",
  'proprietaire.create': 'Propriétaire créé',
  'api_credential.set': 'Identifiant marchand configuré',
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, ' ');
}

export default function JournalGlobalPage() {
  const { data: salles } = useApi<Salle[]>('/salles');
  const [selectedSalleId, setSelectedSalleId] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [page, setPage] = useState(1);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const sinceDate = (() => {
    if (period === 'all') return null;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (period === '7d') d.setDate(d.getDate() - 6);
    if (period === '30d') d.setDate(d.getDate() - 29);
    return d;
  })();

  const queryParams = new URLSearchParams();
  if (selectedSalleId) queryParams.set('salleId', selectedSalleId);
  if (selectedAction) queryParams.set('action', selectedAction);
  if (sinceDate) queryParams.set('since', sinceDate.toISOString());
  queryParams.set('page', String(page));

  const { data: log, isLoading: isLoadingLog } = useApi<AuditLogResponse>(
    `/reporting/admin/audit-logs?${queryParams.toString()}`,
    [selectedSalleId, selectedAction, period, page],
  );

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink-900">Journal global</h1>
      <p className="mb-6 text-sm text-ink-500">
        Toutes les salles confondues — usage support. Pour le journal d'une salle précise, filtrez ci-dessous.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-ink-200">
          {(
            [
              ['today', "Aujourd'hui"],
              ['7d', '7 jours'],
              ['30d', '30 jours'],
              ['all', 'Tout'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setPeriod(key);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-sm ${period === key ? 'bg-primary-600 text-white' : 'text-ink-600 hover:bg-ink-50'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <Select
          className="max-w-xs"
          value={selectedSalleId}
          onChange={(e) => {
            setSelectedSalleId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Toutes les salles</option>
          {(salles ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>

        <Select
          className="max-w-xs"
          value={selectedAction}
          onChange={(e) => {
            setSelectedAction(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Toutes les actions</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <Button variant="secondary" size="sm" onClick={() => setIsEmailModalOpen(true)}>
          <Mail className="h-4 w-4" />
          Envoyer par e-mail
        </Button>
      </div>

      <Card className="p-0">
        <div className="p-5 pb-0">
          <CardHeader>
            <CardTitle>Historique {log ? `(${log.total} entrée${log.total > 1 ? 's' : ''})` : ''}</CardTitle>
          </CardHeader>
        </div>

        {isLoadingLog ? (
          <div className="m-5 h-40 animate-pulse rounded-xl bg-ink-50" />
        ) : !log || log.entries.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<History className="h-6 w-6" />} title="Aucune entrée pour ces filtres" />
          </div>
        ) : (
          <>
            <div className="divide-y divide-ink-100">
              {log.entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{actionLabel(entry.action)}</p>
                    <p className="text-xs text-ink-400">
                      {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'Système'}
                      {entry.salle && ` · ${entry.salle.name}`}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-ink-400">{formatDateTime(entry.createdAt)}</span>
                </div>
              ))}
            </div>

            {log.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Précédent
                </Button>
                <span className="text-xs text-ink-400">
                  Page {log.page} / {log.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= log.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {isEmailModalOpen && (
        <SendByEmailModal
          salleId={selectedSalleId}
          action={selectedAction}
          since={sinceDate}
          onClose={() => setIsEmailModalOpen(false)}
        />
      )}
    </div>
  );
}

function SendByEmailModal({
  salleId,
  action,
  since,
  onClose,
}: {
  salleId: string;
  action: string;
  since: Date | null;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSend = async () => {
    setIsSending(true);
    setError(null);
    try {
      await apiClient.post('/reporting/admin/audit-logs/send-email', {
        email,
        salleId: salleId || undefined,
        action: action || undefined,
        since: since ? since.toISOString() : undefined,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Envoyer le journal par e-mail">
      {success ? (
        <div>
          <p className="mb-4 text-sm text-primary-700">E-mail envoyé à {email}.</p>
          <Button className="w-full" onClick={onClose}>
            Fermer
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-500">
            Envoie les entrées correspondant aux filtres actuellement sélectionnés (jusqu&apos;à 500, les plus
            récentes).
          </p>
          <Input
            type="email"
            placeholder="adresse@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4"
          />
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button className="w-full" disabled={!email} isLoading={isSending} onClick={handleSend}>
            Envoyer
          </Button>
        </>
      )}
    </Modal>
  );
}
