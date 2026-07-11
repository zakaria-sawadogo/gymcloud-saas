'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Plus, UserCog } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';
import type { Proprietaire, Country, SaasPlan } from '@/types';

export default function ProprietairesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: proprietaires, isLoading, error, refetch } = useApi<Proprietaire[]>('/proprietaires');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Propriétaires</h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouveau propriétaire
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
        ) : !proprietaires || proprietaires.length === 0 ? (
          <EmptyState
            icon={<UserCog className="h-6 w-6" />}
            title="Aucun propriétaire enregistré"
            description="Un propriétaire est toujours créé avec sa première salle et son plan SaaS — les deux à la fois."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase text-ink-400">
                <th className="px-5 py-3">Nom</th>
                <th className="px-5 py-3">Téléphone</th>
                <th className="px-5 py-3">Société</th>
                <th className="px-5 py-3">Salles</th>
                <th className="px-5 py-3">Créé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {proprietaires.map((p) => (
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
                  <td className="px-5 py-3 text-ink-600">{formatDate(p.createdAt)}</td>
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
    </div>
  );
}

/**
 * §2.4, §3.2, §9.7 — Un propriétaire ne peut plus être créé isolément :
 * ce formulaire regroupe systématiquement son identité, sa première
 * salle et le plan SaaS de démarrage en une seule soumission,
 * cohérent avec la contrainte appliquée côté backend.
 */
function CreateProprietaireModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { data: countries } = useApi<Country[]>(isOpen ? '/countries' : null);
  const { data: plans } = useApi<SaasPlan[]>(isOpen ? '/saas/plans' : null);

  // Propriétaire
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Première salle (obligatoire)
  const [salleName, setSalleName] = useState('');
  const [sallePhone, setSallePhone] = useState('');
  const [salleEmail, setSalleEmail] = useState('');
  const [salleAddress, setSalleAddress] = useState('');
  const [salleCity, setSalleCity] = useState('');
  const [salleCountryId, setSalleCountryId] = useState('');
  const [saasPlanId, setSaasPlanId] = useState('');

  const [result, setResult] = useState<{ tempPassword: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ tempPassword: string }>('/proprietaires', {
        firstName,
        lastName,
        phone,
        email: email || undefined,
        companyName: companyName || undefined,
        salleName,
        sallePhone,
        salleEmail: salleEmail || undefined,
        salleAddress,
        salleCity,
        salleCountryId,
        saasPlanId,
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
    setCompanyName('');
    setSalleName('');
    setSallePhone('');
    setSalleEmail('');
    setSalleAddress('');
    setSalleCity('');
    setSalleCountryId('');
    setSaasPlanId('');
    setResult(null);
    onCreated();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouveau propriétaire">
      {result ? (
        <div>
          <p className="mb-3 rounded-lg bg-primary-50 px-3 py-3 text-sm text-primary-700">
            Propriétaire et sa salle créés avec succès.
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
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-400">Propriétaire</p>
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
          <Field label="Société (optionnel)">
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </Field>

          <p className="mb-3 mt-5 text-xs font-medium uppercase tracking-wide text-ink-400">
            Première salle — obligatoire
          </p>
          <Field label="Nom de la salle">
            <Input required value={salleName} onChange={(e) => setSalleName(e.target.value)} />
          </Field>
          <Field label="Téléphone de la salle">
            <Input required value={sallePhone} onChange={(e) => setSallePhone(e.target.value)} placeholder="+226 70 00 00 00" />
          </Field>
          <Field label="Email de la salle (optionnel)">
            <Input type="email" value={salleEmail} onChange={(e) => setSalleEmail(e.target.value)} />
          </Field>
          <Field label="Adresse">
            <Input required value={salleAddress} onChange={(e) => setSalleAddress(e.target.value)} />
          </Field>
          <Field label="Ville">
            <Input required value={salleCity} onChange={(e) => setSalleCity(e.target.value)} />
          </Field>
          <Field label="Pays">
            <Select required value={salleCountryId} onChange={(e) => setSalleCountryId(e.target.value)}>
              <option value="">Sélectionner un pays</option>
              {(countries ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <p className="mb-3 mt-5 text-xs font-medium uppercase tracking-wide text-ink-400">
            Plan SaaS de démarrage — obligatoire
          </p>
          <Field label="Plan">
            <Select required value={saasPlanId} onChange={(e) => setSaasPlanId(e.target.value)}>
              <option value="">Sélectionner un plan</option>
              {(plans ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.quotaSalles} salle{p.quotaSalles > 1 ? 's' : ''} incluse{p.quotaSalles > 1 ? 's' : ''})
                </option>
              ))}
            </Select>
          </Field>

          {error && <p className="mb-4 mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button type="submit" isLoading={isSubmitting} className="mt-4 w-full">
            Créer le propriétaire et sa salle
          </Button>
        </form>
      )}
    </Modal>
  );
}
