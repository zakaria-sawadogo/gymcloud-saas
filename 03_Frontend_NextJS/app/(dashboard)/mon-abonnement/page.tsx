'use client';

import { useState } from 'react';
import { Download, Layers, RefreshCw, Smartphone } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError, tokenStorage } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { SaasSubscription, SaasInvoice, SaasPlan } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function downloadInvoicePdf(invoiceId: string, invoiceNumber: string) {
  const token = tokenStorage.getAccessToken();
  const res = await fetch(`${API_URL}/saas/invoices/${invoiceId}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    alert('Impossible de télécharger la facture');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `facture-${invoiceNumber}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * §9.12 — Un propriétaire peut désormais changer/renouveler son plan
 * lui-même (auparavant réservé au SUPER_ADMIN). Le prorata est
 * calculé et éventuellement facturé automatiquement côté backend
 * (SaasBillingService.changePlan) — cette page se contente de
 * proposer le choix et d'afficher le résultat.
 */
export default function MonAbonnementPage() {
  const [isChangePlanOpen, setIsChangePlanOpen] = useState(false);
  const [invoiceToPay, setInvoiceToPay] = useState<SaasInvoice | null>(null);

  const {
    data: subscription,
    isLoading,
    error,
    refetch: refetchSubscription,
  } = useApi<SaasSubscription>('/saas/invoices/me/subscription');
  const { data: invoices, refetch: refetchInvoices } = useApi<SaasInvoice[]>('/saas/invoices/me/invoices');

  if (isLoading) return <p className="text-sm text-ink-400">Chargement...</p>;
  if (error || !subscription) return <p className="text-sm text-red-600">{error ?? 'Aucune souscription'}</p>;

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-semibold text-ink-900">Mon abonnement</h1>

      <Card className="mb-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-sm text-ink-400">Plan actuel</p>
            <p className="font-display text-2xl font-semibold text-ink-900">{subscription.saasPlan.name}</p>
          </div>
          <StatusBadge status={subscription.status} />
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-ink-400">Cycle</p>
            <p className="font-medium text-ink-900">{subscription.billingCycle === 'ANNUEL' ? 'Annuel' : 'Mensuel'}</p>
          </div>
          <div>
            <p className="text-ink-400">Prochaine échéance</p>
            <p className="font-medium text-ink-900">{formatDate(subscription.currentPeriodEnd)}</p>
          </div>
          <div>
            <p className="text-ink-400">Tarif</p>
            <p className="font-medium text-ink-900">
              {formatCurrency(
                subscription.billingCycle === 'ANNUEL' ? subscription.saasPlan.priceAnnual : subscription.saasPlan.priceMonthly,
              )}
            </p>
          </div>
        </div>
        <Button className="mt-4" variant="secondary" onClick={() => setIsChangePlanOpen(true)}>
          <RefreshCw className="h-4 w-4" />
          Changer / renouveler mon plan
        </Button>
      </Card>

      <Card className="p-0">
        <div className="p-5 pb-0">
          <CardHeader>
            <CardTitle>Mes factures</CardTitle>
          </CardHeader>
        </div>
        {!invoices || invoices.length === 0 ? (
          <EmptyState icon={<Layers className="h-6 w-6" />} title="Aucune facture pour le moment" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase text-ink-400">
                <th className="px-5 py-3">N° Facture</th>
                <th className="px-5 py-3">Période</th>
                <th className="px-5 py-3">Montant</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-5 py-3 font-mono text-xs text-ink-600">{inv.invoiceNumber}</td>
                  <td className="px-5 py-3 text-ink-600">
                    {formatDate(inv.periodStart)} → {formatDate(inv.periodEnd)}
                  </td>
                  <td className="px-5 py-3 font-medium text-ink-900">{formatCurrency(inv.totalAmount, inv.currency)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => downloadInvoicePdf(inv.id, inv.invoiceNumber)}>
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </Button>
                      {inv.status === 'EMISE' && (
                        <Button size="sm" variant="secondary" onClick={() => setInvoiceToPay(inv)}>
                          <Smartphone className="h-3.5 w-3.5" />
                          Payer
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ChangePlanModal
        subscriptionId={subscription.id}
        currentPlanId={subscription.saasPlanId}
        currentBillingCycle={subscription.billingCycle}
        isOpen={isChangePlanOpen}
        onClose={() => setIsChangePlanOpen(false)}
        onChanged={() => {
          setIsChangePlanOpen(false);
          refetchSubscription();
          refetchInvoices();
        }}
      />

      {invoiceToPay && (
        <PayMobileMoneyModal
          invoice={invoiceToPay}
          onClose={() => setInvoiceToPay(null)}
          onPaid={() => {
            setInvoiceToPay(null);
            refetchSubscription();
            refetchInvoices();
          }}
        />
      )}
    </div>
  );
}

function ChangePlanModal({
  subscriptionId,
  currentPlanId,
  currentBillingCycle,
  isOpen,
  onClose,
  onChanged,
}: {
  subscriptionId: string;
  currentPlanId: string;
  currentBillingCycle: 'MENSUEL' | 'ANNUEL';
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data: plans } = useApi<SaasPlan[]>(isOpen ? '/saas/plans' : null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [billingCycle, setBillingCycle] = useState<'MENSUEL' | 'ANNUEL'>(currentBillingCycle);
  const [result, setResult] = useState<{ prorata: { difference: number } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!selectedPlanId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.patch<{ prorata: { difference: number } }>(
        `/saas/plans/${subscriptionId}/change-plan/${selectedPlanId}`,
        { billingCycle },
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedPlanId('');
    setResult(null);
    onChanged();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Changer / renouveler mon plan">
      {result ? (
        <div>
          <p className="mb-3 rounded-lg bg-primary-50 px-3 py-3 text-sm text-primary-700">
            Abonnement mis à jour avec succès.
          </p>
          {result.prorata.difference !== 0 && (
            <p className="mb-4 text-sm text-ink-600">
              {result.prorata.difference > 0
                ? `Un complément de ${formatCurrency(result.prorata.difference)} a été facturé au prorata des jours restants — retrouvez la facture dans "Mes factures".`
                : `Un crédit de ${formatCurrency(Math.abs(result.prorata.difference))} a été appliqué au prorata des jours restants.`}
            </p>
          )}
          <Button onClick={handleClose} className="w-full">
            Fermer
          </Button>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">Périodicité</p>
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setBillingCycle('MENSUEL')}
              className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                billingCycle === 'MENSUEL' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-ink-100 text-ink-600'
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('ANNUEL')}
              className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                billingCycle === 'ANNUEL' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-ink-100 text-ink-600'
              }`}
            >
              Annuel
            </button>
          </div>

          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">Plan</p>
          <div className="mb-4 space-y-2">
            {(plans ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPlanId(p.id)}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                  selectedPlanId === p.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-ink-100 hover:border-primary-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-900">
                    {p.name}
                    {p.id === currentPlanId && <span className="ml-2 text-xs text-ink-400">(plan actuel)</span>}
                  </span>
                  <span className="text-sm font-semibold text-ink-900">
                    {formatCurrency(billingCycle === 'ANNUEL' ? p.priceAnnual : p.priceMonthly)}
                    {billingCycle === 'ANNUEL' ? '/an' : '/mois'}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <p className="mb-4 text-xs text-ink-400">
            Un ajustement au prorata des jours restants sur la période en cours sera calculé automatiquement.
          </p>

          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button onClick={handleConfirm} disabled={!selectedPlanId} isLoading={isSubmitting} className="w-full">
            Confirmer le changement
          </Button>
        </div>
      )}
    </Modal>
  );
}

/**
 * §9.8 — Paiement self-service Mobile Money, en deux temps : le
 * propriétaire choisit son opérateur et son numéro, reçoit un code de
 * confirmation (OTP), puis le saisit pour solder la facture. Simule
 * un vrai flux opérateur (Orange/Moov/Wave) — voir le commentaire de
 * classe sur SaasBillingService pour la simplification assumée
 * (aucune intégration réelle avec les opérateurs à ce stade).
 */
function PayMobileMoneyModal({
  invoice,
  onClose,
  onPaid,
}: {
  invoice: SaasInvoice;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [step, setStep] = useState<'initiate' | 'otp'>('initiate');
  const [method, setMethod] = useState<'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE'>('ORANGE_MONEY');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInitiate = async () => {
    if (!phoneNumber) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ devOtpCode: string }>(`/saas/invoices/${invoice.id}/pay/mobile-money/initiate`, {
        method,
        phoneNumber,
      });
      setDevOtpCode(res.devOtpCode ?? null);
      setStep('otp');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!otpCode) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post(`/saas/invoices/${invoice.id}/pay/mobile-money/confirm`, { otpCode });
      onPaid();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Payer la facture ${invoice.invoiceNumber}`}>
      <div className="mb-4 rounded-lg bg-ink-50 px-3 py-3">
        <p className="font-display text-xl font-semibold text-ink-900">
          {formatCurrency(invoice.totalAmount, invoice.currency)}
        </p>
      </div>

      {step === 'initiate' ? (
        <>
          <Field label="Opérateur">
            <Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value="ORANGE_MONEY">Orange Money</option>
              <option value="MOOV_MONEY">Moov Money</option>
              <option value="WAVE">Wave</option>
            </Select>
          </Field>
          <Field label="Numéro Mobile Money">
            <Input
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+226 70 00 00 00"
            />
          </Field>

          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button onClick={handleInitiate} disabled={!phoneNumber} isLoading={isSubmitting} className="w-full">
            Recevoir le code de confirmation
          </Button>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-600">
            Un code de confirmation à 6 chiffres a été envoyé au <strong>{phoneNumber}</strong>.
          </p>
          {devOtpCode && (
            <p className="mb-4 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700">
              Mode développement — code : <strong className="font-mono">{devOtpCode}</strong>
            </p>
          )}
          <Field label="Code de confirmation">
            <Input
              required
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
            />
          </Field>

          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button onClick={handleConfirm} disabled={!otpCode} isLoading={isSubmitting} className="w-full">
            Confirmer le paiement
          </Button>
        </>
      )}
    </Modal>
  );
}
