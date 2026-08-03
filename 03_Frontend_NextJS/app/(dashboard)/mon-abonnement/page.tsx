'use client';

import { useState } from 'react';
import { Download, Layers, RefreshCw, Smartphone, Gift, Copy, Check } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError, tokenStorage } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { ChangePlanModal } from '@/components/dashboard/ChangePlanModal';
import { SubscriptionHistoryTable } from '@/components/dashboard/SubscriptionHistoryTable';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { SaasSubscription, SaasInvoice, SaasPlan, Country } from '@/types';

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
  const { data: salles } = useApi<{ id: string; name: string }[]>('/salles');
  const { data: referral } = useApi<{ referralCode: string }>('/proprietaires/me/referral');

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

      {referral && <ReferralCard referralCode={referral.referralCode} />}

      <AddonsPanel salles={salles ?? []} />

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
                    {inv.status === 'EMISE' && inv.declaredAt ? (
                      <span className="rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700">
                        Déclaré · en attente de validation
                      </span>
                    ) : (
                      <StatusBadge status={inv.status} />
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => downloadInvoicePdf(inv.id, inv.invoiceNumber)}>
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </Button>
                      {inv.status === 'EMISE' && !inv.declaredAt && (
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

      <div className="mt-6">
        <SubscriptionHistoryTable apiPath="/saas/invoices/me/history" />
      </div>

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
  const [step, setStep] = useState<'initiate' | 'otp' | 'declared'>('initiate');
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
      // §9.8 — Un propriétaire ne peut jamais s'auto-valider : le
      // paiement est seulement déclaré, la facture reste EMISE jusqu'à
      // vérification SUPER_ADMIN. On informe plutôt que de fermer en
      // silence comme si c'était réglé.
      setStep('declared');
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
      ) : step === 'otp' ? (
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
      ) : (
        <>
          <p className="mb-3 rounded-lg bg-accent-50 px-3 py-3 text-sm text-accent-700">
            Paiement déclaré — en attente de validation par l'équipe GymCloud.
          </p>
          <p className="mb-4 text-sm text-ink-600">
            La facture sera marquée payée dès que le règlement sera vérifié — généralement sous peu.
          </p>
          <Button onClick={onPaid} className="w-full">
            Fermer
          </Button>
        </>
      )}
    </Modal>
  );
}

interface SubscriptionAddon {
  addonId: string;
  status: 'EN_ATTENTE' | 'ACTIF' | 'EXPIRE';
  durationMonths: number;
  endDate: string | null;
  autoRenew: boolean;
  addon: { id: string; name: string; description: string | null; price: number };
}

/**
 * §9.3 — Add-ons disponibles pour cette souscription. Jamais activés
 * automatiquement : chaque bascule appelle explicitement l'API pour
 * attacher/détacher, et le nouveau tarif est facturé séparément au
 * prorata (voir SaasBillingService.attachAddon), jamais reporté
 * silencieusement sur la prochaine facture.
 */
/**
 * §14.x — Affiche le code de parrainage du propriétaire, avec un
 * bouton copier. La récompense (un mois offert) n'est accordée que
 * lorsque le filleul règle réellement sa première facture — voir
 * SaasBillingService.rewardReferralIfFirstPayment côté backend,
 * jamais ici : cette carte se contente d'afficher le code.
 */
