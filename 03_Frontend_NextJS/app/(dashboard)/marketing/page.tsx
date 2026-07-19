'use client';

import { useState, type FormEvent } from 'react';
import { Plus, Megaphone, Tag } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { formatDate, formatDateTime } from '@/lib/utils';

interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  recipientCount: number;
  sentAt?: string;
  targetSegment: { type: string; inactiveDays?: number };
}

interface Coupon {
  id: string;
  code: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  validFrom: string;
  validTo: string;
  usageLimit?: number;
  usedCount: number;
}

const SEGMENT_LABELS: Record<string, string> = {
  TOUS: 'Tous les adhérents',
  ACTIFS: 'Adhérents actifs',
  EXPIRES: 'Adhérents expirés',
  EN_GRACE: 'Adhérents en grâce',
  INACTIFS: 'Adhérents inactifs',
};

export default function MarketingPage() {
  const { user } = useAuth();
  const salleId = user?.salle?.id;

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-semibold text-ink-900">Marketing</h1>
      {salleId && (
        <Tabs
          tabs={[
            { id: 'campaigns', label: 'Campagnes', content: <CampaignsTab salleId={salleId} /> },
            { id: 'coupons', label: 'Coupons', content: <CouponsTab salleId={salleId} currency={user?.salle?.currency ?? 'XOF'} /> },
          ]}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Onglet Campagnes
// ─────────────────────────────────────────────────────────────

function CampaignsTab({ salleId }: { salleId: string }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: campaigns, refetch } = useApi<Campaign[]>(`/salles/${salleId}/campaigns`);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouvelle campagne
        </Button>
      </div>

      <Card className="p-0">
        {!campaigns || campaigns.length === 0 ? (
          <EmptyState icon={<Megaphone className="h-6 w-6" />} title="Aucune campagne créée" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase text-ink-400">
                <th className="px-5 py-3">Nom</th>
                <th className="px-5 py-3">Canal</th>
                <th className="px-5 py-3">Cible</th>
                <th className="px-5 py-3">Destinataires</th>
                <th className="px-5 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-medium text-ink-900">{c.name}</td>
                  <td className="px-5 py-3 text-ink-600">{c.channel}</td>
                  <td className="px-5 py-3 text-ink-600">
                    {SEGMENT_LABELS[c.targetSegment.type]}
                    {c.targetSegment.inactiveDays && ` (${c.targetSegment.inactiveDays}j)`}
                  </td>
                  <td className="px-5 py-3 text-ink-600">{c.recipientCount || '—'}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <CreateCampaignModal
        salleId={salleId}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => {
          setIsCreateOpen(false);
          refetch();
        }}
      />
    </div>
  );
}

function CreateCampaignModal({
  salleId,
  isOpen,
  onClose,
  onCreated,
}: {
  salleId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('SMS');
  const [content, setContent] = useState('');
  const [segmentType, setSegmentType] = useState('ACTIFS');
  const [inactiveDays, setInactiveDays] = useState('30');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const targetSegment = {
    type: segmentType,
    ...(segmentType === 'INACTIFS' ? { inactiveDays: Number(inactiveDays) } : {}),
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    try {
      const res = await apiClient.post<{ count: number }>(
        `/salles/${salleId}/campaigns/preview-segment`,
        targetSegment,
      );
      setPreviewCount(res.count);
    } catch {
      setPreviewCount(null);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post(`/salles/${salleId}/campaigns`, { name, channel, content, targetSegment });
      setName('');
      setContent('');
      setPreviewCount(null);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouvelle campagne">
      <form onSubmit={handleSubmit}>
        <Field label="Nom de la campagne">
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="Canal">
          <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="SMS">SMS</option>
            <option value="EMAIL">Email</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="PUSH">Notification push</option>
          </Select>
        </Field>

        <Field label="Message">
          <textarea
            required
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-lg border border-ink-100 p-3 text-sm outline-none focus:border-primary-400"
          />
        </Field>

        <Field label="Segment ciblé">
          <Select
            value={segmentType}
            onChange={(e) => {
              setSegmentType(e.target.value);
              setPreviewCount(null);
            }}
          >
            {Object.entries(SEGMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        {segmentType === 'INACTIFS' && (
          <Field label="Nombre de jours sans passage">
            <Input
              type="number"
              min="1"
              value={inactiveDays}
              onChange={(e) => {
                setInactiveDays(e.target.value);
                setPreviewCount(null);
              }}
            />
          </Field>
        )}

        <div className="mb-4 flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
          <span className="text-sm text-ink-600">
            {previewCount !== null ? `${previewCount} destinataire(s) ciblé(s)` : 'Aperçu du nombre de destinataires'}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={handlePreview} isLoading={isPreviewing}>
            Prévisualiser
          </Button>
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Envoyer maintenant
        </Button>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Onglet Coupons
// ─────────────────────────────────────────────────────────────

function CouponsTab({ salleId, currency }: { salleId: string; currency: string }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: coupons, refetch } = useApi<Coupon[]>(`/salles/${salleId}/coupons`);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouveau coupon
        </Button>
      </div>

      <Card className="p-0">
        {!coupons || coupons.length === 0 ? (
          <EmptyState icon={<Tag className="h-6 w-6" />} title="Aucun coupon créé" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase text-ink-400">
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Réduction</th>
                <th className="px-5 py-3">Validité</th>
                <th className="px-5 py-3">Utilisation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-mono font-medium text-ink-900">{c.code}</td>
                  <td className="px-5 py-3 text-ink-600">
                    {c.discountType === 'PERCENT' ? `${c.discountValue}%` : `${c.discountValue} ${currency}`}
                  </td>
                  <td className="px-5 py-3 text-ink-600">
                    {formatDate(c.validFrom)} → {formatDate(c.validTo)}
                  </td>
                  <td className="px-5 py-3 text-ink-600">
                    {c.usedCount}
                    {c.usageLimit ? ` / ${c.usageLimit}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <CreateCouponModal
        salleId={salleId}
        currency={currency}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => {
          setIsCreateOpen(false);
          refetch();
        }}
      />
    </div>
  );
}

function CreateCouponModal({
  salleId,
  currency,
  isOpen,
  onClose,
  onCreated,
}: {
  salleId: string;
  currency: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [discountValue, setDiscountValue] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post(`/salles/${salleId}/coupons`, {
        code: code.toUpperCase(),
        discountType,
        discountValue: Number(discountValue),
        validFrom: new Date(validFrom).toISOString(),
        validTo: new Date(validTo).toISOString(),
        usageLimit: usageLimit ? Number(usageLimit) : undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouveau coupon">
      <form onSubmit={handleSubmit}>
        <Field label="Code">
          <Input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="RENTREE2026"
            className="uppercase"
          />
        </Field>

        <Field label="Type de réduction">
          <Select value={discountType} onChange={(e) => setDiscountType(e.target.value as typeof discountType)}>
            <option value="PERCENT">Pourcentage</option>
            <option value="FIXED">Montant fixe</option>
          </Select>
        </Field>

        <Field label={discountType === 'PERCENT' ? 'Valeur (%)' : `Valeur (${currency})`}>
          <Input
            type="number"
            min="0"
            required
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
          />
        </Field>

        <Field label="Valide du">
          <Input type="date" required value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        </Field>
        <Field label="Valide jusqu'au">
          <Input type="date" required value={validTo} onChange={(e) => setValidTo(e.target.value)} />
        </Field>
        <Field label="Limite d'utilisation (optionnel)">
          <Input type="number" min="1" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} />
        </Field>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Créer le coupon
        </Button>
      </form>
    </Modal>
  );
}
