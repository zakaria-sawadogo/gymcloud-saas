'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Plus, Users, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';
import type { AdherentProfile } from '@/types';

const STATUS_FILTERS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'ACTIF', label: 'Actifs' },
  { value: 'EN_GRACE', label: 'En grâce' },
  { value: 'EXPIRE', label: 'Expirés' },
  { value: 'SUSPENDU', label: 'Suspendus' },
];

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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post('/adherents', { salleId, firstName, lastName, phone });
      setFirstName('');
      setLastName('');
      setPhone('');
      onCreated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Inscrire un adhérent">
      <form onSubmit={handleSubmit}>
        <Field label="Prénom">
          <Input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label="Nom">
          <Input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
        <Field label="Téléphone">
          <Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+226 70 00 00 00" />
        </Field>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Créer le dossier
        </Button>
      </form>
    </Modal>
  );
}
