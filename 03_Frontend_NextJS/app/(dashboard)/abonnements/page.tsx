'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Plus, Layers, Pencil } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import type { AbonnementCatalogue } from '@/types';

/**
 * §3.8, §5.6 — Catalogue d'abonnements propre à chaque salle. Cette
 * page manquait entièrement : sans elle, impossible de souscrire un
 * adhérent à quoi que ce soit (le sélecteur de formule reste vide).
 */
export default function AbonnementsPage() {
  const { user } = useAuth();
  const salleId = user?.salle?.id;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AbonnementCatalogue | null>(null);

  const {
    data: catalogue,
    isLoading,
    error,
    refetch,
  } = useApi<AbonnementCatalogue[]>(salleId ? `/salles/${salleId}/abonnement-catalogue` : null);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Formules d'abonnement</h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouvelle formule
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-card bg-ink-100" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !catalogue || catalogue.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Layers className="h-6 w-6" />}
            title="Aucune formule d'abonnement créée"
            description="Sans formule, impossible de souscrire un adhérent — créez-en une pour commencer (ex: Mensuel, Trimestriel, Annuel)."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalogue.map((c) => (
            <Card key={c.id}>
              <div className="mb-2 flex items-start justify-between">
                <h3 className="font-display text-lg font-semibold text-ink-900">{c.name}</h3>
                <button
                  onClick={() => setEditing(c)}
                  className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                  aria-label="Modifier"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              {c.description && <p className="mb-3 text-sm text-ink-600">{c.description}</p>}
              <p className="font-display text-2xl font-semibold text-primary-600">
                {formatCurrency(c.price, c.currency)}
              </p>
              <p className="text-sm text-ink-400">{c.durationDays} jours</p>
              {!c.active && (
                <span className="mt-2 inline-block rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600">
                  Désactivée
                </span>
              )}
            </Card>
          ))}
        </div>
      )}

      {salleId && (
        <CreateOrEditModal
          salleId={salleId}
          isOpen={isCreateOpen || !!editing}
          existing={editing}
          onClose={() => {
            setIsCreateOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            setIsCreateOpen(false);
            setEditing(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function CreateOrEditModal({
  salleId,
  isOpen,
  existing,
  onClose,
  onSaved,
}: {
  salleId: string;
  isOpen: boolean;
  existing: AbonnementCatalogue | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [durationDays, setDurationDays] = useState(String(existing?.durationDays ?? '30'));
  const [price, setPrice] = useState(String(existing?.price ?? ''));
  const [currency, setCurrency] = useState(existing?.currency ?? 'XOF');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Réinitialise les champs à chaque ouverture (création vs édition)
  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description ?? '');
      setDurationDays(String(existing.durationDays));
      setPrice(String(existing.price));
      setCurrency(existing.currency);
    } else {
      setName('');
      setDescription('');
      setDurationDays('30');
      setPrice('');
      setCurrency('XOF');
    }
  }, [existing]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (existing) {
        await apiClient.patch(`/salles/${salleId}/abonnement-catalogue/${existing.id}`, {
          name,
          price: Number(price),
        });
      } else {
        await apiClient.post(`/salles/${salleId}/abonnement-catalogue`, {
          name,
          description: description || undefined,
          durationDays: Number(durationDays),
          price: Number(price),
          currency,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={existing ? 'Modifier la formule' : 'Nouvelle formule'}>
      <form onSubmit={handleSubmit}>
        <Field label="Nom">
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Mensuel, Trimestriel..." />
        </Field>
        <Field label="Description (optionnel)">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Durée (jours)">
          <Input
            type="number"
            min="1"
            required
            disabled={!!existing}
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
          />
        </Field>
        <Field label="Prix">
          <Input type="number" min="0" required value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Devise">
          <Input required disabled={!!existing} value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </Field>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          {existing ? 'Enregistrer' : 'Créer la formule'}
        </Button>
      </form>
    </Modal>
  );
}