function ReferralCard({ referralCode }: { referralCode: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="mb-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary-50 p-2">
          <Gift className="h-5 w-5 text-primary-600" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-ink-900">Programme de parrainage</p>
          <p className="mt-1 text-sm text-ink-400">
            Partagez votre code — dès que la personne parrainée règle sa première facture, vous recevez un mois
            gratuit sur votre abonnement.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-lg bg-ink-50 px-3 py-2 font-mono text-sm font-semibold text-ink-900">
              {referralCode}
            </span>
            <Button size="sm" variant="ghost" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copié' : 'Copier'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function AddonsPanel({ salles }: { salles: { id: string; name: string }[] }) {
  const [selectedSalleId, setSelectedSalleId] = useState<string>('');
  const salleId = selectedSalleId || salles[0]?.id || '';

  const { data: allAddonsRaw, isLoading: isLoadingAddons } = useApi<
    { id: string; name: string; description: string | null; price: number; active: boolean }[]
  >('/saas/plans/addons');
  const {
    data: activeAddons,
    isLoading: isLoadingActive,
    error: activeError,
    refetch: refetchActive,
  } = useApi<SubscriptionAddon[]>(salleId ? `/saas/plans/salles/${salleId}/addons` : null, [salleId]);
  const {
    data: salleRequests,
    refetch: refetchSalleRequests,
  } = useApi<{ id: string; name: string; city: string; status: string }[]>('/salles/requests/mine');
  const [requestingAddon, setRequestingAddon] = useState<{ id: string; name: string; price: number } | null>(null);
  const [isRequestingSalle, setIsRequestingSalle] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  if (salles.length === 0) return null;
  if (isLoadingAddons || isLoadingActive) {
    return <Card className="mb-6 h-32 animate-pulse" />;
  }
  if (activeError) {
    return (
      <Card className="mb-6">
        <p className="text-sm text-red-600">Impossible de charger vos add-ons : {activeError}</p>
      </Card>
    );
  }
  if (!allAddonsRaw || allAddonsRaw.length === 0) return null;
  // §9.3 — Un add-on suspendu par le SUPER_ADMIN (type entier, pas une
  // instance précise) ne doit plus être proposé à l'activation.
  const allAddons = allAddonsRaw.filter((a) => a.active);
  if (allAddons.length === 0) return null;

  const byAddonId = new Map((activeAddons ?? []).map((a) => [a.addonId, a]));

  const cancelRequest = async (addonId: string) => {
    setTogglingId(addonId);
    try {
      await apiClient.delete(`/saas/plans/salles/${salleId}/addons/${addonId}`);
      refetchActive();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setTogglingId(null);
    }
  };

  const toggleAutoRenew = async (addonId: string, autoRenew: boolean) => {
    setTogglingId(addonId);
    try {
      await apiClient.patch(`/saas/plans/salles/${salleId}/addons/${addonId}/auto-renew`, { autoRenew });
      refetchActive();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <>
      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <CardHeader>
            <CardTitle>Add-ons disponibles</CardTitle>
          </CardHeader>
          {salles.length > 1 && (
            <Select value={salleId} onChange={(e) => setSelectedSalleId(e.target.value)} className="w-56">
              {salles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </div>
        <p className="mb-4 text-sm text-ink-500">
          Les add-ons s&apos;activent par salle — {salles.length > 1 ? 'chacune des vôtres peut avoir des add-ons différents. ' : ''}
          Jamais inclus automatiquement — une demande d&apos;activation crée une facture à régler, activée par notre
          équipe une fois le paiement validé.
        </p>
        <div className="divide-y divide-ink-100">
          {allAddons.map((addon) => {
            const current = byAddonId.get(addon.id);
            const isBusy = togglingId === addon.id;
            return (
              <div key={addon.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink-900">{addon.name}</p>
                    {current?.status === 'EN_ATTENTE' && <StatusBadge status="EN_ATTENTE" />}
                    {current?.status === 'ACTIF' && <StatusBadge status="ACTIF" />}
                  </div>
                  {addon.description && <p className="text-sm text-ink-500">{addon.description}</p>}
                  <p className="text-sm text-ink-600">{formatCurrency(addon.price)} / mois</p>
                  {current?.status === 'ACTIF' && current.endDate && (
                    <p className="text-xs text-ink-400">Jusqu&apos;au {formatDate(current.endDate)}</p>
                  )}
                  {current?.status === 'ACTIF' && (
                    <label className="mt-1 flex items-center gap-1.5 text-xs text-ink-600">
                      <input
                        type="checkbox"
                        checked={current.autoRenew}
                        disabled={isBusy}
                        onChange={(e) => toggleAutoRenew(addon.id, e.target.checked)}
                      />
                      Renouveler automatiquement
                      {!current.autoRenew && <span className="text-ink-400">— expirera le {current.endDate && formatDate(current.endDate)}</span>}
                    </label>
                  )}
                  {current?.status === 'EN_ATTENTE' && (
                    <p className="text-xs text-ink-400">En attente de validation du paiement</p>
                  )}
                </div>
                {!current && (
                  <Button size="sm" isLoading={isBusy} onClick={() => setRequestingAddon(addon)}>
                    Activer
                  </Button>
                )}
                {current?.status === 'EN_ATTENTE' && (
                  <Button size="sm" variant="ghost" isLoading={isBusy} onClick={() => cancelRequest(addon.id)}>
                    Annuler la demande
                  </Button>
                )}
                {current?.status === 'ACTIF' && (
                  <Button size="sm" variant="secondary" isLoading={isBusy} onClick={() => cancelRequest(addon.id)}>
                    Désactiver
                  </Button>
                )}
              </div>
            );
          })}
          <SalleSupplementaireRow
            requests={salleRequests ?? []}
            isRequesting={isRequestingSalle}
            onRequest={() => setIsRequestingSalle(true)}
          />
        </div>
      </Card>

      {requestingAddon && (
        <RequestAddonModal
          salleId={salleId}
          addon={requestingAddon}
          onClose={() => setRequestingAddon(null)}
          onRequested={() => {
            setRequestingAddon(null);
            refetchActive();
          }}
        />
      )}

      {isRequestingSalle && (
        <RequestSalleModal
          onClose={() => setIsRequestingSalle(false)}
          onRequested={() => {
            setIsRequestingSalle(false);
            refetchSalleRequests();
          }}
        />
      )}
    </>
  );
}

/**
 * §3.2, §14.x — Contrairement aux autres add-ons, une salle
 * supplémentaire n'est jamais créée directement : la demande génère
 * une facture (0 si dans le quota du plan, sinon le tarif "salle
 * supplémentaire"), et la salle n'existe qu'après validation
 * SUPER_ADMIN — même vérification systématique, avec ou sans argent
 * en jeu.
 */
function SalleSupplementaireRow({
  requests,
  isRequesting,
  onRequest,
}: {
  requests: { id: string; name: string; city: string; status: string }[];
  isRequesting: boolean;
  onRequest: () => void;
}) {
  const pending = requests.find((r) => r.status === 'EN_ATTENTE');

  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium text-ink-900">Salle supplémentaire</p>
          {pending && <StatusBadge status="EN_ATTENTE" />}
        </div>
        <p className="text-sm text-ink-500">
          Ouvrir une salle de plus — gratuite si dans le quota de votre plan, sinon facturée au tarif salle
          supplémentaire.
        </p>
        {pending && (
          <p className="text-xs text-ink-400">
            &quot;{pending.name}&quot; ({pending.city}) — en attente de validation
          </p>
        )}
      </div>
      {!pending && (
        <Button size="sm" isLoading={isRequesting} onClick={onRequest}>
          Demander
        </Button>
      )}
    </div>
  );
}

function RequestSalleModal({ onClose, onRequested }: { onClose: () => void; onRequested: () => void }) {
  const { data: countries } = useApi<Country[]>('/countries');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [countryId, setCountryId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post('/salles/requests', {
        name,
        email: email || undefined,
        phone,
        address,
        city,
        countryId,
      });
      onRequested();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Demander une salle supplémentaire">
      <p className="mb-4 text-sm text-ink-500">
        Une facture sera générée (0 si dans le quota de votre plan) — la salle n&apos;est créée qu&apos;après
        validation.
      </p>
      <Field label="Nom de la salle">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Téléphone">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="E-mail (optionnel)">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Adresse">
        <Input value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <Field label="Ville">
        <Input value={city} onChange={(e) => setCity(e.target.value)} />
      </Field>
      <Field label="Pays">
        <Select value={countryId} onChange={(e) => setCountryId(e.target.value)}>
          <option value="">Sélectionner un pays</option>
          {(countries ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Annuler
        </Button>
        <Button
          disabled={!name || !phone || !address || !city || !countryId}
          isLoading={isSubmitting}
          onClick={handleSubmit}
          className="flex-1"
        >
          Envoyer la demande
        </Button>
      </div>
    </Modal>
  );
}

/**
 * §9.3 — Demande d'activation d'un add-on : le propriétaire précise
 * la durée (12 mois par défaut), la facture correspondante n'est
 * réglée et l'add-on activé qu'après validation SUPER_ADMIN.
 */
function RequestAddonModal({
  salleId,
  addon,
  onClose,
  onRequested,
}: {
  salleId: string;
  addon: { id: string; name: string; price: number };
  onClose: () => void;
  onRequested: () => void;
}) {
  const [durationMonths, setDurationMonths] = useState(12);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAmount = addon.price * durationMonths;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/saas/plans/salles/${salleId}/addons/${addon.id}`, { durationMonths });
      onRequested();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Activer "${addon.name}"`}>
      <Field label="Durée (mois)">
        <Input
          type="number"
          min="1"
          value={durationMonths}
          onChange={(e) => setDurationMonths(Math.max(1, Number(e.target.value)))}
        />
      </Field>
      <p className="mb-4 text-sm text-ink-600">
        Total : <span className="font-semibold text-ink-900">{formatCurrency(totalAmount)}</span> pour {durationMonths}{' '}
        mois — une facture sera générée, à régler pour activer l&apos;add-on.
      </p>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Annuler
        </Button>
        <Button isLoading={isSubmitting} onClick={handleSubmit} className="flex-1">
          Demander l&apos;activation
        </Button>
      </div>
    </Modal>
  );
}
