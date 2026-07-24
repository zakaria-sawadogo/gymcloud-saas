'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { Users, Phone, CheckCircle2, XCircle } from 'lucide-react';
import { formatDateTime, formatCurrency } from '@/lib/utils';
import type { Prospect, AbonnementCatalogue } from '@/types';

const STATUS_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'NOUVEAU', label: 'Nouveaux' },
  { value: 'CONTACTE', label: 'Contactés' },
  { value: 'CONVERTI', label: 'Convertis' },
  { value: 'PERDU', label: 'Perdus' },
];

const SOURCE_LABELS: Record<string, string> = {
  INSCRIPTION: 'Inscription en ligne',
  ESSAI_GRATUIT: 'Essai gratuit',
};

/**
 * §3.2 — Suivi des prospects captés par le site public de la salle
 * (fitnessclub.gymcloud.africa). Un prospect n'est jamais un compte
 * adhérent : c'est ici que le gestionnaire suit ses relances, avant
 * de créer le vrai dossier via "Nouvel adhérent" (avec encaissement)
 * une fois l'inscription confirmée par téléphone.
 */
export default function ProspectsPage() {
  const { user } = useAuth();
  const salleId = user?.salle?.id;
  const [statusFilter, setStatusFilter] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [losingProspect, setLosingProspect] = useState<Prospect | null>(null);
  const [convertingProspect, setConvertingProspect] = useState<Prospect | null>(null);

  const { data: prospects, isLoading, error, refetch } = useApi<Prospect[]>(
    salleId ? `/prospects/salle/${salleId}${statusFilter ? `?status=${statusFilter}` : ''}` : null,
    [statusFilter],
  );

  const handleContacted = async (id: string) => {
    setActioningId(id);
    try {
      await apiClient.patch(`/prospects/${id}/contacted`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setActioningId(null);
    }
  };

  if (!salleId) return null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">Prospects</h1>
          <p className="mt-1 text-sm text-ink-400">
            Captés depuis le site public — appelez, puis créez le dossier adhérent une fois confirmé.
          </p>
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
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-ink-50" />
            ))}
          </div>
        ) : error ? (
          <p className="p-5 text-sm text-red-600">{error}</p>
        ) : !prospects || prospects.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Aucun prospect pour ce filtre"
            description="Les demandes d'inscription et d'essai gratuit depuis le site public de la salle apparaîtront ici."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase text-ink-400">
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Détail</th>
                <th className="px-5 py-3">Reçu le</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {prospects.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-ink-900">
                      {p.firstName} {p.lastName}
                    </p>
                    <p className="text-xs text-ink-400">{p.phone}</p>
                  </td>
                  <td className="px-5 py-3 text-ink-600">{SOURCE_LABELS[p.source] ?? p.source}</td>
                  <td className="px-5 py-3 text-ink-600">
                    {p.desiredCatalogue &&
                      `${p.desiredCatalogue.name} — ${formatCurrency(p.desiredCatalogue.price, p.desiredCatalogue.currency)}`}
                    {p.trialCoursCollectif &&
                      `${p.trialCoursCollectif.name} — ${formatDateTime(p.trialCoursCollectif.startAt)}`}
                    {p.message && <p className="mt-0.5 text-xs italic text-ink-400">"{p.message}"</p>}
                  </td>
                  <td className="px-5 py-3 text-ink-600">{formatDateTime(p.createdAt)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    {(p.status === 'NOUVEAU' || p.status === 'CONTACTE') && (
                      <div className="flex justify-end gap-2">
                        {p.status === 'NOUVEAU' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            isLoading={actioningId === p.id}
                            onClick={() => handleContacted(p.id)}
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Contacté
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setConvertingProspect(p)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Convertir
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setLosingProspect(p)}>
                          <XCircle className="h-3.5 w-3.5" />
                          Perdu
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {losingProspect && (
        <MarkLostModal
          prospect={losingProspect}
          onClose={() => setLosingProspect(null)}
          onDone={() => {
            setLosingProspect(null);
            refetch();
          }}
        />
      )}
      {convertingProspect && (
        <ConvertProspectModal
          prospect={convertingProspect}
          onClose={() => setConvertingProspect(null)}
          onDone={() => {
            setConvertingProspect(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function MarkLostModal({
  prospect,
  onClose,
  onDone,
}: {
  prospect: Prospect;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!note.trim()) {
      setError('Un motif est requis');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/prospects/${prospect.id}/lost`, { note });
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Marquer perdu — ${prospect.firstName} ${prospect.lastName}`}>
      <Field label="Motif">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: injoignable, plus intéressé..." />
      </Field>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button onClick={handleSubmit} isLoading={isSubmitting} className="w-full">
        Confirmer
      </Button>
    </Modal>
  );
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  ESPECES: 'Espèces',
  ORANGE_MONEY: 'Orange Money',
  MOOV_MONEY: 'Moov Money',
  WAVE: 'Wave',
};

/**
 * §3.2, §5.6 — Convertir un prospect crée réellement l'adhérent et
 * déclenche son premier paiement — avant cette évolution, "convertir"
 * ne faisait que changer l'étiquette de suivi, obligeant à ressaisir
 * l'inscription en double via "Nouvel adhérent".
 */
function ConvertProspectModal({
  prospect,
  onClose,
  onDone,
}: {
  prospect: Prospect;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const salleId = user?.salle?.id;
  const { data: catalogue } = useApi<AbonnementCatalogue[]>(salleId ? `/salles/${salleId}/abonnement-catalogue` : null);
  const [catalogueId, setCatalogueId] = useState(prospect.desiredCatalogueId ?? '');
  const [paymentMethod, setPaymentMethod] = useState('ESPECES');
  const [phoneNumber, setPhoneNumber] = useState(prospect.phone);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ tempPassword: string } | null>(null);

  const handleSubmit = async () => {
    if (!catalogueId) {
      setError('Choisissez une formule');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.patch<{ tempPassword: string }>(`/prospects/${prospect.id}/converted`, {
        abonnementCatalogueId: catalogueId,
        paymentMethod,
        phoneNumber: paymentMethod !== 'ESPECES' ? phoneNumber : undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result) {
    return (
      <Modal isOpen onClose={onDone} title="Adhérent créé">
        <p className="mb-3 text-sm text-ink-600">
          {prospect.firstName} {prospect.lastName} est maintenant adhérent, paiement encaissé.
        </p>
        <p className="mb-1 text-sm text-ink-600">
          Mot de passe temporaire — à lui communiquer directement (à changer à sa première connexion) :
        </p>
        <p className="mb-4 rounded-lg bg-ink-50 px-3 py-2 font-mono text-sm text-ink-900">{result.tempPassword}</p>
        <Button onClick={onDone} className="w-full">
          Fermer
        </Button>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title={`Convertir — ${prospect.firstName} ${prospect.lastName}`}>
      <Field label="Formule">
        <Select value={catalogueId} onChange={(e) => setCatalogueId(e.target.value)}>
          <option value="">Sélectionner une formule</option>
          {(catalogue ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {formatCurrency(c.price, c.currency)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Moyen de paiement">
        <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      {paymentMethod !== 'ESPECES' && (
        <Field label="Numéro Mobile Money">
          <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
        </Field>
      )}
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button onClick={handleSubmit} isLoading={isSubmitting} className="w-full">
        Confirmer et encaisser
      </Button>
    </Modal>
  );
}
