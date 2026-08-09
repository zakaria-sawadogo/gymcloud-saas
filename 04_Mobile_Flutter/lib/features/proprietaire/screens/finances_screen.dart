import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/currency_format.dart';
import '../proprietaire_repository.dart';

const List<String> _suggestedCategories = [
  'Loyer', 'Salaires', 'Électricité/Eau', 'Équipement', 'Maintenance', 'Marketing', 'Autres',
];
const List<String> _monthLabels = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/// §14.x — GymCloud Finances côté propriétaire : accès complet
/// (créer/modifier/supprimer), y compris les dépenses confidentielles
/// (salaires, loyer...) — jamais visibles pour un gestionnaire.
class ProprietaireFinancesScreen extends StatefulWidget {
  final String salleId;
  final String salleName;
  final String? currency;
  const ProprietaireFinancesScreen({super.key, required this.salleId, required this.salleName, this.currency});

  @override
  State<ProprietaireFinancesScreen> createState() => _ProprietaireFinancesScreenState();
}

class _ProprietaireFinancesScreenState extends State<ProprietaireFinancesScreen> {
  late final ProprietaireRepository _repo;
  int _year = DateTime.now().year;
  int _month = DateTime.now().month;
  List<Map<String, dynamic>> _expenses = [];
  Map<String, dynamic>? _netResult;
  List<Map<String, dynamic>> _budgets = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _repo = ProprietaireRepository(context.read());
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final expenses = await _repo.getFinancesExpenses(widget.salleId, year: _year, month: _month);
      final netResult = await _repo.getFinancesNetResult(widget.salleId, year: _year, month: _month);
      final budgets = await _repo.getFinancesBudgets(widget.salleId);
      setState(() {
        _expenses = expenses;
        _netResult = netResult;
        _budgets = budgets;
      });
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _deleteExpense(String expenseId) async {
    try {
      await _repo.deleteFinancesExpense(widget.salleId, expenseId);
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = currencyFormatFor(widget.currency);
    return Scaffold(
      appBar: AppBar(title: Text('Finances — ${widget.salleName}')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      _error!.contains('non actif')
                          ? "L'add-on GymCloud Finances n'est pas actif pour cette salle."
                          : _error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.danger),
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _MonthPicker(
                        year: _year,
                        month: _month,
                        onChanged: (y, m) {
                          setState(() {
                            _year = y;
                            _month = m;
                          });
                          _load();
                        },
                      ),
                      const SizedBox(height: 16),
                      if (_netResult != null) ...[
                        Row(
                          children: [
                            Expanded(
                              child: _StatCard(
                                label: 'Revenus',
                                value: currencyFormat.format(double.parse((_netResult!['totalRevenus'] ?? 0).toString())),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _StatCard(
                                label: 'Dépenses',
                                value: currencyFormat.format(double.parse((_netResult!['totalDepenses'] ?? 0).toString())),
                                color: AppColors.danger,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Résultat net', style: TextStyle(color: AppColors.ink400, fontSize: 13)),
                                    if (_netResult!['variationPct'] != null)
                                      Text(
                                        '${(_netResult!['variationPct'] as num) >= 0 ? '+' : ''}${_netResult!['variationPct']}% vs mois précédent',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                          color: (_netResult!['variationPct'] as num) >= 0 ? AppColors.primary : AppColors.danger,
                                        ),
                                      ),
                                  ],
                                ),
                                Text(
                                  currencyFormat.format(double.parse((_netResult!['resultatNet'] ?? 0).toString())),
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                    color: (double.tryParse((_netResult!['resultatNet'] ?? 0).toString()) ?? 0) >= 0
                                        ? AppColors.primary
                                        : AppColors.danger,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        if ((_netResult!['budgetAlerts'] as List?)?.isNotEmpty ?? false) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(color: AppColors.danger.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(8)),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('⚠ Budget dépassé', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600, fontSize: 13)),
                                ...(_netResult!['budgetAlerts'] as List).map((a) {
                                  final alert = a as Map<String, dynamic>;
                                  return Text(
                                    '${alert['category']} : ${currencyFormat.format(double.parse((alert['spent'] ?? 0).toString()))} (plafond ${currencyFormat.format(double.parse((alert['limit'] ?? 0).toString()))})',
                                    style: const TextStyle(color: AppColors.danger, fontSize: 12),
                                  );
                                }),
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 16),
                      ],
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Budgets par catégorie', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                          TextButton.icon(
                            onPressed: () => _openBudgetManager(context),
                            icon: const Icon(Icons.tune, size: 16),
                            label: const Text('Gérer'),
                          ),
                        ],
                      ),
                      if (_budgets.isEmpty)
                        const Text('Aucun budget défini.', style: TextStyle(color: AppColors.ink400, fontSize: 13))
                      else
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: _budgets.map((b) {
                            return Chip(
                              label: Text(
                                '${b['category']} : ${currencyFormat.format(double.parse((b['monthlyLimit'] ?? 0).toString()))}/mois',
                                style: const TextStyle(fontSize: 11),
                              ),
                            );
                          }).toList(),
                        ),
                      const SizedBox(height: 20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Dépenses', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                          TextButton.icon(
                            onPressed: () => _openForm(context),
                            icon: const Icon(Icons.add, size: 18),
                            label: const Text('Nouvelle'),
                          ),
                        ],
                      ),
                      if (_expenses.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Text('Aucune dépense enregistrée ce mois-ci', style: TextStyle(color: AppColors.ink400)),
                        )
                      else
                        ..._expenses.map((e) {
                          final isRecurring = e['isRecurring'] == true;
                          final varies = e['recurringAmountVaries'] == true;
                          final isConfidential = e['isConfidential'] == true;
                          return Card(
                            margin: const EdgeInsets.only(bottom: 6),
                            child: ListTile(
                              dense: true,
                              title: Row(
                                children: [
                                  if (isConfidential) const Padding(padding: EdgeInsets.only(right: 4), child: Icon(Icons.lock, size: 13, color: AppColors.ink400)),
                                  Expanded(
                                    child: Text(
                                      '${e['category']}${isRecurring ? ' (récurrente, ${varies ? 'variable' : 'auto'})' : ''}',
                                    ),
                                  ),
                                ],
                              ),
                              subtitle: Text(
                                '${e['date'].toString().split('T')[0]}${e['description'] != null ? ' · ${e['description']}' : ''}',
                              ),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    currencyFormat.format(double.parse((e['amount'] ?? 0).toString())),
                                    style: const TextStyle(fontWeight: FontWeight.w600),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.edit_outlined, size: 18),
                                    onPressed: () => _openForm(context, expense: e),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline, size: 18),
                                    onPressed: () => _deleteExpense(e['id'] as String),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }),
                    ],
                  ),
                ),
    );
  }

  Future<void> _openForm(BuildContext context, {Map<String, dynamic>? expense}) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ExpenseFormSheet(repo: _repo, salleId: widget.salleId, expense: expense),
    );
    if (saved == true) _load();
  }

  Future<void> _openBudgetManager(BuildContext context) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _BudgetManagerSheet(
        repo: _repo,
        salleId: widget.salleId,
        budgets: _budgets,
        currency: widget.currency,
      ),
    );
    if (changed == true) _load();
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color? color;
  const _StatCard({required this.label, required this.value, this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: AppColors.ink400, fontSize: 12)),
            Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: color)),
          ],
        ),
      ),
    );
  }
}

