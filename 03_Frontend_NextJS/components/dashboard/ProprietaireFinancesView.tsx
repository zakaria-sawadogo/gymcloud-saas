'use client';

import { useState } from 'react';
import { Plus, Wallet, Pencil, Trash2, Lock, Download, TrendingUp, TrendingDown, Target, X } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
  recurringAmountVaries: boolean;
  isConfidential: boolean;
  receiptUrl: string | null;
}

interface BudgetAlert {
  category: string;
  spent: number;
  limit: number;
  isOverBudget: boolean;
}

interface NetResult {
  totalRevenus: number;
  totalDepenses: number;
  resultatNet: number;
  resultatNetPrecedent: number;
  variationPct: number | null;
  budgetAlerts: BudgetAlert[];
  depensesParCategorie: Record<string, number>;
}

interface Budget {
  id: string;
  category: string;
  monthlyLimit: number;
}

interface TrendPoint {
  year: number;
  month: number;
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
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);

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
  const { data: trend } = useApi<TrendPoint[]>(`/salles/${salleId}/finances/trend?months=6`, [year, month]);
  const { data: budgets, refetch: refetchBudgets } = useApi<Budget[]>(`/salles/${salleId}/finances/budgets`);

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

  const downloadFile = async (path: string, filename: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
    const token = tokenStorage.getAccessToken();
    const res = await fetch(`${apiUrl}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) {
      alert("Impossible de télécharger l'export");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
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
  const chartData = (trend ?? []).map((t) => ({
    label: `${MONTH_LABELS[t.month - 1].slice(0, 3)} ${String(t.year).slice(2)}`,
    Revenus: t.totalRevenus,
    Dépenses: t.totalDepenses,
    'Résultat net': t.resultatNet,
  }));
  const categoryData = Object.entries(netResult?.depensesParCategorie ?? {})
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

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
          <Button
            size="sm"
            variant="ghost"
            onClick={() => downloadFile(`/salles/${salleId}/finances/expenses/export?year=${year}&month=${month}`, `depenses-${year}-${month}.csv`)}
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => downloadFile(`/salles/${salleId}/finances/expenses/export-excel?year=${year}&month=${month}`, `etat-${year}-${month}.xlsx`)}
          >
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouvelle dépense
          </Button>
        </div>
      </div>

      {netResult && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card>
            <p className="text-xs text-ink-500">Revenus totaux</p>
            <p className="mt-1 text-lg font-semibold text-ink-900">{formatCurrency(netResult.totalRevenus, currency)}</p>
          </Card>
          <Card>
            <p className="text-xs text-ink-500">Dépenses totales</p>
            <p className="mt-1 text-lg font-semibold text-red-600">{formatCurrency(netResult.totalDepenses, currency)}</p>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-500">Résultat net</p>
              {netResult.variationPct !== null && (
                <span
                  className={`flex items-center gap-0.5 text-xs font-medium ${netResult.variationPct >= 0 ? 'text-primary-600' : 'text-red-600'}`}
                >
                  {netResult.variationPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {netResult.variationPct >= 0 ? '+' : ''}
                  {netResult.variationPct}% vs mois précédent
                </span>
              )}
            </div>
            <p className={`mt-1 text-lg font-semibold ${netResult.resultatNet >= 0 ? 'text-primary-600' : 'text-red-600'}`}>
              {formatCurrency(netResult.resultatNet, currency)}
            </p>
          </Card>
        </div>
      )}

      {netResult && netResult.budgetAlerts.length > 0 && (
        <Card className="mb-4 border-red-200 bg-red-50">
          <p className="mb-1 text-sm font-medium text-red-700">⚠ Budget dépassé</p>
          {netResult.budgetAlerts.map((a) => (
            <p key={a.category} className="text-sm text-red-600">
              {a.category} : {formatCurrency(a.spent, currency)} (plafond {formatCurrency(a.limit, currency)})
            </p>
          ))}
        </Card>
      )}

      {chartData.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Évolution (6 derniers mois)</CardTitle>
          </CardHeader>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7E8" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                <Line type="monotone" dataKey="Revenus" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Dépenses" stroke="#dc2626" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Résultat net" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {categoryData.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Dépenses par catégorie (ce mois)</CardTitle>
          </CardHeader>
          <div style={{ height: Math.max(160, categoryData.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7E8" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} width={100} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                <Bar dataKey="amount" fill="#dc2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <CardTitle>Budgets par catégorie</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => setIsBudgetOpen(true)}>
            <Target className="h-4 w-4" />
            Gérer
          </Button>
        </div>
        {!budgets || budgets.length === 0 ? (
          <p className="text-sm text-ink-400">Aucun budget défini.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {budgets.map((b) => (
              <span key={b.id} className="rounded-full bg-ink-50 px-3 py-1 text-xs text-ink-700">
                {b.category} : {formatCurrency(b.monthlyLimit, currency)}/mois
              </span>
            ))}
          </div>
        )}
      </Card>

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
                    {e.isRecurring && (
                      <span className="ml-1.5 text-xs text-ink-400">
                        ({e.recurringAmountVaries ? 'récurrente, variable' : 'récurrente, auto'})
                      </span>
                    )}
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

      {isBudgetOpen && (
        <BudgetModal
          salleId={salleId}
          currency={currency}
          budgets={budgets ?? []}
          onClose={() => setIsBudgetOpen(false)}
          onChanged={refetchBudgets}
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
  const [recurringAmountVaries, setRecurringAmountVaries] = useState(expense?.recurringAmountVaries ?? true);
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
        recurringAmountVaries,
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
      <label className="mb-2 flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
        Dépense récurrente (revient chaque mois)
      </label>
      {isRecurring && (
        <div className="mb-4 ml-6 space-y-2 rounded-lg bg-ink-50 p-3">
          <label className="flex items-start gap-2 text-sm text-ink-700">
            <input
              type="radio"
              checked={!recurringAmountVaries}
              onChange={() => setRecurringAmountVaries(false)}
              className="mt-0.5"
            />
            <span>
              <strong>Montant fixe</strong> (loyer...) — régénérée automatiquement chaque mois, sans ressaisie
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink-700">
            <input
              type="radio"
              checked={recurringAmountVaries}
              onChange={() => setRecurringAmountVaries(true)}
              className="mt-0.5"
            />
            <span>
              <strong>Montant variable</strong> (électricité...) — juste un rappel, à ressaisir chaque mois
            </span>
          </label>
        </div>
      )}
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

function BudgetModal({
  salleId,
  currency,
  budgets,
  onClose,
  onChanged,
}: {
  salleId: string;
  currency: string;
  budgets: Budget[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [category, setCategory] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/salles/${salleId}/finances/budgets`, { category, monthlyLimit: Number(monthlyLimit) });
      setCategory('');
      setMonthlyLimit('');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (cat: string) => {
    try {
      await apiClient.delete(`/salles/${salleId}/finances/budgets?category=${encodeURIComponent(cat)}`);
      onChanged();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Budgets par catégorie">
      <p className="mb-4 text-sm text-ink-500">
        Plafond indicatif mensuel — une simple alerte si dépassé, jamais un blocage.
      </p>
      {budgets.length > 0 && (
        <div className="mb-4 space-y-2">
          {budgets.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
              <span className="text-sm text-ink-700">
                {b.category} — {formatCurrency(b.monthlyLimit, currency)}/mois
              </span>
              <button onClick={() => handleRemove(b.category)} className="text-ink-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <Field label="Catégorie">
        <Input list="categories-budget" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Marketing..." />
        <datalist id="categories-budget">
          {SUGGESTED_CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="Plafond mensuel">
        <Input type="number" min="0" value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} />
      </Field>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Fermer
        </Button>
        <Button disabled={!category || !monthlyLimit} isLoading={isSubmitting} onClick={handleAdd} className="flex-1">
          Ajouter
        </Button>
      </div>
    </Modal>
  );
}
