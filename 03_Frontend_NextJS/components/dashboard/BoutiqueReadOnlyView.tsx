'use client';

import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  price: number;
  stockQty: number;
  active: boolean;
  imageUrl: string | null;
}

interface SalesByProductItem {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

interface SalesByProductSummary {
  items: SalesByProductItem[];
  totalQuantity: number;
  totalRevenue: number;
}

/**
 * §14.x — Suivi boutique en lecture seule : stock et ventes, sans
 * aucune action de création/modification/vente — le propriétaire
 * supervise (permission CASL "read" uniquement), la vente au comptoir
 * reste une tâche du gestionnaire (page /boutique dédiée).
 */
export function BoutiqueReadOnlyView({ salleId, currency = 'XOF' }: { salleId: string; currency?: string }) {
  const [period, setPeriod] = useState<'day' | 'month'>('day');
  const { data: products, isLoading: isLoadingProducts, error } = useApi<Product[]>(
    `/salles/${salleId}/boutique/products`,
  );
  const { data: sales, isLoading: isLoadingSales } = useApi<SalesByProductSummary>(
    `/salles/${salleId}/boutique/sales-by-product?period=${period}`,
    [period],
  );

  if (isLoadingProducts) return <div className="h-40 animate-pulse rounded-xl bg-ink-50" />;

  if (error) {
    return (
      <Card>
        <EmptyState icon={<ShoppingBag className="h-6 w-6" />} title="Add-on Boutique non actif" description={error} />
      </Card>
    );
  }

  const lowStock = (products ?? []).filter((p) => p.active && p.stockQty <= 5);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="p-0">
        <div className="p-5 pb-0">
          <CardHeader>
            <CardTitle>Stock</CardTitle>
          </CardHeader>
        </div>
        {!products || products.length === 0 ? (
          <EmptyState icon={<ShoppingBag className="h-6 w-6" />} title="Aucun produit pour le moment" />
        ) : (
          <div className="divide-y divide-ink-100">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-medium text-ink-900">
                    {p.name} {!p.active && <span className="text-xs text-ink-400">(désactivé)</span>}
                  </p>
                  <p className="text-sm text-ink-500">{formatCurrency(p.price, currency)}</p>
                </div>
                <span
                  className={`text-sm font-semibold ${p.stockQty <= 5 ? 'text-red-600' : 'text-ink-900'}`}
                >
                  {p.stockQty} en stock
                </span>
              </div>
            ))}
          </div>
        )}
        {lowStock.length > 0 && (
          <p className="border-t border-ink-100 px-5 py-3 text-xs text-red-600">
            ⚠ {lowStock.length} produit(s) à réapprovisionner (5 ou moins en stock)
          </p>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>Ventes</CardTitle>
          <div className="flex overflow-hidden rounded-lg border border-ink-200">
            <button
              onClick={() => setPeriod('day')}
              className={`px-3 py-1.5 text-sm ${period === 'day' ? 'bg-primary-600 text-white' : 'text-ink-600'}`}
            >
              Aujourd&apos;hui
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 text-sm ${period === 'month' ? 'bg-primary-600 text-white' : 'text-ink-600'}`}
            >
              Ce mois
            </button>
          </div>
        </div>
        {isLoadingSales ? (
          <div className="h-20 animate-pulse rounded-lg bg-ink-50" />
        ) : !sales || sales.items.length === 0 ? (
          <EmptyState icon={<ShoppingBag className="h-6 w-6" />} title="Aucune vente sur cette période" />
        ) : (
          <div className="divide-y divide-ink-100">
            {sales.items.map((item) => (
              <div key={item.productId} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink-900">{item.name}</span>
                <span className="flex gap-4">
                  <span className="font-medium text-ink-900">{item.quantity} vendu(s)</span>
                  <span className="text-ink-500">{formatCurrency(item.revenue, currency)}</span>
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 text-sm font-semibold text-ink-900">
              <span>Total</span>
              <span className="flex gap-4">
                <span>{sales.totalQuantity} vendu(s)</span>
                <span>{formatCurrency(sales.totalRevenue, currency)}</span>
              </span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
