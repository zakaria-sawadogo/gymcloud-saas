'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, QrCode, Download, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError, tokenStorage } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { Field, Select, Input } from '@/components/ui/Input';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { AdherentProfile, AdherentAbonnement, AbonnementCatalogue } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

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

export default function AdherentDetailPage() {
  const params = useParams<{ id: string }>();
  const adherentId = params.id;
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false);

  const { data: adherent, isLoading, refetch: refetchAdherent } = useApi<AdherentProfile>(
    `/adherents/${adherentId}`,
  );
  const { data: history, refetch: refetchHistory } = useApi<AdherentAbonnement[]>(
    `/adherents/${adherentId}/history`,
  );

  if (isLoading || !adherent) {
    return <p className="text-sm text-ink-400">Chargement...</p>;
  }

  const handleRegenerateQr = async () => {
    await apiClient.patch(`/adherents/${adherentId}/regenerate-qr`);
    refetchAdherent();
  };

  return (
    <div>
      <Link href="/adherents" className="mb-4 inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" />
        Retour aux adhérents
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">
            {adherent.user.firstName} {adherent.user.lastName}
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            {adherent.memberCode} · {adherent.user.phone}
          </p>
        </div>
        <StatusBadge status={adherent.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Historique des abonnements</CardTitle>
            <Button size="sm" onClick={() => setIsSubscribeOpen(true)}>
              Souscrire / Réabonner
            </Button>
          </CardHeader>

          {!history || history.length === 0 ? (
            <p className="text-sm text-ink-400">Aucun abonnement souscrit pour l'instant.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase text-ink-400">
                  <th className="py-2">Formule</th>
                  <th className="py-2">Début</th>
                  <th className="py-2">Fin</th>
                  <th className="py-2">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2.5">
                      {h.abonnementCatalogue?.name}
                      {h.isRenewal && <span className="ml-2 text-xs text-primary-600">(réabonnement)</span>}
                    </td>
                    <td className="py-2.5 text-ink-600">{formatDate(h.startDate)}</td>
                    <td className="py-2.5 text-ink-600">{formatDate(h.endDate)}</td>
                    <td className="py-2.5">
                      <StatusBadge status={h.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>QR Code</CardTitle>
          </CardHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-ink-50">
              <QrCode className="h-10 w-10 text-ink-400" />
            </div>
            <p className="break-all text-center font-mono text-xs text-ink-400">{adherent.qrCodeToken}</p>
            <Button variant="secondary" size="sm" onClick={handleRegenerateQr} className="w-full">
              <RefreshCw className="h-3.5 w-3.5" />
              Régénérer
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadPdf(`${API_URL}/adherents/${adherentId}/card`, `carte-membre-${adherentId}.pdf`)}
              className="w-full"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Carte membre (PDF)
            </Button>
          </div>
        </Card>
      </div>

      <SubscribeModal
        adherentId={adherentId}
        salleId={adherent.salleId}
        isOpen={isSubscribeOpen}
        onClose={() => setIsSubscribeOpen(false)}
        onSubscribed={() => {
          refetchHistory();
          refetchAdherent();
        }}
      />
    </div>
  );
}

/**
 * §5.7, §5.13, §8.3 — Le réabonnement encaisse désormais le paiement
 * dans la même action (auparavant : souscription seule, sans aucune
 * trace de paiement ni reçu généré). Le reçu n'est proposé au
 * téléchargement qu'APRÈS confirmation du paiement.
 */
function SubscribeModal({
  adherentId,
  salleId,
  isOpen,
  onClose,
  onSubscribed,
}: {
  adherentId: string;
  salleId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubscribed: () => void;
}) {
  const { data: catalogue } = useApi<AbonnementCatalogue[]>(
    isOpen ? `/salles/${salleId}/abonnement-catalogue` : null,
  );
  const [selected, setSelected] = useState('');
  const [method, setMethod] = useState<'ESPECES' | 'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE'>('ESPECES');
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState('');
  const [result, setResult] = useState<{ paymentId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedFormule = (catalogue ?? []).find((c) => c.id === selected);
  const isMobileMoney = method !== 'ESPECES';

  const handleSubmit = async () => {
    if (!selected) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ payment: { payment: { id: string } } }>(
        `/adherents/${adherentId}/subscribe-with-payment`,
        {
          abonnementCatalogueId: selected,
          payment: { method, phoneNumber: isMobileMoney ? mobileMoneyPhone : undefined },
        },
      );
      setResult({ paymentId: res.payment.payment.id });
      onSubscribed();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelected('');
    setMobileMoneyPhone('');
    setResult(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Souscrire un abonnement">
      {result ? (
        <div>
          <p className="mb-4 rounded-lg bg-primary-50 px-3 py-3 text-sm text-primary-700">
            {isMobileMoney
              ? 'Réabonnement enregistré — paiement Mobile Money en attente de confirmation.'
              : 'Réabonnement enregistré et paiement encaissé avec succès.'}
          </p>
          <Button
            variant="secondary"
            className="mb-4 w-full"
            onClick={() => downloadPdf(`${API_URL}/payments/${result.paymentId}/receipt`, `recu-${result.paymentId}.pdf`)}
          >
            <Download className="h-4 w-4" />
            Télécharger le reçu
          </Button>
          <Button onClick={handleClose} className="w-full">
            Fermer
          </Button>
        </div>
      ) : (
        <>
          <Field label="Formule">
            <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Sélectionner une formule</option>
              {(catalogue ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {formatCurrency(c.price, c.currency)} ({c.durationDays} jours)
                </option>
              ))}
            </Select>
          </Field>

          <p className="mb-4 text-xs text-ink-400">
            Si un abonnement est déjà actif, le nouveau prendra automatiquement la suite sans perte de jours (§5.13).
          </p>

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

          <Button onClick={handleSubmit} disabled={!selected} isLoading={isSubmitting} className="w-full">
            Confirmer et encaisser
          </Button>
        </>
      )}
    </Modal>
  );
}
