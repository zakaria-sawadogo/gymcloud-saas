'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Plus, UserCog, Ban, RotateCcw, Search, CreditCard } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { CreateProprietaireModal } from '@/components/dashboard/CreateProprietaireModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ChangePlanModal } from '@/components/dashboard/ChangePlanModal';
import { SubscriptionHistoryTable } from '@/components/dashboard/SubscriptionHistoryTable';
import { formatDate } from '@/lib/utils';
import type { Proprietaire, Country, SaasPlan, SaasSubscription } from '@/types';

export default function ProprietairesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [managingSubscriptionFor, setManagingSubscriptionFor] = useState<string | null>(null);
  const { data: proprietaires, isLoading, error, refetch } = useApi<Proprietaire[]>('/proprietaires');

  const filtered = (proprietaires ?? []).filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.user.firstName.toLowerCase().includes(q) ||
      p.user.lastName.toLowerCase().includes(q) ||
      p.user.phone.includes(q) ||
      (p.companyName?.toLowerCase().includes(q) ?? false)
    );
  });

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    setActioningId(id);
    try {
      const action = currentStatus === 'SUSPENDU' ? 'reactivate' : 'suspend';
      await apiClient.patch(`/proprietaires/${id}/${action}`);
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
        <h1 className="font-display text-2xl font-semibold text-ink-900">Propriétaires</h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouveau propriétaire
        </Button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un propriétaire..."
            className="h-10 w-full rounded-lg border border-ink-100 pl-9 pr-3 text-sm outline-none focus:border-primary-400"
          />
        </div>
      </div>

      <Card className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-ink-50" />
            ))}
          </div>
        ) : error ? (
          <p className="p-5 text-sm text-red-600">{error}</p>
        ) : !proprietaires || proprietaires.length === 0 ? (
          <EmptyState
            icon={<UserCog className="h-6 w-6" />}
            title="Aucun propriétaire enregistré"
            description="Un propriétaire est toujours créé avec sa première salle et son plan SaaS — les deux à la fois."
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<UserCog className="h-6 w-6" />} title="Aucun résultat pour cette recherche" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase text-ink-400">
                <th className="px-5 py-3">Nom</th>
                <th className="px-5 py-3">Téléphone</th>
                <th className="px-5 py-3">Société</th>
                <th className="px-5 py-3">Salles</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3">Créé le</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-ink-50">
                  <td className="px-5 py-3 font-medium text-ink-900">
                    {p.user.firstName} {p.user.lastName}
                  </td>
                  <td className="px-5 py-3 text-ink-600">{p.user.phone}</td>
                  <td className="px-5 py-3 text-ink-600">{p.companyName ?? '—'}</td>
                  <td className="px-5 py-3 text-ink-600">
                    {p.salles.length === 0
                      ? 'Aucune'
                      : p.salles.map((s) => (
                          <Link key={s.id} href={`/salles/${s.id}`} className="mr-2 text-primary-600 hover:underline">
                            {s.name}
                          </Link>
                        ))}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={p.user.status} />
                  </td>
                  <td className="px-5 py-3 text-ink-600">{formatDate(p.createdAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setManagingSubscriptionFor(p.id)}>
                        <CreditCard className="h-3.5 w-3.5" />
                        Abonnement
                      </Button>
                      <Button
                        size="sm"
                        variant={p.user.status === 'SUSPENDU' ? 'secondary' : 'danger'}
                        isLoading={actioningId === p.id}
                        onClick={() => handleToggleStatus(p.id, p.user.status)}
                      >
                        {p.user.status === 'SUSPENDU' ? (
                          <>
                            <RotateCcw className="h-3.5 w-3.5" />
                            Réactiver
                          </>
                        ) : (
                          <>
                            <Ban className="h-3.5 w-3.5" />
                            Suspendre
                          </>
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <CreateProprietaireModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => {
          setIsCreateOpen(false);
          refetch();
        }}
      />

      {managingSubscriptionFor && (
        <ManageSubscriptionModal
          proprietaireId={managingSubscriptionFor}
          onClose={() => setManagingSubscriptionFor(null)}
        />
      )}
    </div>
  );
}

/**
 * Récupère la souscription du propriétaire ciblé avant d'ouvrir
 * ChangePlanModal — celle-ci a besoin de connaître le subscriptionId,
 * le plan actuel et le cycle de facturation actuel, propres à CE
 * propriétaire (§9.12, gestion SUPER_ADMIN).
 */
/**
 * Récupère la souscription du propriétaire ciblé, affiche son
 * historique complet (§9.6, §9.12), et propose d'ouvrir
 * ChangePlanModal pour agir — celle-ci a besoin de connaître le
 * subscriptionId, le plan actuel et le cycle de facturation actuel,
 * propres à CE propriétaire (gestion SUPER_ADMIN).
 */
function ManageSubscriptionModal({
  proprietaireId,
  onClose,
}: {
  proprietaireId: string;
  onClose: () => void;
}) {
  const [isChangePlanOpen, setIsChangePlanOpen] = useState(false);
  const { data: subscription, isLoading, refetch } = useApi<SaasSubscription>(
    `/saas/invoices/proprietaire/${proprietaireId}/subscription`,
  );

  if (isLoading || !subscription) {
    return (
      <Modal isOpen onClose={onClose} title="Gérer l'abonnement">
        <p className="text-sm text-ink-400">Chargement...</p>
      </Modal>
    );
  }

  return (
    <>
      <Modal isOpen={!isChangePlanOpen} onClose={onClose} title="Gérer l'abonnement">
        <div className="mb-5 flex items-center justify-between rounded-lg bg-ink-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink-900">{subscription.saasPlan.name}</p>
            <p className="text-xs text-ink-400">
              {subscription.billingCycle === 'ANNUEL' ? 'Annuel' : 'Mensuel'} · Statut : {subscription.status}
            </p>
          </div>
          <Button size="sm" onClick={() => setIsChangePlanOpen(true)}>
            Changer / réabonner
          </Button>
        </div>

        <SubscriptionHistoryTable apiPath={`/saas/plans/${subscription.id}/history`} />
      </Modal>

      <ChangePlanModal
        subscriptionId={subscription.id}
        currentPlanId={subscription.saasPlanId}
        currentBillingCycle={subscription.billingCycle}
        isOpen={isChangePlanOpen}
        onClose={() => setIsChangePlanOpen(false)}
        onChanged={() => {
          setIsChangePlanOpen(false);
          refetch();
        }}
      />
    </>
  );
}
