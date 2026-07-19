'use client';

import { useState, type FormEvent } from 'react';
import { Plus, Wallet, Receipt, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { Payment, AdherentProfile } from '@/types';

interface CaisseSummary {
  date: string;
  transactionCount: number;
  total: number;
  byMethod: Record<string, number>;
}

const METHOD_LABELS: Record<string, string> = {
  ESPECES: 'Espèces',
  ORANGE_MONEY: 'Orange Money',
  MOOV_MONEY: 'Moov Money',
  WAVE: 'Wave',
  CARTE_BANCAIRE: 'Carte bancaire',
  VIREMENT: 'Virement',
};

/**
 * Vue Paiements & Caisse, paramétrée par salle plutôt que déduite de
 * `user.salle.id` — permet au SUPER_ADMIN et au PROPRIETAIRE de gérer
 * les paiements de n'importe quelle salle depuis sa fiche détail
 * (`/salles/[id]`), pas seulement au Gestionnaire sur sa propre salle
 * (qui continue d'y accéder via `/payments`, désormais un simple
 * wrapper autour de ce composant).
 */
export function SallePaymentsView({ salleId, currency }: { salleId: string; currency: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: caisse, refetch: refetchCaisse } = useApi<CaisseSummary>(
    `/payments/salle/${salleId}/caisse`,
  );
  const { data: payments, refetch: refetchPayments } = useApi<Payment[]>(`/payments/salle/${salleId}`);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-ink-900">Paiements & Caisse</h2>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Encaisser un paiement
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <p className="mb-1 text-sm text-ink-400">Total encaissé aujourd'hui</p>
          <p className="font-display text-2xl font-semibold text-primary-600">
            {formatCurrency(caisse?.total ?? 0)}
          </p>
        </Card>
        <Card>
          <p className="mb-1 text-sm text-ink-400">Transactions</p>
          <p className="font-display text-2xl font-semibold text-ink-900">{caisse?.transactionCount ?? 0}</p>
        </Card>
        {Object.entries(caisse?.byMethod ?? {})
          .slice(0, 2)
          .map(([method, amount]) => (
            <Card key={method}>
              <p className="mb-1 text-sm text-ink-400">{METHOD_LABELS[method] ?? method}</p>
              <p className="font-display text-2xl font-semibold text-ink-900">{formatCurrency(amount)}</p>
            </Card>
          ))}
      </div>

      <PendingSubscriptionRequests salleId={salleId} />

      <Card className="p-0">
        <div className="p-5 pb-0">
          <CardHeader>
            <CardTitle>Historique des paiements</CardTitle>
          </CardHeader>
        </div>

        {!payments || payments.length === 0 ? (
          <EmptyState icon={<Receipt className="h-6 w-6" />} title="Aucun paiement enregistré" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase text-ink-400">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Adhérent</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Méthode</th>
                <th className="px-5 py-3">Montant</th>
                <th className="px-5 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3 text-ink-600">{formatDateTime(p.createdAt)}</td>
                  <td className="px-5 py-3 font-medium text-ink-900">
                    {p.adherent ? `${p.adherent.user.firstName} ${p.adherent.user.lastName}` : '—'}
                  </td>
                  <td className="px-5 py-3 text-ink-800">{p.type}</td>
                  <td className="px-5 py-3 text-ink-600">{METHOD_LABELS[p.method] ?? p.method}</td>
                  <td className="px-5 py-3 font-medium text-ink-900">{formatCurrency(p.amount, p.currency)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <RecordPaymentModal
        salleId={salleId}
        currency={currency}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRecorded={() => {
          setIsModalOpen(false);
          refetchCaisse();
          refetchPayments();
        }}
      />
    </div>
  );
}

function RecordPaymentModal({
  salleId,
  currency,
  isOpen,
  onClose,
  onRecorded,
}: {
  salleId: string;
  currency: string;
  isOpen: boolean;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const { data: adherents } = useApi<AdherentProfile[]>(
    isOpen ? `/adherents/salle/${salleId}?status=ACTIF` : null,
  );

  const [adherentId, setAdherentId] = useState('');
  const [method, setMethod] = useState<'ESPECES' | 'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE'>('ESPECES');
  const [type, setType] = useState<'ABONNEMENT' | 'SEANCE' | 'AUTRE'>('ABONNEMENT');
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponInfo, setCouponInfo] = useState<{ discountType: 'PERCENT' | 'FIXED'; discountValue: number } | null>(
    null,
  );
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMobileMoney = method !== 'ESPECES';
  const adherentRequired = type !== 'AUTRE';

  const numericAmount = Number(amount) || 0;
  const discountAmount = couponInfo
    ? couponInfo.discountType === 'PERCENT'
      ? (numericAmount * couponInfo.discountValue) / 100
      : couponInfo.discountValue
    : 0;
  const finalAmount = Math.max(0, numericAmount - discountAmount);

  const handleCheckCoupon = async () => {
    if (!couponCode) return;
    setIsCheckingCoupon(true);
    setCouponError(null);
    setCouponInfo(null);
    try {
      const coupon = await apiClient.get<{ discountType: 'PERCENT' | 'FIXED'; discountValue: number }>(
        `/salles/${salleId}/coupons/${couponCode}/validate`,
      );
      setCouponInfo(coupon);
    } catch (err) {
      setCouponError(err instanceof ApiClientError ? err.message : 'Coupon invalide');
    } finally {
      setIsCheckingCoupon(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const basePayload = {
        salleId,
        adherentId: adherentId || undefined,
        type,
        amount: numericAmount,
        currency,
        couponCode: couponInfo ? couponCode : undefined,
      };
      if (isMobileMoney) {
        await apiClient.post('/payments/mobile-money/initiate', {
          ...basePayload,
          method,
          phoneNumber,
        });
      } else {
        await apiClient.post('/payments/cash', basePayload);
      }
      setAdherentId('');
      setAmount('');
      setPhoneNumber('');
      setCouponCode('');
      setCouponInfo(null);
      onRecorded();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Encaisser un paiement">
      <form onSubmit={handleSubmit}>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="ABONNEMENT">Abonnement</option>
            <option value="SEANCE">Séance</option>
            <option value="AUTRE">Autre</option>
          </Select>
        </Field>

        <Field label={adherentRequired ? 'Adhérent' : 'Adhérent (optionnel)'}>
          <Select required={adherentRequired} value={adherentId} onChange={(e) => setAdherentId(e.target.value)}>
            <option value="">{adherentRequired ? 'Sélectionner un adhérent' : 'Aucun (vente anonyme)'}</option>
            {(adherents ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.user.firstName} {a.user.lastName} ({a.memberCode})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Moyen de paiement">
          <Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
            <option value="ESPECES">Espèces</option>
            <option value="ORANGE_MONEY">Orange Money</option>
            <option value="MOOV_MONEY">Moov Money</option>
            <option value="WAVE">Wave</option>
          </Select>
        </Field>

        <Field label={`Montant (${currency})`}>
          <Input type="number" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>

        <Field label="Coupon (optionnel)">
          <div className="flex gap-2">
            <Input
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value.toUpperCase());
                setCouponInfo(null);
                setCouponError(null);
              }}
              placeholder="CODE"
              className="uppercase"
            />
            <Button
              type="button"
              variant="secondary"
              isLoading={isCheckingCoupon}
              onClick={handleCheckCoupon}
              disabled={!couponCode}
            >
              Vérifier
            </Button>
          </div>
          {couponError && <p className="mt-1 text-xs text-red-600">{couponError}</p>}
          {couponInfo && (
            <p className="mt-1 text-xs text-primary-700">
              Coupon valide : -{couponInfo.discountType === 'PERCENT' ? `${couponInfo.discountValue}%` : `${couponInfo.discountValue} ${currency}`}
              {numericAmount > 0 && ` → montant final : ${finalAmount.toLocaleString('fr-FR')} ${currency}`}
            </p>
          )}
        </Field>

        {isMobileMoney && (
          <Field label="Numéro Mobile Money">
            <Input
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+226 70 00 00 00"
            />
          </Field>
        )}

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          <Wallet className="h-4 w-4" />
          {isMobileMoney ? 'Initier le paiement' : 'Encaisser'}
        </Button>
      </form>
    </Modal>
  );
}

/**
 * §5.6, §8.3 — Demandes de souscription/réabonnement initiées par
 * l'adhérent depuis l'app mobile. Symétrique de "Validations en
 * attente" côté SUPER_ADMIN (facturation SaaS) : l'adhérent ne peut
 * jamais s'auto-valider — le gestionnaire constate la réception réelle
 * des fonds avant que l'abonnement ne s'active et que le reçu ne soit
 * généré.
 */
function PendingSubscriptionRequests({ salleId }: { salleId: string }) {
  const { data: pending, isLoading, refetch } = useApi<Payment[]>(
    `/adherents/salle/${salleId}/pending-subscriptions`,
  );
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectingPayment, setRejectingPayment] = useState<Payment | null>(null);

  const handleApprove = async (paymentId: string) => {
    setActioningId(paymentId);
    try {
      await apiClient.patch(`/adherents/pending-subscriptions/${paymentId}/approve`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setActioningId(null);
    }
  };

  if (isLoading) return null;

  return (
    <>
      <Card className="mb-6 border-accent-200 bg-accent-50/40 p-0">
        <div className="flex items-center gap-2 border-b border-accent-100 px-5 py-4">
          <Clock className="h-4 w-4 text-accent-700" />
          <h2 className="font-display text-base font-semibold text-ink-900">
            Demandes en attente ({pending?.length ?? 0})
          </h2>
        </div>
        {!pending || pending.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-6 w-6" />}
            title="Aucune demande en attente"
            description="Apparaît ici dès qu'un adhérent demande un abonnement ou un réabonnement depuis l'application mobile."
          />
        ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-accent-100 text-left text-xs font-medium uppercase text-ink-400">
              <th className="px-5 py-3">Adhérent</th>
              <th className="px-5 py-3">Montant</th>
              <th className="px-5 py-3">Méthode déclarée</th>
              <th className="px-5 py-3">Demandé le</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-accent-100">
            {pending.map((p) => (
              <tr key={p.id}>
                <td className="px-5 py-3 font-medium text-ink-900">
                  {p.adherent ? `${p.adherent.user.firstName} ${p.adherent.user.lastName}` : '—'}
                </td>
                <td className="px-5 py-3 font-medium text-ink-900">{formatCurrency(p.amount, p.currency)}</td>
                <td className="px-5 py-3 text-ink-600">
                  {METHOD_LABELS[p.method] ?? p.method}
                  {p.reference && <span className="ml-1 text-xs text-ink-400">({p.reference})</span>}
                </td>
                <td className="px-5 py-3 text-ink-600">{formatDateTime(p.createdAt)}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      isLoading={actioningId === p.id}
                      onClick={() => handleApprove(p.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approuver
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRejectingPayment(p)}>
                      <XCircle className="h-3.5 w-3.5" />
                      Rejeter
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </Card>

      {rejectingPayment && (
        <RejectSubscriptionRequestModal
          payment={rejectingPayment}
          onClose={() => setRejectingPayment(null)}
          onRejected={() => {
            setRejectingPayment(null);
            refetch();
          }}
        />
      )}
    </>
  );
}

function RejectSubscriptionRequestModal({
  payment,
  onClose,
  onRejected,
}: {
  payment: Payment;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/adherents/pending-subscriptions/${payment.id}/reject`, { reason: reason || undefined });
      onRejected();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Rejeter la demande">
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-sm text-ink-600">
          Les fonds n'ont pas été retrouvés ? L'adhérent pourra soumettre une nouvelle demande depuis l'app.
        </p>
        <Field label="Motif (optionnel)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: référence introuvable" />
        </Field>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Confirmer le rejet
        </Button>
      </form>
    </Modal>
  );
}