class _MonthPicker extends StatelessWidget {
  final int year;
  final int month;
  final void Function(int year, int month) onChanged;
  const _MonthPicker({required this.year, required this.month, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        IconButton(
          icon: const Icon(Icons.chevron_left),
          onPressed: () {
            final newMonth = month == 1 ? 12 : month - 1;
            final newYear = month == 1 ? year - 1 : year;
            onChanged(newYear, newMonth);
          },
        ),
        Text('${_monthLabels[month - 1]} $year', style: const TextStyle(fontWeight: FontWeight.w600)),
        IconButton(
          icon: const Icon(Icons.chevron_right),
          onPressed: () {
            final newMonth = month == 12 ? 1 : month + 1;
            final newYear = month == 12 ? year + 1 : year;
            onChanged(newYear, newMonth);
          },
        ),
      ],
    );
  }
}

class _ExpenseFormSheet extends StatefulWidget {
  final ProprietaireRepository repo;
  final String salleId;
  final Map<String, dynamic>? expense;
  const _ExpenseFormSheet({required this.repo, required this.salleId, this.expense});

  @override
  State<_ExpenseFormSheet> createState() => _ExpenseFormSheetState();
}

class _ExpenseFormSheetState extends State<_ExpenseFormSheet> {
  late final TextEditingController _categoryController;
  late final TextEditingController _amountController;
  late final TextEditingController _descriptionController;
  late DateTime _date;
  late bool _isRecurring;
  late bool _recurringAmountVaries;
  late bool _isConfidential;
  bool _isSubmitting = false;
  String? _error;

  bool get _isEditing => widget.expense != null;

  @override
  void initState() {
    super.initState();
    _categoryController = TextEditingController(text: widget.expense?['category'] ?? '');
    _amountController = TextEditingController(text: widget.expense != null ? '${widget.expense!['amount']}' : '');
    _descriptionController = TextEditingController(text: widget.expense?['description'] ?? '');
    _date = widget.expense != null ? DateTime.parse(widget.expense!['date'] as String) : DateTime.now();
    _isRecurring = widget.expense?['isRecurring'] ?? false;
    _recurringAmountVaries = widget.expense?['recurringAmountVaries'] ?? true;
    _isConfidential = widget.expense?['isConfidential'] ?? false;
  }

