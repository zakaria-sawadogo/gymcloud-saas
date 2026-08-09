'use client';

import { useState } from 'react';
import { History } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils';
import type { Salle } from '@/types';

interface Actor {
  id: string;
  firstName: string;
  lastName: string;
}

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string; roleId: string } | null;
}

interface AuditLogResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// §14.x — Traduction lisible des types d'action les plus courants au
// niveau d'une salle (adhérents, paiements, boutique, réservations...).
// Pas exhaustif sur les 80+ actions journalisées dans tout le système
// — beaucoup sont plateforme/SaaS et n'apparaissent jamais ici de
// toute façon (filtrées par salleId). Repli sur une version
// simplifiée de la chaîne brute pour tout le reste, plutôt que de
// maintenir une liste interminable.
const ACTION_LABELS: Record<string, string> = {
  'adherent.create': 'Nouvel adhérent créé',
  'adherent.update': 'Fiche adhérent modifiée',
  'adherent.suspend': 'Adhérent suspendu',
  'adherent.reactivate': 'Adhérent réactivé',
  'adherent.account_suspend': 'Compte adhérent suspendu',
  'adherent.account_reactivate': 'Compte adhérent réactivé',
  'adherent.account_deactivate': 'Compte adhérent désactivé',
  'adherent.qr_regenerate': 'QR code régénéré',
  'adherent_abonnement.request_approved': 'Réabonnement approuvé',
  'adherent_abonnement.request_rejected': 'Réabonnement rejeté',
  'adherent_abonnement.requested_from_mobile': 'Réabonnement demandé (app adhérent)',
  'payment.cash_recorded': 'Paiement espèces encaissé',
  'payment.mobile_money_confirmed': 'Paiement Mobile Money confirmé',
  'payment.mobile_money_initiated': 'Paiement Mobile Money initié',
  'payment.mobile_money_failed': 'Paiement Mobile Money échoué',
  'payment.refund': 'Paiement remboursé',
  'product.create': 'Produit créé',
  'product.update': 'Produit modifié',
  'product.update_image': 'Photo du produit modifiée',
  'product_sale.create': 'Vente boutique enregistrée',
  'booking.create': 'Réservation créée',
  'booking.cancel': 'Réservation annulée',
  'booking.attendance_marked': 'Présence pointée',
  'booking.absence_marked': 'Absence marquée',
  'booking.waiting_list_promoted': "Promu depuis la liste d'attente",
  'access_control.manual_override': "Passage forcé manuellement (Contrôle d'accès)",
  'coach.create': 'Coach ajouté',
  'coach.delete': 'Coach retiré',
  'coupon.create': 'Coupon créé',
  'expense.create': 'Dépense enregistrée',
  'expense.update': 'Dépense modifiée',
  'expense.delete': 'Dépense supprimée',
  'expense.duplicate': 'Dépense dupliquée',
  'cours_collectif.create': 'Cours collectif créé',
  'cours_collectif.update': 'Cours collectif modifié',
  'gestionnaire.create': 'Gestionnaire ajouté',
  'gestionnaire.delete': 'Gestionnaire retiré',
  'salle.settings_update': 'Paramètres de la salle modifiés',
  'salle.branding_update': 'Identité visuelle modifiée',
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, ' ');
}

export default function JournalActivitePage() {
  const { data: salles, isLoading: isLoadingSalles } = useApi<Salle[]>('/salles');
  const [selectedSalleId, setSelectedSalleId] = useState('');
  const [selectedActorId, setSelectedActorId] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [page, setPage] = useState(1);

  const activeSalleId = selectedSalleId || salles?.[0]?.id;

  // §14.x — calculé côté client plutôt que d'envoyer "today"/"7d" au
  // serveur : évite tout souci de fuseau horaire entre client et
  // serveur pour un filtre qui n'a de sens que du point de vue de
  // l'utilisateur qui regarde l'écran.
  const sinceDate = (() => {
    if (period === 'all') return null;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (period === '7d') d.setDate(d.getDate() - 6);
    if (period === '30d') d.setDate(d.getDate() - 29);
    return d;
  })();

  const { data: actors } = useApi<Actor[]>(
    activeSalleId ? `/reporting/salle/${activeSalleId}/audit-logs/actors` : null,
    [activeSalleId],
  );

  const queryParams = new URLSearchParams();
  if (selectedActorId) queryParams.set('userId', selectedActorId);
  if (selectedAction) queryParams.set('action', selectedAction);
  if (sinceDate) queryParams.set('since', sinceDate.toISOString());
  queryParams.set('page', String(page));

  const { data: log, isLoading: isLoadingLog } = useApi<AuditLogResponse>(
    activeSalleId ? `/reporting/salle/${activeSalleId}/audit-logs?${queryParams.toString()}` : null,
    [activeSalleId, selectedActorId, selectedAction, period, page],
  );

  if (isLoadingSalles) return <p className="text-sm text-ink-400">Chargement...</p>;
  if (!salles || salles.length === 0) {
    return <p className="text-sm text-ink-400">Aucune salle pour l'instant.</p>;
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink-900">Journal d'activité</h1>
      <p className="mb-6 text-sm text-ink-500">
        Qui a fait quoi sur votre salle — utile dès que plusieurs gestionnaires y opèrent.
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

        {salles.length > 1 && (
          <Select
            className="max-w-xs"
            value={activeSalleId}
            onChange={(e) => {
              setSelectedSalleId(e.target.value);
              setPage(1);
            }}
          >
            {salles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}

        <Select
          className="max-w-xs"
          value={selectedActorId}
          onChange={(e) => {
            setSelectedActorId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tous les gestionnaires</option>
          {(actors ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.firstName} {a.lastName}
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
      </div>

      <Card className="p-0">
        <div className="p-5 pb-0">
          <CardHeader>
            <CardTitle>Historique</CardTitle>
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
    </div>
  );
}
