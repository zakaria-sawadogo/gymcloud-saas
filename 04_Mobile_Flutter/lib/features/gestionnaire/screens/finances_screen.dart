import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/currency_format.dart';
import '../gestionnaire_repository.dart';
import '../../shared/logout_button.dart';
import '../../shared/notification_bell.dart';

const List<String> _suggestedCategories = [
  'Loyer', 'Salaires', 'Électricité/Eau', 'Équipement', 'Maintenance', 'Marketing', 'Autres',
];
const List<String> _monthLabels = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/// §14.x — GymCloud Finances côté gestionnaire : uniquement les
/// revenus boutique (qu'il enregistre lui-même) et ses propres
/// dépenses non confidentielles. Jamais les revenus d'abonnement, le
/// résultat net, ni un export — réservés au propriétaire.
class FinancesScreen extends StatefulWidget {
  const FinancesScreen({super.key});

  @override
  State<FinancesScreen> createState() => _FinancesScreenState();
}

class _FinancesScreenState extends State<FinancesScreen> {
  late final GestionnaireRepository _repo;
  int _year = DateTime.now().year;
  int _month = DateTime.now().month;
  List<Map<String, dynamic>> _expenses = [];
  Map<String, dynamic>? _revenue;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _repo = GestionnaireRepository(context.read());
    _load();
  }

  String? get _salleId => context.read<AuthProvider>().user?.salle?.id;

  Future<void> _load() async {
    final salleId = _salleId;
    if (salleId == null) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final expenses = await _repo.getFinancesExpenses(salleId, year: _year, month: _month);
      final revenue = await _repo.getBoutiqueRevenueSummary(salleId, year: _year, month: _month);
      setState(() {
        _expenses = expenses;
        _revenue = revenue;
      });
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _deleteExpense(String expenseId) async {
    final salleId = _salleId;
    if (salleId == null) return;
    try {
      await _repo.deleteFinancesExpense(salleId, expenseId);
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    // §14.x — corrige "FCFA" codé en dur : devise réelle de la salle.
    final currencyFormat = currencyFormatFor(context.watch<AuthProvider>().user?.salle?.currency);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Finances'),
        actions: const [NotificationBell(), LogoutButton()],
      ),
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
                      if (_revenue != null) ...[
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Revenus boutique', style: TextStyle(color: AppColors.ink400, fontSize: 13)),
                                    if (_revenue!['variationPct'] != null)
                                      Text(
                                        '${(_revenue!['variationPct'] as num) >= 0 ? '+' : ''}${_revenue!['variationPct']}% vs mois précédent',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                          color: (_revenue!['variationPct'] as num) >= 0 ? AppColors.primary : AppColors.danger,
                                        ),
                                      ),
                                  ],
                                ),
                                Text(
                                  currencyFormat.format(double.parse((_revenue!['revenusBoutique'] ?? 0).toString())),
                                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                                ),
                                const SizedBox(height: 4),
                                Text('${_revenue!['ventesCount'] ?? 0} vente(s)', style: const TextStyle(color: AppColors.ink400, fontSize: 12)),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],
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
                          return Card(
                            margin: const EdgeInsets.only(bottom: 6),
                            child: ListTile(
                              dense: true,
                              title: Text(
                                '${e['category']}${isRecurring ? ' (récurrente, ${varies ? 'variable' : 'auto'})' : ''}',
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
      builder: (_) => _ExpenseFormSheet(repo: _repo, salleId: _salleId!, expense: expense),
    );
    if (saved == true) _load();
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
  final GestionnaireRepository repo;
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
