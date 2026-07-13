'use client';

import { useState, type FormEvent, useEffect } from 'react';
import { Plus, Layers, Ban, Archive, RotateCcw, Pencil } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrency } from '@/lib/utils';
import type { SaasPlan } from '@/types';

const MODULE_OPTIONS = [
  'adherents',
  'abonnements',
  'paiements',
  'rapports_standards',
  'qr_code',
  'reservations',
  'marketing',
  'whatsapp',
  'mobile',
  'rapports_avances',
  'api',
  'bi',
];

export default function PlansSaasPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SaasPlan | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const { data: plans, isLoading, error, refetch } = useApi<SaasPlan[]>('/saas/plans?includeAll=true');

  const handleStatusChange = async (planId: string, action: 'activate' | 'suspend' | 'archive') => {
    setActioningId(planId);
    try {
      await apiClient.patch(`/saas/plans/${planId}/${action}`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Plans SaaS</h1>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouveau plan
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-card bg-ink-100" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !plans || plans.length === 0 ? (
        <Card>
          <EmptyState icon={<Layers className="h-6 w-6" />} title="Aucun plan SaaS créé" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id} className={p.status !== 'ACTIF' ? 'opacity-70' : undefined}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-ink-900">{p.name}</h3>
                <div className="flex items-center gap-2">
                  <StatusBadge status={p.status} />
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                    {p.code}
                  </span>
                </div>
              </div>
              {p.description && <p className="mb-3 text-sm text-ink-600">{p.description}</p>}
              <div className="mb-3 space-y-1 text-sm">
                <p>
                  <span className="text-ink-400">Mensuel : </span>
                  <span className="font-medium text-ink-900">{formatCurrency(p.priceMonthly)}</span>
                </p>
                <p>
                  <span className="text-ink-400">Annuel : </span>
                  <span className="font-medium text-ink-900">{formatCurrency(p.priceAnnual)}</span>
                </p>
                <p>
                  <span className="text-ink-400">Salle supplémentaire : </span>
                  <span className="font-medium text-ink-900">{formatCurrency(p.extraSalleFee)}</span>
                </p>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-ink-50 py-2">
                  <p className="font-semibold text-ink-900">{p.quotaSalles}</p>
                  <p className="text-ink-400">Salles</p>
                </div>
                <div className="rounded-lg bg-ink-50 py-2">
                  <p className="font-semibold text-ink-900">{p.quotaGestionnaires ?? '∞'}</p>
                  <p className="text-ink-400">Gestionnaires</p>
                </div>
                <div className="rounded-lg bg-ink-50 py-2">
                  <p className="font-semibold text-ink-900">{p.quotaAdherents ?? '∞'}</p>
                  <p className="text-ink-400">Adhérents</p>
                </div>
              </div>
              <div className="mb-3 flex flex-wrap gap-1">
                {p.modules.map((m) => (
                  <span key={m} className="rounded-full bg-ink-50 px-2 py-0.5 text-xs text-ink-600">
                    {m}
                  </span>
                ))}
              </div>

              {/* §9.3 — Modifier, activer/suspendre/archiver, sans jamais toucher les souscriptions déjà en cours sur ce plan */}
              <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                <Button size="sm" variant="secondary" onClick={() => setEditingPlan(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Modifier
                </Button>
                {p.status !== 'ACTIF' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    isLoading={actioningId === p.id}
                    onClick={() => handleStatusChange(p.id, 'activate')}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Activer
                  </Button>
                )}
                {p.status === 'ACTIF' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    isLoading={actioningId === p.id}
                    onClick={() => handleStatusChange(p.id, 'suspend')}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Suspendre
                  </Button>
                )}
                {p.status !== 'ARCHIVE' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    isLoading={actioningId === p.id}
                    onClick={() => handleStatusChange(p.id, 'archive')}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Archiver
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <PlanFormModal
        isOpen={isFormOpen || !!editingPlan}
        existing={editingPlan}
        onClose={() => {
          setIsFormOpen(false);
          setEditingPlan(null);
        }}
        onSaved={() => {
          setIsFormOpen(false);
          setEditingPlan(null);
          refetch();
        }}
      />
    </div>
  );
}

/**
 * §9.3 — Formulaire unique création + édition. En édition, `code`
 * n'est jamais modifiable (identifiant stable référencé ailleurs) ;
 * tous les autres champs — y compris quotas, remise annuelle, période
 * d'essai et taxe, absents jusqu'ici du formulaire d'édition — sont
 * désormais éditables (cohérent avec UpdateSaasPlanDto côté backend).
 */
function PlanFormModal({
  isOpen,
  existing,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  existing: SaasPlan | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!existing;

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceMonthly, setPriceMonthly] = useState('');
  const [priceAnnual, setPriceAnnual] = useState('');
  const [extraSalleFee, setExtraSalleFee] = useState('');
  const [annualDiscountPct, setAnnualDiscountPct] = useState('0');
  const [trialDays, setTrialDays] = useState('0');
  const [taxRatePct, setTaxRatePct] = useState('0');
  const [quotaSalles, setQuotaSalles] = useState('1');
  const [quotaGestionnaires, setQuotaGestionnaires] = useState('');
  const [quotaCoachs, setQuotaCoachs] = useState('');
  const [quotaAdherents, setQuotaAdherents] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>(['adherents', 'abonnements', 'paiements']);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (existing) {
      setCode(existing.code);
      setName(existing.name);
      setDescription(existing.description ?? '');
      setPriceMonthly(String(existing.priceMonthly));
      setPriceAnnual(String(existing.priceAnnual));
      setExtraSalleFee(String(existing.extraSalleFee));
      setAnnualDiscountPct(String(existing.annualDiscountPct ?? 0));
      setTrialDays(String(existing.trialDays ?? 0));
      setTaxRatePct(String(existing.taxRatePct ?? 0));
      setQuotaSalles(String(existing.quotaSalles));
      setQuotaGestionnaires(existing.quotaGestionnaires !== null ? String(existing.quotaGestionnaires) : '');
      setQuotaCoachs(existing.quotaCoachs !== null ? String(existing.quotaCoachs) : '');
      setQuotaAdherents(existing.quotaAdherents !== null ? String(existing.quotaAdherents) : '');
      setSelectedModules(existing.modules);
    } else {
      setCode('');
      setName('');
      setDescription('');
      setPriceMonthly('');
      setPriceAnnual('');
      setExtraSalleFee('');
      setAnnualDiscountPct('0');
      setTrialDays('0');
      setTaxRatePct('0');
      setQuotaSalles('1');
      setQuotaGestionnaires('');
      setQuotaCoachs('');
      setQuotaAdherents('');
      setSelectedModules(['adherents', 'abonnements', 'paiements']);
    }
  }, [existing, isOpen]);

  const toggleModule = (m: string) => {
    setSelectedModules((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        name,
        description: description || undefined,
        priceMonthly: Number(priceMonthly),
        priceAnnual: Number(priceAnnual),
        extraSalleFee: Number(extraSalleFee),
        annualDiscountPct: Number(annualDiscountPct) || undefined,
        trialDays: Number(trialDays) || undefined,
        taxRatePct: Number(taxRatePct) || undefined,
        quotaSalles: Number(quotaSalles),
        quotaGestionnaires: quotaGestionnaires ? Number(quotaGestionnaires) : undefined,
        quotaCoachs: quotaCoachs ? Number(quotaCoachs) : undefined,
        quotaAdherents: quotaAdherents ? Number(quotaAdherents) : undefined,
        modules: selectedModules,
      };

      if (isEditing) {
        await apiClient.patch(`/saas/plans/${existing!.id}`, payload);
      } else {
        await apiClient.post('/saas/plans', { ...payload, code: code.toUpperCase() });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? `Modifier ${existing?.name}` : 'Nouveau plan SaaS'}>
      <form onSubmit={handleSubmit}>
        <Field label="Code (ex: STARTER)">
          <Input
            required
            disabled={isEditing}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="uppercase disabled:bg-ink-50 disabled:text-ink-400"
          />
        </Field>
        <Field label="Nom">
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description (optionnel)">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Prix mensuel (XOF)">
          <Input type="number" min="0" required value={priceMonthly} onChange={(e) => setPriceMonthly(e.target.value)} />
        </Field>
        <Field label="Prix annuel (XOF)">
          <Input type="number" min="0" required value={priceAnnual} onChange={(e) => setPriceAnnual(e.target.value)} />
        </Field>
        <Field label="Coût salle supplémentaire (XOF)">
          <Input type="number" min="0" required value={extraSalleFee} onChange={(e) => setExtraSalleFee(e.target.value)} />
        </Field>
        <Field label="Remise annuelle (%) — appliquée en plus du prix annuel affiché">
          <Input type="number" min="0" max="100" value={annualDiscountPct} onChange={(e) => setAnnualDiscountPct(e.target.value)} />
        </Field>
        <Field label="Période d'essai (jours, 0 = aucune)">
          <Input type="number" min="0" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
        </Field>
        <Field label="Taux de taxe (%)">
          <Input type="number" min="0" max="100" value={taxRatePct} onChange={(e) => setTaxRatePct(e.target.value)} />
        </Field>
        <Field label="Quota de salles incluses">
          <Input type="number" min="1" required value={quotaSalles} onChange={(e) => setQuotaSalles(e.target.value)} />
        </Field>
        <Field label="Quota gestionnaires (vide = illimité)">
          <Input type="number" min="1" value={quotaGestionnaires} onChange={(e) => setQuotaGestionnaires(e.target.value)} />
        </Field>
        <Field label="Quota coachs (vide = illimité)">
          <Input type="number" min="1" value={quotaCoachs} onChange={(e) => setQuotaCoachs(e.target.value)} />
        </Field>
        <Field label="Quota adhérents (vide = illimité)">
          <Input type="number" min="1" value={quotaAdherents} onChange={(e) => setQuotaAdherents(e.target.value)} />
        </Field>

        <Field label="Modules inclus">
          <div className="flex flex-wrap gap-2">
            {MODULE_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => toggleModule(m)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedModules.includes(m)
                    ? 'bg-primary-500 text-white'
                    : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </Field>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          {isEditing ? 'Enregistrer les modifications' : 'Créer le plan'}
        </Button>
      </form>
    </Modal>
  );
}
