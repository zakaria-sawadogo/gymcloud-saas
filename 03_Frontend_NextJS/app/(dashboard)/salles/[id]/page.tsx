'use client';

import { useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, UserCog, Dumbbell, Coins } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { GestionnaireDashboardView } from '@/components/dashboard/GestionnaireDashboardView';
import { SallePaymentsView } from '@/components/dashboard/SallePaymentsView';
import { formatCurrency } from '@/lib/utils';
import type { Salle, GestionnaireProfile, CoachProfile } from '@/types';

/**
 * Détail d'une salle, accessible depuis /salles et /proprietaires.
 * Réutilise directement GestionnaireDashboardView : un SUPER_ADMIN ou
 * un PROPRIETAIRE consultant une salle voit exactement les mêmes
 * indicateurs qu'un gestionnaire sur son propre tableau de bord (§11).
 *
 * Inclut aussi la gestion de l'équipe (gestionnaires + coachs) — c'est
 * ici que les premiers comptes doivent être créés : le Gestionnaire
 * pour gérer adhérents/contrôle d'accès/paiements, le Coach pour
 * pouvoir planifier des cours collectifs (§2.3, §7).
 *
 * Et les paiements de cette salle (SallePaymentsView) — le SUPER_ADMIN
 * n'étant rattaché à aucune salle précise, c'est ici, et non sur
 * /payments (réservée au Gestionnaire), qu'il peut consulter et
 * encaisser des paiements pour n'importe quelle salle.
 */
