'use client';

import { useState, type FormEvent } from 'react';
import { Plus, Globe } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/Input';
import type { Country } from '@/types';

/**
 * §14.4 — Gestion des pays couverts par GymCloud, exclusive
 * SUPER_ADMIN. Jusqu'ici, seul le seed pouvait ajouter un pays (un
 * seul, codé en dur) — impossible de couvrir un nouveau marché sans
 * redéployer le code.
 */
export default function PaysPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Country | null>(null);
  const { data: countries, isLoading, error, refetch } = useApi<Country[]>('/countries/all');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Pays</h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Ajouter un pays
        </Button>
      </div>

      <Card className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-ink-50" />
            ))}
          </div>
        ) : error ? (
          <p className="p-5 text-sm text-red-600">{error}</p>
        ) : !countries || countries.length === 0 ? (
          <EmptyState
            icon={<Globe className="h-6 w-6" />}
            title="Aucun pays"
            description="Ajoutez un pays pour permettre la création de salles et de propriétaires qui y sont rattachés."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase text-ink-400">
                <th className="px-5 py-3">Pays</th>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Devise</th>
                <th className="px-5 py-3">Fuseau horaire</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {countries.map((c) => (
                <tr key={c.id} className="hover:bg-ink-50">
                  <td className="px-5 py-3 font-medium text-ink-900">{c.name}</td>
                  <td className="px-5 py-3 text-ink-600">{c.code}</td>
                  <td className="px-5 py-3 text-ink-600">{c.currency}</td>
                  <td className="px-5 py-3 text-ink-600">{c.timezone}</td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        c.active
                          ? 'rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700'
                          : 'rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600'
                      }
                    >
                      {c.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                      Modifier
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <CreateCountryModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSaved={() => {
          setIsCreateOpen(false);
          refetch();
        }}
      />

      {editing && (
        <EditCountryModal
          country={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function CreateCountryModal({
  isOpen,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('');
  const [timezone, setTimezone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post('/countries', { code, name, currency, timezone });
      setCode('');
      setName('');
      setCurrency('');
      setTimezone('');
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter un pays">
      <form onSubmit={handleSubmit}>
        <Field label="Nom">
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Sénégal" />
        </Field>
        <Field label="Code ISO (2 lettres)">
          <Input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="SN"
            maxLength={2}
            className="uppercase"
          />
        </Field>
        <Field label="Devise (code ISO 4217, 3 lettres)">
          <Input
            required
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            placeholder="XOF"
            maxLength={3}
            className="uppercase"
          />
        </Field>
        <Field label="Fuseau horaire (IANA)">
          <Input required value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Africa/Dakar" />
        </Field>
        <p className="-mt-3 mb-4 text-xs text-ink-400">
          Format attendu : Continent/Ville, ex. Africa/Dakar, Africa/Conakry.
        </p>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Ajouter le pays
        </Button>
      </form>
    </Modal>
  );
}

function EditCountryModal({
  country,
  onClose,
  onSaved,
}: {
  country: Country;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(country.name);
  const [currency, setCurrency] = useState(country.currency);
  const [timezone, setTimezone] = useState(country.timezone);
  const [active, setActive] = useState(country.active);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/countries/${country.id}`, { name, currency, timezone, active });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Modifier — ${country.name}`}>
      <form onSubmit={handleSubmit}>
        <Field label="Nom">
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Devise (code ISO 4217, 3 lettres)">
          <Input
            required
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
            className="uppercase"
          />
        </Field>
        <Field label="Fuseau horaire (IANA)">
          <Input required value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </Field>
        <label className="mb-4 flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Pays actif (visible dans les sélecteurs)
        </label>
        <p className="-mt-2 mb-4 text-xs text-ink-400">
          Désactiver un pays le retire des listes de sélection pour les nouvelles créations, sans affecter les salles/propriétaires déjà existants.
        </p>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Enregistrer
        </Button>
      </form>
    </Modal>
  );
}
