'use client';

import { useState, type FormEvent } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';
import type { InternalUser, Role, Country } from '@/types';

/**
 * §2.2 — Gestion du personnel interne GymCloud (Support, Finance,
 * Commercial, Marketing, Superviseur Pays...), distinct des comptes
 * clients (Propriétaire, Gestionnaire, Coach, Adhérent). Exclusif
 * SUPER_ADMIN.
 */
export default function PersonnelInternePage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRoleFor, setEditingRoleFor] = useState<InternalUser | null>(null);
  const { data: users, isLoading, error, refetch } = useApi<InternalUser[]>('/internal-users');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Personnel interne GymCloud</h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouveau compte
        </Button>
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
        ) : !users || users.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Aucun compte de personnel interne"
            description="Support, Finance, Commercial, Marketing, Superviseur Pays — distinct des comptes clients (§2.2)."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase text-ink-400">
                <th className="px-5 py-3">Nom</th>
                <th className="px-5 py-3">Rôle</th>
                <th className="px-5 py-3">Téléphone</th>
                <th className="px-5 py-3">Pays</th>
                <th className="px-5 py-3">Créé le</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-ink-50">
                  <td className="px-5 py-3 font-medium text-ink-900">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                      {u.role.name}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-ink-600">{u.phone}</td>
                  <td className="px-5 py-3 text-ink-600">{u.country?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-ink-600">{formatDate(u.createdAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditingRoleFor(u)}>
                      Modifier le rôle
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <CreateInternalUserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => {
          setIsCreateOpen(false);
          refetch();
        }}
      />

      {editingRoleFor && (
        <UpdateRoleModal
          user={editingRoleFor}
          onClose={() => setEditingRoleFor(null)}
          onUpdated={() => {
            setEditingRoleFor(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function UpdateRoleModal({
  user,
  onClose,
  onUpdated,
}: {
  user: InternalUser;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { data: roles } = useApi<Role[]>('/roles?scope=INTERNAL');
  const [roleId, setRoleId] = useState(user.role.id);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/internal-users/${user.id}/role`, { roleId });
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Modifier le rôle — ${user.firstName} ${user.lastName}`}>
      <form onSubmit={handleSubmit}>
        <Field label="Nouveau rôle">
          <Select required value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {(roles ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <p className="-mt-3 mb-4 text-xs text-ink-400">
          L'utilisateur sera déconnecté de ses sessions actives pour appliquer les nouveaux droits.
        </p>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Confirmer le changement de rôle
        </Button>
      </form>
    </Modal>
  );
}

function CreateInternalUserModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { data: roles } = useApi<Role[]>(isOpen ? '/roles?scope=INTERNAL' : null);
  const { data: countries } = useApi<Country[]>(isOpen ? '/countries' : null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [countryId, setCountryId] = useState('');
  const [result, setResult] = useState<{ tempPassword: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedRole = roles?.find((r) => r.id === roleId);
  const isCountrySupervisor = selectedRole?.code === 'SUPERVISEUR_PAYS';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ tempPassword: string }>('/internal-users', {
        firstName,
        lastName,
        phone,
        email: email || undefined,
        roleId,
        countryId: isCountrySupervisor ? countryId : undefined,
      });
      setResult(res);
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
    setEmail('');
    setRoleId('');
    setCountryId('');
    setResult(null);
    onCreated();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouveau compte interne">
      {result ? (
        <div>
          <p className="mb-3 rounded-lg bg-primary-50 px-3 py-3 text-sm text-primary-700">
            Compte créé avec succès.
          </p>
          <p className="mb-1 text-sm text-ink-600">
            Mot de passe temporaire (à communiquer, à changer à la première connexion) :
          </p>
          <p className="mb-4 rounded-lg bg-ink-50 px-3 py-2 font-mono text-sm text-ink-900">{result.tempPassword}</p>
          <Button onClick={handleClose} className="w-full">
            Fermer
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <Field label="Rôle">
            <Select required value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">Sélectionner un rôle</option>
              {(roles ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>

          {isCountrySupervisor && (
            <Field label="Pays supervisé">
              <Select required value={countryId} onChange={(e) => setCountryId(e.target.value)}>
                <option value="">Sélectionner un pays</option>
                {(countries ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Prénom">
            <Input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Nom">
            <Input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
          <Field label="Téléphone">
            <Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+226 70 00 00 00" />
          </Field>
          <Field label="Email (optionnel)">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>

          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button type="submit" isLoading={isSubmitting} className="w-full">
            Créer le compte
          </Button>
        </form>
      )}
    </Modal>
  );
}