export default function SalleDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: salle } = useApi<Salle>(`/salles/${params.id}`);
  const [isCreateGestionnaireOpen, setIsCreateGestionnaireOpen] = useState(false);
  const [isCreateCoachOpen, setIsCreateCoachOpen] = useState(false);
  const [pricingCoach, setPricingCoach] = useState<CoachProfile | null>(null);

  const { data: gestionnaires, refetch: refetchGestionnaires } = useApi<GestionnaireProfile[]>(
    `/gestionnaires/salle/${params.id}`,
  );
  const { data: coachs, refetch: refetchCoachs } = useApi<CoachProfile[]>(`/coachs/salle/${params.id}`);

  return (
    <div>
      <Link href="/salles" className="mb-4 inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" />
        Retour aux salles
      </Link>

      {salle && (
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink-900">{salle.name}</h1>
            <p className="mt-1 text-sm text-ink-400">
              {salle.address}, {salle.city} · {salle.phone}
            </p>
          </div>
          <StatusBadge status={salle.status} />
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Équipe — Gestionnaires</CardTitle>
            <Button size="sm" onClick={() => setIsCreateGestionnaireOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nouveau
            </Button>
          </CardHeader>

          {!gestionnaires || gestionnaires.length === 0 ? (
            <EmptyState
              icon={<UserCog className="h-6 w-6" />}
              title="Aucun gestionnaire"
              description="Nécessaire pour gérer adhérents, contrôle d'accès et paiements."
            />
          ) : (
            <div className="space-y-2">
              {gestionnaires.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
                  <span className="text-sm font-medium text-ink-900">
                    {g.user.firstName} {g.user.lastName}
                  </span>
                  <span className="text-xs text-ink-400">{g.user.phone}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Équipe — Coachs</CardTitle>
            <Button size="sm" onClick={() => setIsCreateCoachOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nouveau
            </Button>
          </CardHeader>

          {!coachs || coachs.length === 0 ? (
            <EmptyState
              icon={<Dumbbell className="h-6 w-6" />}
              title="Aucun coach"
              description="Nécessaire pour planifier des cours collectifs et séances individuelles (§7)."
            />
          ) : (
            <div className="space-y-2">
              {coachs.map((c) => (
                <div key={c.id} className="rounded-lg bg-ink-50 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink-900">
                      {c.user.firstName} {c.user.lastName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-400">{c.user.phone}</span>
                      <Button size="sm" variant="ghost" onClick={() => setPricingCoach(c)}>
                        <Coins className="h-3.5 w-3.5" />
                        Tarifs
                      </Button>
                    </div>
                  </div>
                  {(c.pricePerSession != null || c.priceMonthly != null) && (
                    <p className="mt-1 text-xs text-ink-500">
                      {c.pricePerSession != null && `${formatCurrency(c.pricePerSession, c.currency ?? 'XOF')}/séance`}
                      {c.pricePerSession != null && c.priceMonthly != null && ' · '}
                      {c.priceMonthly != null && `${formatCurrency(c.priceMonthly, c.currency ?? 'XOF')}/mois`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <GestionnaireDashboardView salleId={params.id} />

      <div className="mt-6">
        <SallePaymentsView salleId={params.id} />
      </div>

      <CreateTeamMemberModal
        kind="gestionnaire"
        salleId={params.id}
        isOpen={isCreateGestionnaireOpen}
        onClose={() => setIsCreateGestionnaireOpen(false)}
        onCreated={() => {
          setIsCreateGestionnaireOpen(false);
          refetchGestionnaires();
        }}
      />
      <CreateTeamMemberModal
        kind="coach"
        salleId={params.id}
        isOpen={isCreateCoachOpen}
        onClose={() => setIsCreateCoachOpen(false)}
        onCreated={() => {
          setIsCreateCoachOpen(false);
          refetchCoachs();
        }}
      />
      {pricingCoach && (
        <CoachPricingModal
          coach={pricingCoach}
          onClose={() => setPricingCoach(null)}
          onSaved={() => {
            setPricingCoach(null);
            refetchCoachs();
          }}
        />
      )}
    </div>
  );
}

/**
 * §7.7 — Tarification des séances individuelles d'un coach. Laisser
 * les deux champs vides = séances incluses dans l'abonnement standard
 * (comportement historique, rétrocompatible) ; renseigner l'un ou
 * l'autre (ou les deux) active l'encaissement obligatoire au moment
 * de la réservation.
 */
function CoachPricingModal({
  coach,
  onClose,
  onSaved,
}: {
  coach: CoachProfile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pricePerSession, setPricePerSession] = useState(coach.pricePerSession != null ? String(coach.pricePerSession) : '');
  const [priceMonthly, setPriceMonthly] = useState(coach.priceMonthly != null ? String(coach.priceMonthly) : '');
  const [currency, setCurrency] = useState(coach.currency ?? 'XOF');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/coachs/${coach.id}/pricing`, {
        pricePerSession: pricePerSession ? Number(pricePerSession) : undefined,
        priceMonthly: priceMonthly ? Number(priceMonthly) : undefined,
        currency,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Tarifs — ${coach.user.firstName} ${coach.user.lastName}`}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-xs text-ink-400">
          Laisser les deux champs vides = séances individuelles incluses dans l'abonnement standard, aucun
          encaissement demandé à la réservation.
        </p>
        <Field label="Tarif par séance (optionnel)">
          <Input type="number" min="0" value={pricePerSession} onChange={(e) => setPricePerSession(e.target.value)} />
        </Field>
        <Field label="Forfait mensuel illimité (optionnel)">
          <Input type="number" min="0" value={priceMonthly} onChange={(e) => setPriceMonthly(e.target.value)} />
        </Field>
        <Field label="Devise">
          <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </Field>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Enregistrer
        </Button>
      </form>
    </Modal>
  );
}

/**
 * Modale de création partagée entre Gestionnaire et Coach — les deux
 * DTOs backend (firstName, lastName, phone, email?, salleId) sont
 * identiques, seul l'endpoint appelé diffère.
 */
function CreateTeamMemberModal({
  kind,
  salleId,
  isOpen,
  onClose,
  onCreated,
}: {
  kind: 'gestionnaire' | 'coach';
  salleId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ tempPassword: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const endpoint = kind === 'gestionnaire' ? '/gestionnaires' : '/coachs';
  const label = kind === 'gestionnaire' ? 'gestionnaire' : 'coach';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ tempPassword: string }>(endpoint, {
        firstName,
        lastName,
        phone,
        email: email || undefined,
        salleId,
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
    setResult(null);
    onCreated();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Nouveau ${label}`}>
      {result ? (
        <div>
          <p className="mb-3 rounded-lg bg-primary-50 px-3 py-3 text-sm text-primary-700">
            {label.charAt(0).toUpperCase() + label.slice(1)} créé avec succès.
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
            Créer le {label}
          </Button>
        </form>
      )}
    </Modal>
  );
}
