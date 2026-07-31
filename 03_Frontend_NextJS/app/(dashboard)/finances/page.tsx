'use client';

import { useState } from 'react';
import { Plus, Wallet, Pencil, Copy, Trash2, Camera } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { formatCurrency, formatDate } from '@/lib/utils';

const SUGGESTED_CATEGORIES = ['Loyer', 'Salaires', 'Électricité/Eau', 'Équipement', 'Maintenance', 'Marketing', 'Autres'];
const MONTH_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  date: string;
  isRecurring: boolean;
  receiptUrl: string | null;
}

interface BoutiqueRevenueSummary {
  revenusBoutique: number;
  ventesCount: number;
}

export default function FinancesPage() {
  const { user } = useAuth();
  const salleId = user?.salle?.id;
  const currency = user?.salle?.currency ?? 'XOF';

  if (!salleId) return null;
  return <FinancesView salleId={salleId} currency={currency} />;
}

function FinancesView({ salleId, currency }: { salleId: string; currency: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const {
    data: expenses,
    isLoading: isLoadingExpenses,
    error: expensesError,
    refetch: refetchExpenses,
  } = useApi<Expense[]>(`/salles/${salleId}/finances/expenses?year=${year}&month=${month}`, [year, month]);
  const { data: revenueSummary, refetch: refetchRevenue } = useApi<BoutiqueRevenueSummary>(
    `/salles/${salleId}/finances/boutique-revenue?year=${year}&month=${month}`,
    [year, month],
  );

  const refetchAll = () => {
    refetchExpenses();
    refetchRevenue();
  };

  const handleDuplicate = async (expenseId: string) => {
    try {
      await apiClient.post(`/salles/${salleId}/finances/expenses/${expenseId}/duplicate`);
      refetchAll();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    }
  };

  const handleDelete = async (expenseId: string) => {
    if (!confirm('Supprimer cette dépense ?')) return;
    try {
      await apiClient.delete(`/salles/${salleId}/finances/expenses/${expenseId}`);
      refetchAll();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    }
  };

  if (isLoadingExpenses) {
    return <div className="h-64 animate-pulse rounded-xl bg-ink-50" />;
  }

  if (expensesError) {
    return (
      <Card>
        <EmptyState icon={<Wallet className="h-6 w-6" />} title="Add-on GymCloud Finances non actif" description={expensesError} />
      </Card>
    );
  }

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink-900">GymCloud Finances</h1>
        <div className="flex items-center gap-2">
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-40">
            {MONTH_LABELS.map((label, i) => (
              <option key={i} value={i + 1}>
                {label}
              </option>
            ))}
          </Select>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouvelle dépense
          </Button>
        </div>
      </div>

      <p className="mb-6 text-sm text-ink-500">
        Outil de suivi pour piloter votre activité — pas un logiciel de comptabilité.
      </p>

      {revenueSummary && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <p className="text-sm text-ink-500">Revenus boutique (ce mois)</p>
            <p className="mt-1 text-xl font-semibold text-ink-900">{formatCurrency(revenueSummary.revenusBoutique, currency)}</p>
          </Card>
          <Card>
            <p className="text-sm text-ink-500">Ventes enregistrées</p>
            <p className="mt-1 text-xl font-semibold text-ink-900">{revenueSummary.ventesCount}</p>
          </Card>
        </div>
      )}

      <Card className="p-0">
        <div className="p-5 pb-0">
          <CardHeader>
            <CardTitle>Dépenses du mois</CardTitle>
          </CardHeader>
        </div>
        {!expenses || expenses.length === 0 ? (
          <EmptyState icon={<Wallet className="h-6 w-6" />} title="Aucune dépense enregistrée ce mois-ci" />
        ) : (
          <div className="divide-y divide-ink-100">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3">
                  <ReceiptUpload salleId={salleId} expenseId={e.id} receiptUrl={e.receiptUrl} onUploaded={refetchExpenses} />
                  <div>
                    <p className="font-medium text-ink-900">
                      {e.category} {e.isRecurring && <span className="text-xs text-ink-400">(récurrente)</span>}
                    </p>
                    <p className="text-sm text-ink-500">
                      {formatDate(e.date)} {e.description && `· ${e.description}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-ink-900">{formatCurrency(e.amount, currency)}</span>
                  <button
                    onClick={() => handleDuplicate(e.id)}
                    title="Dupliquer pour ce mois"
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditingExpense(e)}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ExpenseFormModal
        salleId={salleId}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSaved={() => {
          setIsCreateOpen(false);
          refetchAll();
        }}
      />

      {editingExpense && (
        <ExpenseFormModal
          salleId={salleId}
          expense={editingExpense}
          isOpen
          onClose={() => setEditingExpense(null)}
          onSaved={() => {
            setEditingExpense(null);
            refetchAll();
          }}
        />
      )}
    </div>
  );
}

function ExpenseFormModal({
  salleId,
  expense,
  isOpen,
  onClose,
  onSaved,
}: {
  salleId: string;
  expense?: Expense;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!expense;
  const [category, setCategory] = useState(expense?.category ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [description, setDescription] = useState(expense?.description ?? '');
  const [date, setDate] = useState(expense?.date.split('T')[0] ?? new Date().toISOString().split('T')[0]);
  const [isRecurring, setIsRecurring] = useState(expense?.isRecurring ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = { category, amount: Number(amount), description: description || undefined, date, isRecurring };
      if (isEditing) {
        await apiClient.patch(`/salles/${salleId}/finances/expenses/${expense.id}`, payload);
      } else {
        await apiClient.post(`/salles/${salleId}/finances/expenses`, payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Modifier la dépense' : 'Nouvelle dépense'}>
      <Field label="Catégorie">
        <Input list="categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Loyer, Salaires..." />
        <datalist id="categories">
          {SUGGESTED_CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="Montant">
        <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Date">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Description (optionnel)">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <label className="mb-4 flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
        Dépense récurrente (loyer, salaires...) — pourra être dupliquée chaque mois
      </label>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Annuler
        </Button>
        <Button disabled={!category || !amount} isLoading={isSubmitting} onClick={handleSubmit} className="flex-1">
          {isEditing ? 'Enregistrer' : 'Créer'}
        </Button>
      </div>
    </Modal>
  );
}

function ReceiptUpload({
  salleId,
  expenseId,
  receiptUrl,
  onUploaded,
}: {
  salleId: string;
  expenseId: string;
  receiptUrl: string | null;
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
      await apiClient.patch(`/salles/${salleId}/finances/expenses/${expenseId}/receipt`, formData);
      onUploaded();
    } catch {
      // échec silencieux — l'utilisateur peut réessayer
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <label className="relative cursor-pointer">
      {receiptUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={receiptUrl} alt="Justificatif" className="h-9 w-9 rounded-lg object-cover" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-50 text-ink-400">
          <Camera className="h-4 w-4" />
        </div>
      )}
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
