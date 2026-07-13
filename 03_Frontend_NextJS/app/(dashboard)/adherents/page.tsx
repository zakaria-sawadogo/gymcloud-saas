'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Plus, Users, Search, Download, CreditCard } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError, tokenStorage } from '@/lib/api-client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { AdherentProfile, AbonnementCatalogue } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

const STATUS_FILTERS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'ACTIF', label: 'Actifs' },
  { value: 'EN_GRACE', label: 'En grâce' },
  { value: 'EXPIRE', label: 'Expirés' },
  { value: 'SUSPENDU', label: 'Suspendus' },
];

async function downloadPdf(url: string, filename: string) {
  const token = tokenStorage.getAccessToken();
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    alert('Téléchargement impossible');
    return;
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

export default function AdherentsPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const salleId = user?.salle?.id;
  const path = salleId
    ? `/adherents/salle/${salleId}${statusFilter ? `?status=${statusFilter}` : ''}`
    : null;
  const { data: adherents, isLoading, error, refetch } = useApi<AdherentProfile[]>(path, [statusFilter]);

  const filtered = (adherents ?? []).filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.user.firstName.toLowerCase().includes(q) ||
      a.user.lastName.toLowerCase().includes(q) ||
      a.memberCode.toLowerCase().includes(q) ||
      a.user.phone.includes(q)
    );
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Adhérents</h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouvel adhérent
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un adhérent..."
            className="h-10 w-full rounded-lg border border-ink-100 pl-9 pr-3 text-sm outline-none focus:border-primary-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-ink-100 bg-white px-3 text-sm outline-none focus:border-primary-400"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <Card className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-ink-50" />
            ))}
          </div>
        ) : error ? (
          <p className="p-5 text-sm text-red-600">{error}</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Aucun adhérent trouvé"
            description="Ajustez vos filtres ou inscrivez un nouvel adhérent."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase text-ink-400">
                <th className="px-5 py-3">Adhérent</th>
                <th className="px-5 py-3">Code membre</th>
                <th className="px-5 py-3">Téléphone</th>
                <th className="px-5 py-3">Inscrit le</th>
                <th className="px-5 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-ink-50">
                  <td className="px-5 py-3">
                    <Link href={`/adherents/${a.id}`} className="font-medium text-ink-900 hover:text-primary-600">
                      {a.user.firstName} {a.user.lastName}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-ink-600">{a.memberCode}</td>
                  <td className="px-5 py-3 text-ink-600">{a.user.phone}</td>
                  <td className="px-5 py-3 text-ink-600">{formatDate(a.joinedAt)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {salleId && (
        <CreateAdherentModal
          salleId={salleId}
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

/**
 * §5.1, §5.6, §8.3 — Flux guichet unifié : identité + formule
 * d'abonnement + encaissement en une seule modale, plutôt que trois
 * écrans séparés. La facture (reçu) et la carte membre ne sont
 * proposées au téléchargement qu'APRÈS confirmation du paiement — pas
 * avant, puisqu'elles n'ont de sens qu'une fois le règlement effectué.
 */
function CreateAdherentModal({
  salleId,
  isOpen,
  onClose,
  onCreated,
}: {
  salleId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { data: catalogue } = useApi<AbonnementCatalogue[]>(isOpen ? `/salles/${salleId}/abonnement-catalogue` : null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [abonnementCatalogueId, setAbonnementCatalogueId] = useState('');
  const [method, setMethod] = useState<'ESPECES' | 'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE'>('ESPECES');
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState('');
  const [result, setResult] = useState<{ adherentId: string; paymentId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedFormule = (catalogue ?? []).find((c) => c.id === abonnementCatalogueId);
  const isMobileMoney = method !== 'ESPECES';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ adherent: { id: string }; payment: { payment: { id: string } } }>(
        '/adherents/with-payment',
        {
          salleId,
          firstName,
          lastName,
          phone,
          abonnementCatalogueId,
          payment: { method, phoneNumber: isMobileMoney ? mobileMoneyPhone : undefined },
        },
      );
      setResult({ adherentId: res.adherent.id, paymentId: res.payment.payment.id });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFirstName('');
    setLastName('');
    setPhone('');
    setAbonnementCatalogueId('');
    setMobileMoneyPhone('');
    setResult(null);
    onCreated();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Inscrire un adhérent">
      {result ? (
        <div>
          <p className="mb-4 rounded-lg bg-primary-50 px-3 py-3 text-sm text-primary-700">
            {isMobileMoney
              ? 'Adhérent inscrit — paiement Mobile Money en attente de confirmation.'
              : 'Adhérent inscrit et paiement encaissé avec succès.'}
          </p>
          <div className="mb-4 space-y-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() =>
                downloadPdf(`${API_URL}/adherents/${result.adherentId}/card`, `carte-membre-${result.adherentId}.pdf`)
              }
            >
              <CreditCard className="h-4 w-4" />
              Télécharger la carte membre
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() =>
                downloadPdf(`${API_URL}/payments/${result.paymentId}/receipt`, `recu-${result.paymentId}.pdf`)
              }
            >
              <Download className="h-4 w-4" />
              Télécharger le reçu
            </Button>
          </div>
          <Button onClick={handleClose} className="w-full">
            Fermer
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-400">Identité</p>
          <Field label="Prénom">
            <Input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Nom">
            <Input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
          <Field label="Téléphone">
            <Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+226 70 00 00 00" />
          </Field>

          <p className="mb-3 mt-5 text-xs font-medium uppercase tracking-wide text-ink-400">Formule d'abonnement</p>
          <Field label="Formule">
            <Select required value={abonnementCatalogueId} onChange={(e) => setAbonnementCatalogueId(e.target.value)}>
              <option value="">Sélectionner une formule</option>
              {(catalogue ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {formatCurrency(c.price, c.currency)} ({c.durationDays} jours)
                </option>
              ))}
            </Select>
          </Field>
          {(catalogue ?? []).length === 0 && (
            <p className="mb-4 text-xs text-accent-700">
              Aucune formule créée pour cette salle — rendez-vous dans "Formules d'abonnement" d'abord.
            </p>
          )}

          <p className="mb-3 mt-5 text-xs font-medium uppercase tracking-wide text-ink-400">Encaissement</p>
          <Field label="Moyen de paiement">
            <Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value="ESPECES">Espèces</option>
              <option value="ORANGE_MONEY">Orange Money</option>
              <option value="MOOV_MONEY">Moov Money</option>
              <option value="WAVE">Wave</option>
            </Select>
          </Field>
          {isMobileMoney && (
            <Field label="Numéro Mobile Money">
              <Input
                required
                value={mobileMoneyPhone}
                onChange={(e) => setMobileMoneyPhone(e.target.value)}
                placeholder="+226 70 00 00 00"
              />
            </Field>
          )}
          {selectedFormule && (
            <div className="mb-4 flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
              <span className="text-sm text-ink-600">Montant à encaisser</span>
              <span className="font-display text-lg font-semibold text-ink-900">
                {formatCurrency(selectedFormule.price, selectedFormule.currency)}
              </span>
            </div>
          )}

          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button type="submit" isLoading={isSubmitting} disabled={!abonnementCatalogueId} className="w-full">
            Inscrire et encaisser
          </Button>
        </form>
      )}
    </Modal>
  );
}
