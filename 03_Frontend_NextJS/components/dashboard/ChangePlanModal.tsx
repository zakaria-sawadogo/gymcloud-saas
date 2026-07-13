'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Select, Input } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import type { SaasPlan } from '@/types';

interface ChangePlanResult {
  planChangeApplied: boolean;
  prorata: { difference: number; invoiceId: string | null };
  payment: { immediate?: boolean; pendingValidation?: boolean; devOtpCode?: string } | null;
}

/**
 * §9.8, §9.12 — Changement/renouvellement de plan. Le comportement
 * diffère selon qui agit :
 *  - SUPER_ADMIN : applique immédiatement, encaisse directement s'il y
 *    a un montant dû (il EST le validateur, pas besoin de se
 *    valider lui-même).
 *  - PROPRIETAIRE (self-service) : un montant dû ne peut jamais
 *    s'auto-valider — le paiement est seulement DÉCLARÉ (espèces :
 *    déclaration immédiate ; Mobile Money : après code OTP), et le
 *    changement de plan n'est appliqué qu'après validation SUPER_ADMIN
 *    (voir "Validations en attente"). Un downgrade (crédit, rien à
 *    payer) reste appliqué tout de suite, peu importe qui agit.
 *
 * Composant partagé entre la page self-service du PROPRIETAIRE (Mon
 * abonnement) et la gestion SUPER_ADMIN depuis la fiche d'un
 * propriétaire — même flux, même garanties, un seul endroit à
 * maintenir.
 */
export function ChangePlanModal({
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
  const [method, setMethod] = useState<'ESPECES' | 'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE'>('ESPECES');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const [step, setStep] = useState<'form' | 'otp' | 'success' | 'pendingValidation'>('form');
  const [result, setResult] = useState<ChangePlanResult | null>(null);
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [otpLeadsToValidation, setOtpLeadsToValidation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMobileMoney = method !== 'ESPECES';

  const handleSubmit = async () => {
    if (!selectedPlanId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.patch<ChangePlanResult>(
        `/saas/plans/${subscriptionId}/change-plan/${selectedPlanId}`,
        { billingCycle, payment: { method, phoneNumber: isMobileMoney ? phoneNumber : undefined } },
      );
      setResult(res);
      if (res.payment?.devOtpCode) {
        // Mobile Money — étape OTP requise, que ce soit self-service
        // (mènera à "en attente de validation") ou SUPER_ADMIN (mènera
        // directement à "succès", il n'a personne à qui se valider).
        setPendingInvoiceId(res.prorata.invoiceId);
        setDevOtpCode(res.payment.devOtpCode);
        setOtpLeadsToValidation(!!res.payment.pendingValidation);
        setStep('otp');
      } else if (res.payment?.pendingValidation) {
        // Self-service espèces — déclaration immédiate, en attente de validation SUPER_ADMIN
        setStep('pendingValidation');
      } else {
        // SUPER_ADMIN (immédiat) ou aucun montant dû (downgrade/essai)
        setStep('success');
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmOtp = async () => {
    if (!otpCode || !pendingInvoiceId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post(`/saas/invoices/${pendingInvoiceId}/pay/mobile-money/confirm`, { otpCode });
      setStep(otpLeadsToValidation ? 'pendingValidation' : 'success');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedPlanId('');
    setMethod('ESPECES');
    setPhoneNumber('');
    setOtpCode('');
    setStep('form');
    setResult(null);
    setPendingInvoiceId(null);
    setDevOtpCode(null);
    setOtpLeadsToValidation(false);
    setError(null);
    onChanged();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Changer / renouveler le plan">
      {step === 'success' && result ? (
        <div>
          <p className="mb-3 rounded-lg bg-primary-50 px-3 py-3 text-sm text-primary-700">
            Abonnement mis à jour avec succès.
          </p>
          {result.prorata.difference !== 0 && (
            <p className="mb-4 text-sm text-ink-600">
              {result.prorata.difference > 0
                ? `Un complément de ${formatCurrency(result.prorata.difference)} a été encaissé au prorata des jours restants.`
                : `Un crédit de ${formatCurrency(Math.abs(result.prorata.difference))} a été appliqué au prorata des jours restants.`}
            </p>
          )}
          <Button onClick={handleClose} className="w-full">
            Fermer
          </Button>
        </div>
      ) : step === 'pendingValidation' && result ? (
        <div>
          <p className="mb-3 rounded-lg bg-accent-50 px-3 py-3 text-sm text-accent-700">
            Paiement déclaré — en attente de validation par l'équipe GymCloud.
          </p>
          <p className="mb-4 text-sm text-ink-600">
            Le complément de {formatCurrency(result.prorata.difference)} a été enregistré. Votre nouveau plan
            prendra effet dès que le règlement sera vérifié — généralement sous peu.
          </p>
          <Button onClick={handleClose} className="w-full">
            Fermer
          </Button>
        </div>
      ) : step === 'otp' ? (
        <div>
          <p className="mb-4 text-sm text-ink-600">
            Un code de confirmation à 6 chiffres a été envoyé au <strong>{phoneNumber}</strong>.
          </p>
          {devOtpCode && (
            <p className="mb-4 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700">
              Mode développement — code : <strong className="font-mono">{devOtpCode}</strong>
            </p>
          )}
          <Field label="Code de confirmation">
            <Input required value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="123456" maxLength={6} />
          </Field>
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button onClick={handleConfirmOtp} disabled={!otpCode} isLoading={isSubmitting} className="w-full">
            Confirmer
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
                  selectedPlanId === p.id ? 'border-primary-500 bg-primary-50' : 'border-ink-100 hover:border-primary-300'
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

          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">Si un montant est dû</p>
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
              <Input required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+226 70 00 00 00" />
            </Field>
          )}

          <p className="mb-4 text-xs text-ink-400">
            Le prorata des jours restants est calculé automatiquement. Un complément dû (upgrade) est déclaré puis
            vérifié par l'équipe GymCloud avant d'activer le nouveau plan ; un crédit (downgrade) est appliqué
            immédiatement, sans vérification nécessaire.
          </p>

          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button onClick={handleSubmit} disabled={!selectedPlanId} isLoading={isSubmitting} className="w-full">
            Confirmer le changement
          </Button>
        </div>
      )}
    </Modal>
  );
}