  @override
  void dispose() {
    _categoryController.dispose();
    _amountController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      final dateStr = _date.toIso8601String().split('T')[0];
      if (_isEditing) {
        await widget.repo.updateFinancesExpense(
          salleId: widget.salleId,
          expenseId: widget.expense!['id'] as String,
          category: _categoryController.text.trim(),
          amount: num.tryParse(_amountController.text) ?? 0,
          description: _descriptionController.text.trim().isEmpty ? null : _descriptionController.text.trim(),
          date: dateStr,
          isRecurring: _isRecurring,
          recurringAmountVaries: _recurringAmountVaries,
          isConfidential: _isConfidential,
        );
      } else {
        await widget.repo.createFinancesExpense(
          salleId: widget.salleId,
          category: _categoryController.text.trim(),
          amount: num.tryParse(_amountController.text) ?? 0,
          description: _descriptionController.text.trim().isEmpty ? null : _descriptionController.text.trim(),
          date: dateStr,
          isRecurring: _isRecurring,
          recurringAmountVaries: _recurringAmountVaries,
          isConfidential: _isConfidential,
        );
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              _isEditing ? 'Modifier la dépense' : 'Nouvelle dépense',
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _categoryController,
              decoration: const InputDecoration(labelText: 'Catégorie'),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              children: _suggestedCategories
                  .map(
                    (c) => ActionChip(
                      label: Text(c, style: const TextStyle(fontSize: 11)),
                      onPressed: () => setState(() => _categoryController.text = c),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _amountController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Montant'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descriptionController,
              decoration: const InputDecoration(labelText: 'Description (optionnel)'),
            ),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Date'),
              subtitle: Text(_date.toIso8601String().split('T')[0]),
              trailing: const Icon(Icons.calendar_today, size: 18),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _date,
                  firstDate: DateTime(2020),
                  lastDate: DateTime(2100),
                );
                if (picked != null) setState(() => _date = picked);
              },
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Dépense récurrente'),
              value: _isRecurring,
              onChanged: (v) => setState(() => _isRecurring = v),
            ),
            if (_isRecurring)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(color: AppColors.ink50, borderRadius: BorderRadius.circular(8)),
                child: Column(
                  children: [
                    RadioListTile<bool>(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      value: false,
                      groupValue: _recurringAmountVaries,
                      onChanged: (v) => setState(() => _recurringAmountVaries = v!),
                      title: const Text('Montant fixe — régénérée automatiquement chaque mois', style: TextStyle(fontSize: 13)),
                    ),
                    RadioListTile<bool>(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      value: true,
                      groupValue: _recurringAmountVaries,
                      onChanged: (v) => setState(() => _recurringAmountVaries = v!),
                      title: const Text('Montant variable — juste un rappel', style: TextStyle(fontSize: 13)),
                    ),
                  ],
                ),
              ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              secondary: const Icon(Icons.lock_outline, size: 20),
              title: const Text('Confidentielle'),
              subtitle: const Text('Jamais visible par un gestionnaire', style: TextStyle(fontSize: 12)),
              value: _isConfidential,
              onChanged: (v) => setState(() => _isConfidential = v),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: AppColors.danger)),
            ],
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              child: _isSubmitting
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(_isEditing ? 'Enregistrer' : 'Créer'),
            ),
          ],
        ),
      ),
    );
  }
}

class _BudgetManagerSheet extends StatefulWidget {
  final ProprietaireRepository repo;
  final String salleId;
  final List<Map<String, dynamic>> budgets;
  final String? currency;
  const _BudgetManagerSheet({required this.repo, required this.salleId, required this.budgets, this.currency});

  @override
  State<_BudgetManagerSheet> createState() => _BudgetManagerSheetState();
}

class _BudgetManagerSheetState extends State<_BudgetManagerSheet> {
  final _categoryController = TextEditingController();
  final _limitController = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _categoryController.dispose();
    _limitController.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      await widget.repo.setFinancesBudget(
        widget.salleId,
        _categoryController.text.trim(),
        num.tryParse(_limitController.text) ?? 0,
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _remove(String category) async {
    try {
      await widget.repo.deleteFinancesBudget(widget.salleId, category);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = currencyFormatFor(widget.currency);
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Budgets par catégorie', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
            const SizedBox(height: 4),
            const Text(
              'Plafond indicatif mensuel — une simple alerte si dépassé, jamais un blocage.',
              style: TextStyle(fontSize: 12, color: AppColors.ink400),
            ),
            const SizedBox(height: 12),
            ...widget.budgets.map((b) {
              return Card(
                margin: const EdgeInsets.only(bottom: 6),
                child: ListTile(
                  dense: true,
                  title: Text('${b['category']}'),
                  subtitle: Text(currencyFormat.format(double.parse((b['monthlyLimit'] ?? 0).toString()))),
                  trailing: IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    onPressed: () => _remove(b['category'] as String),
                  ),
                ),
              );
            }),
            const SizedBox(height: 12),
            TextField(
              controller: _categoryController,
              decoration: const InputDecoration(labelText: 'Catégorie'),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              children: _suggestedCategories
                  .map(
                    (c) => ActionChip(
                      label: Text(c, style: const TextStyle(fontSize: 11)),
                      onPressed: () => setState(() => _categoryController.text = c),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _limitController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Plafond mensuel'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: AppColors.danger)),
            ],
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _isSubmitting ? null : _add,
              child: _isSubmitting
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Ajouter'),
            ),
          ],
        ),
      ),
    );
  }
}
