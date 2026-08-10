'use client';

import { Wallet, Smartphone } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';

interface GeneralClosingView {
  boutique: { isClosed: boolean; cash: number; mobileMoney: number; total: number };
  payments: { isClosed: boolean; cash: number; mobileMoney: number };
  cashToVerify: number;
  grandTotal: number;
}

/**
 * §14.x — Clôture générale du jour : agrège automatiquement les deux
 * mini-clôtures (boutique + paiements) dès qu'elles existent, sans
 * troisième action de clôture séparée — le gestionnaire clôture
 * chaque flux indépendamment, cette vue se construit toute seule.
 * `cashToVerify` mis en avant : c'est le seul chiffre qui a besoin
 * d'être physiquement vérifié dans le tiroir-caisse, le Mobile Money
 * étant déjà tracé numériquement.
 */
export function GeneralClosingSummary({ salleId, currency }: { salleId: string; currency: string }) {
  const { data, isLoading } = useApi<GeneralClosingView>(`/payments/salle/${salleId}/caisse/general-closing`);

  if (isLoading) return <div className="h-40 animate-pulse rounded-xl bg-ink-50" />;
  if (!data) return null;

  const bothClosed = data.boutique.isClosed && data.payments.isClosed;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clôture générale du jour</CardTitle>
      </CardHeader>

      {!bothClosed && (
        <p className="mb-4 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700">
          {!data.boutique.isClosed && !data.payments.isClosed
            ? 'Ni la boutique ni les paiements ne sont encore clôturés — les chiffres ci-dessous ne reflètent que ce qui a été clôturé.'
            : !data.boutique.isClosed
              ? "La boutique n'est pas encore clôturée."
              : "Les paiements ne sont pas encore clôturés."}
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-ink-100 p-3">
          <p className="text-xs text-ink-400">Boutique {data.boutique.isClosed ? '' : '(non clôturée)'}</p>
          <p className="mt-1 text-sm text-ink-900">
            Espèces : <span className="font-medium">{formatCurrency(data.boutique.cash, currency)}</span>
          </p>
          <p className="text-sm text-ink-500">Mobile Money : {formatCurrency(data.boutique.mobileMoney, currency)}</p>
        </div>
        <div className="rounded-lg border border-ink-100 p-3">
          <p className="text-xs text-ink-400">Abonnements {data.payments.isClosed ? '' : '(non clôturés)'}</p>
          <p className="mt-1 text-sm text-ink-900">
            Espèces : <span className="font-medium">{formatCurrency(data.payments.cash, currency)}</span>
          </p>
          <p className="text-sm text-ink-500">Mobile Money : {formatCurrency(data.payments.mobileMoney, currency)}</p>
        </div>
      </div>

      <div className="rounded-lg bg-primary-50 p-4">
        <div className="mb-2 flex items-center gap-2 text-primary-700">
          <Wallet className="h-4 w-4" />
          <p className="text-sm font-semibold">Espèces à vérifier en caisse</p>
        </div>
        <p className="text-2xl font-semibold text-ink-900">{formatCurrency(data.cashToVerify, currency)}</p>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-ink-400">
        <Smartphone className="h-3.5 w-3.5" />
        <span>Total général (tous moyens confondus) : {formatCurrency(data.grandTotal, currency)}</span>
      </div>
    </Card>
  );
}
