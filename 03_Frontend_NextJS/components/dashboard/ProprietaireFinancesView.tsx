'use client';

import { useState } from 'react';
import { Plus, Wallet, Pencil, Trash2, Lock, Download } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError, tokenStorage } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { formatCurrency, formatDate } from '@/lib/utils';

const SUGGESTED_CATEGORIES = [
  'Loyer', 'Salaires', 'Électricité/Eau', 'Équipement', 'Maintenance', 'Marketing', 'Autres',
];
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
  isConfidential: boolean;
  receiptUrl: string | null;
}

interface NetResult {
  revenusAbonnements: number;
  revenusBoutique: number;
  totalRevenus: number;
  totalDepenses: number;
  resultatNet: number;
}

/**
 * §14.x — Contrairement à BoutiqueReadOnlyView, le propriétaire a ici
 * un accès complet (créer/modifier/supprimer) — c'est le seul moyen
 * de saisir une dépense confidentielle (salaires, loyer...), jamais
 * visible pour un gestionnaire.
 */
export function ProprietaireFinancesView({ salleId, currency }: { salleId: string; currency: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const {
    data: expenses,
    isLoading,
    error,
    refetch: refetchExpenses,
  } = useApi<Expense[]>(`/salles/${salleId}/finances/expenses?year=${year}&month=${month}`, [year, month]);
  const { data: netResult, refetch: refetchNetResult } = useApi<NetResult>(
    `/salles/${salleId}/finances/net-result?year=${year}&month=${month}`,
    [year, month],
  );

  const refetchAll = () => {
    refetchExpenses();
    refetchNetResult();
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

  const handleExport = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
    const token = tokenStorage.getAccessToken();
    const res = await fetch(`${apiUrl}/salles/${salleId}/finances/expenses/export?year=${year}&month=${month}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      alert("Impossible de télécharger l'export");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `depenses-${year}-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="h-48 animate-pulse rounded-xl bg-ink-50" />;

  if (error) {
    return (
      <Card>
        <EmptyState icon={<Wallet className="h-6 w-6" />} title="Add-on GymCloud Finances non actif" description={error} />
      </Card>
    );
  }

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-500">
          Les dépenses marquées <Lock className="inline h-3 w-3" /> confidentielles ne sont jamais visibles par un
          gestionnaire.
        </p>
        <div className="flex items-center gap-2">
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-36">
            {MONTH_LABELS.map((label, i) => (
              <option key={i} value={i + 1}>
                {label}
              </option>
            ))}
          </Select>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="ghost" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouvelle dépense
          </Button>
        </div>
      </div>

      {netResult && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card>
            <p className="text-xs text-ink-500">Revenus totaux</p>
            <p className="mt-1 text-lg font-semibold text-ink-900">{formatCurrency(netResult.totalRevenus, currency)}</p>
          </Card>
          <Card>
            <p className="text-xs text-ink-500">Dépenses totales</p>
            <p className="mt-1 text-lg font-semibold text-red-600">{formatCurrency(netResult.totalDepenses, currency)}</p>
          </Card>
          <Card className="md:col-span-2">
            <p className="text-xs text-ink-500">Résultat net</p>
            <p className={`mt-1 text-lg font-semibold ${netResult.resultatNet >= 0 ? 'text-primary-600' : 'text-red-600'}`}>
              {formatCurrency(netResult.resultatNet, currency)}
            </p>
          </Card>
        </div>
      )}

      <Card className="p-0">
        {!expenses || expenses.length === 0 ? (
          <EmptyState icon={<Wallet className="h-6 w-6" />} title="Aucune dépense enregistrée ce mois-ci" />
        ) : (
          <div className="divide-y divide-ink-100">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    {e.category}
                    {e.isConfidential && <Lock className="ml-1.5 inline h-3 w-3 text-ink-400" />}
                    {e.isRecurring && <span className="ml-1.5 text-xs text-ink-400">(récurrente)</span>}
                  </p>
                  <p className="text-xs text-ink-500">
                    {formatDate(e.date)} {e.description && `· ${e.description}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink-900">{formatCurrency(e.amount, currency)}</span>
                  <button
                    onClick={() => setEditingExpense(e)}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
  const [isConfidential, setIsConfidential] = useState(expense?.isConfidential ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        category,
        amount: Number(amount),
        description: description || undefined,
        date,
        isRecurring,
        isConfidential,
      };
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
        <Input list="categories-proprietaire" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Loyer, Salaires..." />
        <datalist id="categories-proprietaire">
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
      <label className="mb-3 flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
        Dépense récurrente (loyer, salaires...)
      </label>
      <label className="mb-4 flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" checked={isConfidential} onChange={(e) => setIsConfidential(e.target.checked)} />
        <Lock className="h-3.5 w-3.5" /> Confidentielle — jamais visible par un gestionnaire
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
