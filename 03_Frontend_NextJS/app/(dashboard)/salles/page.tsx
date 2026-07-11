'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Plus, Building2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import type { Salle, Proprietaire, Country, SaasPlan } from '@/types';

export default function SallesPage() {
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: salles, isLoading, error, refetch } = useApi<Salle[]>('/salles');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Salles</h1>
        {user?.roleCode === 'SUPER_ADMIN' && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouvelle salle
          </Button>
        )}
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
        ) : !salles || salles.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="Aucune salle enregistrée"
            description="Créez la première salle pour un propriétaire déjà existant."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase text-ink-400">
                <th className="px-5 py-3">Nom</th>
                <th className="px-5 py-3">Ville</th>
                <th className="px-5 py-3">Téléphone</th>
                <th className="px-5 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {salles.map((s) => (
                <tr key={s.id} className="hover:bg-ink-50">
                  <td className="px-5 py-3">
                    <Link href={`/salles/${s.id}`} className="font-medium text-ink-900 hover:text-primary-600">
                      {s.name}
                    </Link>
                    {s.isSalleSupplementaire && (
                      <span className="ml-2 rounded-full bg-accent-50 px-2 py-0.5 text-xs text-accent-700">
                        supplémentaire
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-ink-600">{s.city}</td>
                  <td className="px-5 py-3 text-ink-600">{s.phone}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <CreateSalleModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => {
          setIsCreateOpen(false);
          refetch();
        }}
      />
    </div>
  );
}

function CreateSalleModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { data: proprietaires } = useApi<Proprietaire[]>(isOpen ? '/proprietaires' : null);
  const { data: countries } = useApi<Country[]>(isOpen ? '/countries' : null);
  const { data: plans } = useApi<SaasPlan[]>(isOpen ? '/saas/plans' : null);

  const [name, setName] = useState('');
  const [proprietaireId, setProprietaireId] = useState('');
  const [saasPlanId, setSaasPlanId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [countryId, setCountryId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Le plan SaaS n'est requis que si le propriétaire n'a pas encore de souscription active (§9.7)
  const selectedProprietaire = proprietaires?.find((p) => p.id === proprietaireId);
  const needsPlan = selectedProprietaire && selectedProprietaire.salles.length === 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post('/salles', {
        name,
        proprietaireId,
        saasPlanId: needsPlan ? saasPlanId : undefined,
        phone,
        email: email || undefined,
        address,
        city,
        countryId,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouvelle salle">
      <form onSubmit={handleSubmit}>
        <Field label="Propriétaire">
          <Select required value={proprietaireId} onChange={(e) => setProprietaireId(e.target.value)}>
            <option value="">Sélectionner un propriétaire</option>
            {(proprietaires ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.user.firstName} {p.user.lastName}
                {p.salles.length === 0 ? ' (première salle)' : ` (${p.salles.length} salle(s))`}
              </option>
            ))}
          </Select>
          {proprietaires?.length === 0 && (
            <p className="mt-1 text-xs text-accent-700">
              Aucun propriétaire disponible — créez-en un d'abord dans l'onglet Propriétaires.
            </p>
          )}
        </Field>

        {needsPlan && (
          <Field label="Plan SaaS (première salle de ce propriétaire — souscription à créer)">
            <Select required value={saasPlanId} onChange={(e) => setSaasPlanId(e.target.value)}>
              <option value="">Sélectionner un plan</option>
              {(plans ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.quotaSalles} salle{p.quotaSalles > 1 ? 's' : ''} incluse{p.quotaSalles > 1 ? 's' : ''})
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Nom de la salle">
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Téléphone">
          <Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+226 70 00 00 00" />
        </Field>
        <Field label="Email (optionnel)">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Adresse">
          <Input required value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="Ville">
          <Input required value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <Field label="Pays">
          <Select required value={countryId} onChange={(e) => setCountryId(e.target.value)}>
            <option value="">Sélectionner un pays</option>
            {(countries ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Créer la salle
        </Button>
      </form>
    </Modal>
  );
}
