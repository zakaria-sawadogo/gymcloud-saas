'use client';

import { useState, type FormEvent } from 'react';
import { Plus, Wallet, Receipt } from 'lucide-react';
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
export function SallePaymentsView({ salleId }: { salleId: string }) {
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
  isOpen,
  onClose,
  onRecorded,
}: {
  salleId: string;
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
        currency: 'XOF',
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

        <Field label="Montant (XOF)">
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
              Coupon valide : -{couponInfo.discountType === 'PERCENT' ? `${couponInfo.discountValue}%` : `${couponInfo.discountValue} XOF`}
              {numericAmount > 0 && ` → montant final : ${finalAmount.toLocaleString('fr-FR')} XOF`}
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
