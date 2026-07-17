'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import type { Country, SaasPlan } from '@/types';

export interface CreateProprietaireInitialData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  companyName?: string;
  salleCity?: string;
  saasPlanId?: string;
}

/**
 * §2.4, §3.2, §9.5 — Création d'un compte propriétaire + sa première
 * salle. Accepte un pré-remplissage optionnel (`initialData`) pour le
 * flux "Demandes d'abonnement" : le SUPER_ADMIN part directement des
 * informations laissées sur le site vitrine plutôt que de tout
 * ressaisir à la main — il garde cependant la main pour tout relire
 * et corriger avant de valider, rien n'est créé automatiquement.
 */
export function CreateProprietaireModal({
  isOpen,
  onClose,
  onCreated,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialData?: CreateProprietaireInitialData;
}) {
  const { data: countries } = useApi<Country[]>(isOpen ? '/countries' : null);
  const { data: plans } = useApi<SaasPlan[]>(isOpen ? '/saas/plans' : null);

  // Propriétaire
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');

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

  // Applique le pré-remplissage à chaque ouverture avec de nouvelles données
  useEffect(() => {
    if (isOpen && initialData) {
      setFirstName(initialData.firstName ?? '');
      setLastName(initialData.lastName ?? '');
      setPhone(initialData.phone ?? '');
      setEmail(initialData.email ?? '');
      setCompanyName(initialData.companyName ?? '');
      setSalleName(initialData.companyName ?? '');
      setSallePhone(initialData.phone ?? '');
      setSalleCity(initialData.salleCity ?? '');
      setSaasPlanId(initialData.saasPlanId ?? '');
    }
  }, [isOpen, initialData]);

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
        address: address || undefined,
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
    setAddress('');
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
          {initialData && (
            <p className="mb-4 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700">
              Pré-rempli depuis la demande d'abonnement — relisez et complétez avant de valider.
            </p>
          )}
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
          <Field label="Adresse (optionnel)">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
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
