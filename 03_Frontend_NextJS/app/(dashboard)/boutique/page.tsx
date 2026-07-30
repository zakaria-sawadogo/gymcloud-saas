'use client';

import { useState } from 'react';
import { Plus, ShoppingBag, Pencil, Camera } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { formatCurrency, formatDateTime } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  price: number;
  stockQty: number;
  active: boolean;
  imageUrl: string | null;
}

interface Sale {
  id: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
  product: { name: string };
}

interface Caisse {
  total: number;
  byMethod: Record<string, number>;
  salesCount: number;
  sales: Sale[];
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  ESPECES: 'Espèces',
  ORANGE_MONEY: 'Orange Money',
  MOOV_MONEY: 'Moov Money',
  WAVE: 'Wave',
  CARTE_BANCAIRE: 'Carte bancaire',
  VIREMENT: 'Virement',
};

export default function BoutiquePage() {
  const { user } = useAuth();
  const salleId = user?.salle?.id;

  if (!salleId) return null;
  return <BoutiqueView salleId={salleId} />;
}

function BoutiqueView({ salleId }: { salleId: string }) {
  const {
    data: products,
    isLoading: isLoadingProducts,
    error: productsError,
    refetch: refetchProducts,
  } = useApi<Product[]>(`/salles/${salleId}/boutique/products`);
  const {
    data: caisse,
    isLoading: isLoadingCaisse,
    refetch: refetchCaisse,
  } = useApi<Caisse>(`/salles/${salleId}/boutique/caisse`);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const refetchAll = () => {
    refetchProducts();
    refetchCaisse();
  };

  if (isLoadingProducts) {
    return <div className="h-64 animate-pulse rounded-xl bg-ink-50" />;
  }

  if (productsError) {
    return (
      <Card>
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title="Add-on Boutique non actif"
          description={productsError}
        />
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Boutique</h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouveau produit
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-ink-500">Ventes aujourd&apos;hui</p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">{caisse?.salesCount ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-500">Total encaissé</p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">{formatCurrency(caisse?.total ?? 0)}</p>
        </Card>
        <Card>
          <p className="mb-1 text-sm text-ink-500">Par moyen de paiement</p>
          {caisse && Object.keys(caisse.byMethod).length > 0 ? (
            <div className="space-y-0.5 text-sm text-ink-700">
              {Object.entries(caisse.byMethod).map(([method, amount]) => (
                <div key={method} className="flex justify-between">
                  <span>{PAYMENT_METHOD_LABELS[method] ?? method}</span>
                  <span className="font-medium">{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-400">—</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vente au comptoir</CardTitle>
          </CardHeader>
          <SalePanel salleId={salleId} products={products ?? []} onSold={refetchAll} />
        </Card>

        <Card className="p-0">
          <div className="p-5 pb-0">
            <CardHeader>
              <CardTitle>Catalogue produits</CardTitle>
            </CardHeader>
          </div>
          {!products || products.length === 0 ? (
            <EmptyState icon={<ShoppingBag className="h-6 w-6" />} title="Aucun produit pour le moment" />
          ) : (
            <div className="divide-y divide-ink-100">
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <ProductImageUpload
                      salleId={salleId}
                      productId={p.id}
                      imageUrl={p.imageUrl}
                      name={p.name}
                      onUploaded={refetchProducts}
                    />
                    <div>
                      <p className="font-medium text-ink-900">
                        {p.name} {!p.active && <span className="text-xs text-ink-400">(désactivé)</span>}
                      </p>
                      <p className="text-sm text-ink-500">
                        {formatCurrency(p.price)} · stock : {p.stockQty}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingProduct(p)}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <SalesByProductPanel salleId={salleId} />

      {caisse && caisse.sales.length > 0 && (
        <Card className="mt-6 p-0">
          <div className="p-5 pb-0">
            <CardHeader>
              <CardTitle>Ventes du jour</CardTitle>
            </CardHeader>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-medium uppercase tracking-wide text-ink-400">
                <th className="px-5 py-2">Heure</th>
                <th className="px-5 py-2">Produit</th>
                <th className="px-5 py-2">Qté</th>
                <th className="px-5 py-2">Montant</th>
                <th className="px-5 py-2">Paiement</th>
              </tr>
            </thead>
            <tbody>
              {caisse.sales.map((sale) => (
                <tr key={sale.id} className="border-b border-ink-50 last:border-0">
                  <td className="px-5 py-2 text-ink-600">{formatDateTime(sale.createdAt)}</td>
                  <td className="px-5 py-2 text-ink-900">{sale.product.name}</td>
                  <td className="px-5 py-2 text-ink-600">{sale.quantity}</td>
                  <td className="px-5 py-2 font-medium text-ink-900">{formatCurrency(sale.totalAmount)}</td>
                  <td className="px-5 py-2 text-ink-600">
                    {PAYMENT_METHOD_LABELS[sale.paymentMethod] ?? sale.paymentMethod}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <CreateProductModal
        salleId={salleId}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => {
          setIsCreateOpen(false);
          refetchProducts();
        }}
      />

      {editingProduct && (
        <EditProductModal
          salleId={salleId}
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onUpdated={() => {
            setEditingProduct(null);
            refetchProducts();
          }}
        />
      )}
    </div>
  );
}

function SalePanel({
  salleId,
  products,
  onSold,
}: {
  salleId: string;
  products: Product[];
  onSold: () => void;
}) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('ESPECES');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableProducts = products.filter((p) => p.active && p.stockQty > 0);
  const selectedProduct = products.find((p) => p.id === productId);
  const total = selectedProduct ? selectedProduct.price * quantity : 0;

  const handleSubmit = async () => {
    if (!productId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/salles/${salleId}/boutique/sales`, { productId, quantity, paymentMethod });
      setProductId('');
      setQuantity(1);
      onSold();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (availableProducts.length === 0) {
    return <EmptyState icon={<ShoppingBag className="h-6 w-6" />} title="Aucun produit en stock à vendre" />;
  }

  return (
    <div className="space-y-4">
      <Field label="Produit">
        <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Sélectionner un produit</option>
          {availableProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatCurrency(p.price)} (stock : {p.stockQty})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Quantité">
        <Input
          type="number"
          min="1"
          max={selectedProduct?.stockQty ?? 1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
        />
      </Field>
      <Field label="Moyen de paiement">
        <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      {productId && (
        <p className="text-sm text-ink-600">
          Total : <span className="font-semibold text-ink-900">{formatCurrency(total)}</span>
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button className="w-full" disabled={!productId} isLoading={isSubmitting} onClick={handleSubmit}>
        Enregistrer la vente
      </Button>
    </div>
  );
}

function CreateProductModal({
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
  const [price, setPrice] = useState('');
  const [stockQty, setStockQty] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setName('');
    setPrice('');
    setStockQty('0');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/salles/${salleId}/boutique/products`, {
        name,
        price: Number(price),
        stockQty: Number(stockQty),
      });
      handleClose();
      onCreated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nouveau produit">
      <Field label="Nom">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Prix (XOF)">
        <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>
      <Field label="Stock initial">
        <Input type="number" min="0" value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
      </Field>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={handleClose} className="flex-1">
          Annuler
        </Button>
        <Button disabled={!name || !price} isLoading={isSubmitting} onClick={handleSubmit} className="flex-1">
          Créer
        </Button>
      </div>
    </Modal>
  );
}

function EditProductModal({
  salleId,
  product,
  onClose,
  onUpdated,
}: {
  salleId: string;
  product: Product;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [stockQty, setStockQty] = useState(String(product.stockQty));
  const [active, setActive] = useState(product.active);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.patch(`/salles/${salleId}/boutique/products/${product.id}`, {
        name,
        price: Number(price),
        stockQty: Number(stockQty),
        active,
      });
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Modifier le produit">
      <Field label="Nom">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Prix (XOF)">
        <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>
      <Field label="Stock">
        <Input type="number" min="0" value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
      </Field>
      <label className="mb-4 flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Produit actif (vendable)
      </label>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Annuler
        </Button>
        <Button isLoading={isSubmitting} onClick={handleSubmit} className="flex-1">
          Enregistrer
        </Button>
      </div>
    </Modal>
  );
}

/**
 * §14.x — Même mécanisme que la photo de coach (upload direct,
 * miniature cliquable) — affichée ensuite sur le site public si
 * Site public + Boutique sont actifs pour la salle.
 */
function ProductImageUpload({
  salleId,
  productId,
  imageUrl,
  name,
  onUploaded,
}: {
  salleId: string;
  productId: string;
  imageUrl: string | null;
  name: string;
  onUploaded: () => void;
}) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      await apiClient.patch(`/salles/${salleId}/boutique/products/${productId}/image`, formData);
      onUploaded();
    } catch {
      // Échec silencieux — l'utilisateur peut réessayer directement.
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <label className="relative cursor-pointer">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={name} className="h-10 w-10 rounded-lg object-cover" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-xs font-semibold text-primary-700">
          {name.charAt(0)}
        </div>
      )}
      <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow">
        <Camera className="h-2.5 w-2.5 text-ink-500" />
      </div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={isUploading}
        className="hidden"
      />
    </label>
  );
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
 * §14.x — Quantités vendues par produit, jour ou mois — utile pour
 * décider quoi réapprovisionner, distinct de la caisse (montants) qui
 * ne dit rien du volume écoulé.
 */
export function SalesByProductPanel({ salleId }: { salleId: string }) {
  const [period, setPeriod] = useState<'day' | 'month'>('day');
  const { data, isLoading } = useApi<SalesByProductSummary>(
    `/salles/${salleId}/boutique/sales-by-product?period=${period}`,
    [period],
  );

  return (
    <Card className="mb-6">
      <div className="mb-4 flex items-center justify-between">
        <CardTitle>Quantités vendues</CardTitle>
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
      {isLoading ? (
        <div className="h-20 animate-pulse rounded-lg bg-ink-50" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="h-6 w-6" />} title="Aucune vente sur cette période" />
      ) : (
        <div className="divide-y divide-ink-100">
          {data.items.map((item) => (
            <div key={item.productId} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-ink-900">{item.name}</span>
              <span className="flex gap-4">
                <span className="font-medium text-ink-900">{item.quantity} vendu(s)</span>
                <span className="text-ink-500">{formatCurrency(item.revenue)}</span>
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-3 text-sm font-semibold text-ink-900">
            <span>Total</span>
            <span className="flex gap-4">
              <span>{data.totalQuantity} vendu(s)</span>
              <span>{formatCurrency(data.totalRevenue)}</span>
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
