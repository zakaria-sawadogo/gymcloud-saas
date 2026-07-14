'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2, Receipt, Download, XCircle, Clock } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError, tokenStorage } from '@/lib/api-client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { SaasInvoice } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * Le PDF est binaire et protégé par Bearer token — un simple lien
 * `<a href>` ne peut pas envoyer l'en-tête d'autorisation. On récupère
 * donc le fichier via fetch() authentifié, puis on déclenche le
 * téléchargement à partir du blob obtenu.
 */
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

const STATUS_FILTERS = [
  { value: '', label: 'Toutes' },
  { value: 'EMISE', label: 'En attente' },
  { value: 'PAYEE', label: 'Payées' },
  { value: 'EN_RETARD', label: 'En retard' },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  VIREMENT: 'Virement bancaire',
  ESPECES: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  CHEQUE: 'Chèque',
};

/**
 * §9.13 — Facturation SaaS : GymCloud facture ses propriétaires
 * (distinct des paiements adhérent → salle, gérés par ailleurs). Les
 * factures sont générées automatiquement par le moteur SaaS ; cette
 * page permet de les consulter et de les **encaisser** — méthode et
 * référence de paiement requises, à l'image de l'encaissement
 * adhérent → salle, pas un simple bouton "marquer payée" sans trace.
 */
export default function FacturationSaasPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [invoiceToPay, setInvoiceToPay] = useState<SaasInvoice | null>(null);

  const { data: invoices, isLoading, error, refetch } = useApi<SaasInvoice[]>(
    `/saas/invoices${statusFilter ? `?status=${statusFilter}` : ''}`,
    [statusFilter],
  );

  const totalEnAttente = (invoices ?? [])
    .filter((i) => i.status === 'EMISE')
    .reduce((sum, i) => sum + Number(i.totalAmount), 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Facturation SaaS</h1>
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

      {totalEnAttente > 0 && (
        <Card className="mb-6">
          <p className="mb-1 text-sm text-ink-400">Total en attente de règlement</p>
          <p className="font-display text-2xl font-semibold text-accent-600">
            {formatCurrency(totalEnAttente)}
          </p>
        </Card>
      )}

      <PendingValidationSection />

      <Card className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-ink-50" />
            ))}
          </div>
        ) : error ? (
          <p className="p-5 text-sm text-red-600">{error}</p>
        ) : !invoices || invoices.length === 0 ? (
          <EmptyState icon={<Receipt className="h-6 w-6" />} title="Aucune facture SaaS pour ce filtre" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase text-ink-400">
                <th className="px-5 py-3">N° Facture</th>
                <th className="px-5 py-3">Propriétaire</th>
                <th className="px-5 py-3">Plan</th>
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
                  <td className="px-5 py-3 font-medium text-ink-900">
                    {inv.subscription.proprietaire.user.firstName} {inv.subscription.proprietaire.user.lastName}
                  </td>
                  <td className="px-5 py-3 text-ink-600">{inv.subscription.saasPlan.name}</td>
                  <td className="px-5 py-3 text-ink-600">
                    {formatDate(inv.periodStart)} → {formatDate(inv.periodEnd)}
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-medium text-ink-900">{formatCurrency(inv.totalAmount, inv.currency)}</span>
                    {inv.extraSallesCount > 0 && (
                      <span className="ml-1 text-xs text-ink-400">
                        (dont {inv.extraSallesCount} salle{inv.extraSallesCount > 1 ? 's' : ''} suppl.)
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={inv.status} />
                    {inv.status === 'PAYEE' && inv.paymentMethod && (
                      <p className="mt-0.5 text-xs text-ink-400">
                        {PAYMENT_METHOD_LABELS[inv.paymentMethod] ?? inv.paymentMethod}
                        {inv.paymentReference && ` · ${inv.paymentReference}`}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => downloadInvoicePdf(inv.id, inv.invoiceNumber)}>
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </Button>
                      {inv.status === 'EMISE' && (
                        <Button size="sm" variant="secondary" onClick={() => setInvoiceToPay(inv)}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Encaisser
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

      {invoiceToPay && (
        <EncaisserInvoiceModal
          invoice={invoiceToPay}
          onClose={() => setInvoiceToPay(null)}
          onEncaisse={() => {
            setInvoiceToPay(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function EncaisserInvoiceModal({
  invoice,
  onClose,
  onEncaisse,
}: {
  invoice: SaasInvoice;
  onClose: () => void;
  onEncaisse: () => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState('VIREMENT');
  const [paymentReference, setPaymentReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/saas/invoices/${invoice.id}/mark-paid`, {
        paymentMethod,
        paymentReference: paymentReference || undefined,
      });
      onEncaisse();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Encaisser la facture ${invoice.invoiceNumber}`}>
      <form onSubmit={handleSubmit}>
        <div className="mb-4 rounded-lg bg-ink-50 px-3 py-3">
          <p className="text-sm text-ink-600">
            {invoice.subscription.proprietaire.user.firstName} {invoice.subscription.proprietaire.user.lastName} —{' '}
            {invoice.subscription.saasPlan.name}
          </p>
          <p className="font-display text-xl font-semibold text-ink-900">
            {formatCurrency(invoice.totalAmount, invoice.currency)}
          </p>
        </div>

        <Field label="Moyen de paiement">
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="VIREMENT">Virement bancaire</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="ESPECES">Espèces</option>
            <option value="CHEQUE">Chèque</option>
          </Select>
        </Field>

        <Field label="Référence (optionnel)">
          <Input
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="Référence bancaire, n° de transaction..."
          />
        </Field>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Confirmer l'encaissement
        </Button>
      </form>
    </Modal>
  );
}

const DECLARED_METHOD_LABELS: Record<string, string> = {
  ESPECES: 'Espèces',
  ORANGE_MONEY: 'Orange Money',
  MOOV_MONEY: 'Moov Money',
  WAVE: 'Wave',
  ESSAI_GRATUIT: 'Essai gratuit (0 XOF)',
};

/**
 * §9.8, §9.12 — Un propriétaire ne peut jamais s'auto-valider : quand
 * il règle une facture ou change de plan lui-même, le paiement est
 * seulement DÉCLARÉ (facture toujours EMISE). Cette section liste ces
 * déclarations pour que le SUPER_ADMIN/RESPONSABLE_FINANCE vérifie
 * réellement la réception des fonds avant d'approuver — et
 * d'appliquer, le cas échéant, le changement de plan qui en dépend.
 */
function PendingValidationSection() {
  const { data: pending, isLoading, refetch } = useApi<SaasInvoice[]>('/saas/invoices/pending-validation');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectingInvoice, setRejectingInvoice] = useState<SaasInvoice | null>(null);

  const handleApprove = async (invoiceId: string) => {
    setActioningId(invoiceId);
    try {
      await apiClient.patch(`/saas/invoices/${invoiceId}/approve`);
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
            Validations en attente ({pending?.length ?? 0})
          </h2>
        </div>
        {!pending || pending.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-6 w-6" />}
            title="Aucune validation en attente"
            description="Apparaît ici dès qu'un propriétaire déclare un paiement pour un changement de plan depuis son espace."
          />
        ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-accent-100 text-left text-xs font-medium uppercase text-ink-400">
              <th className="px-5 py-3">Propriétaire</th>
              <th className="px-5 py-3">Montant</th>
              <th className="px-5 py-3">Méthode déclarée</th>
              <th className="px-5 py-3">Déclaré le</th>
              <th className="px-5 py-3">Plan</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-accent-100">
            {pending.map((inv) => (
              <tr key={inv.id}>
                <td className="px-5 py-3 font-medium text-ink-900">
                  {inv.subscription.proprietaire.user.firstName} {inv.subscription.proprietaire.user.lastName}
                </td>
                <td className="px-5 py-3 font-medium text-ink-900">{formatCurrency(inv.totalAmount, inv.currency)}</td>
                <td className="px-5 py-3 text-ink-600">
                  {DECLARED_METHOD_LABELS[inv.declaredPaymentMethod ?? ''] ?? inv.declaredPaymentMethod}
                  {inv.declaredPaymentReference && (
                    <span className="ml-1 text-xs text-ink-400">({inv.declaredPaymentReference})</span>
                  )}
                </td>
                <td className="px-5 py-3 text-ink-600">{inv.declaredAt ? formatDate(inv.declaredAt) : '—'}</td>
                <td className="px-5 py-3 text-ink-600">
                  {inv.pendingPlanId ? 'Changement de plan en attente' : '—'}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      isLoading={actioningId === inv.id}
                      onClick={() => handleApprove(inv.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approuver
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRejectingInvoice(inv)}>
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

      {rejectingInvoice && (
        <RejectDeclarationModal
          invoice={rejectingInvoice}
          onClose={() => setRejectingInvoice(null)}
          onRejected={() => {
            setRejectingInvoice(null);
            refetch();
          }}
        />
      )}
    </>
  );
}

function RejectDeclarationModal({
  invoice,
  onClose,
  onRejected,
}: {
  invoice: SaasInvoice;
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
      await apiClient.patch(`/saas/invoices/${invoice.id}/reject`, { reason: reason || undefined });
      onRejected();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Rejeter la déclaration — ${invoice.invoiceNumber}`}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-sm text-ink-600">
          Les fonds n'ont pas été retrouvés ? Le propriétaire pourra soumettre une nouvelle déclaration.
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
