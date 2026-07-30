import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../proprietaire_repository.dart';

/// §14.x — Suivi boutique en lecture seule pour le propriétaire :
/// stock et ventes, sans aucune action de création/modification/vente
/// — la vente au comptoir reste une tâche du gestionnaire (web).
class BoutiqueSummaryScreen extends StatefulWidget {
  final String salleId;
  final String salleName;
  const BoutiqueSummaryScreen({super.key, required this.salleId, required this.salleName});

  @override
  State<BoutiqueSummaryScreen> createState() => _BoutiqueSummaryScreenState();
}

class _BoutiqueSummaryScreenState extends State<BoutiqueSummaryScreen> {
  late final ProprietaireRepository _repo;
  List<Map<String, dynamic>> _products = [];
  Map<String, dynamic>? _sales;
  String _period = 'day';
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
      final products = await _repo.getBoutiqueProducts(widget.salleId);
      final sales = await _repo.getBoutiqueSalesByProduct(widget.salleId, period: _period);
      setState(() {
        _products = products;
        _sales = sales;
      });
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _changePeriod(String period) async {
    setState(() => _period = period);
    try {
      final sales = await _repo.getBoutiqueSalesByProduct(widget.salleId, period: period);
      if (mounted) setState(() => _sales = sales);
    } catch (_) {
      // pas bloquant — l'utilisateur peut réessayer en rebasculant
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(locale: 'fr_FR', symbol: 'FCFA', decimalDigits: 0);
    final items = (_sales?['items'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    final lowStock = _products.where((p) => p['active'] == true && (p['stockQty'] as num) <= 5).length;

    return Scaffold(
      appBar: AppBar(title: Text('Boutique — ${widget.salleName}')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      _error!.contains('non actif')
                          ? "L'add-on Boutique n'est pas actif pour cette salle."
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
                      const Text('Stock', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                      const SizedBox(height: 8),
                      if (_products.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Text('Aucun produit pour le moment', style: TextStyle(color: AppColors.ink400)),
                        )
                      else
                        ..._products.map((p) {
                          final stockQty = p['stockQty'] as num;
                          final isLow = stockQty <= 5;
                          return Card(
                            margin: const EdgeInsets.only(bottom: 6),
                            child: ListTile(
                              dense: true,
                              title: Text(
                                '${p['name']}${p['active'] == false ? ' (désactivé)' : ''}',
                              ),
                              subtitle: Text(
                                currencyFormat.format(double.parse((p['price'] ?? 0).toString())),
                              ),
                              trailing: Text(
                                '$stockQty en stock',
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: isLow ? AppColors.danger : AppColors.ink900,
                                ),
                              ),
                            ),
                          );
                        }),
                      if (lowStock > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: 4, bottom: 8),
                          child: Text(
                            '⚠ $lowStock produit(s) à réapprovisionner (5 ou moins en stock)',
                            style: const TextStyle(color: AppColors.danger, fontSize: 12),
                          ),
                        ),
                      const SizedBox(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Ventes', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                          Row(
                            children: [
                              _PeriodButton(
                                label: "Aujourd'hui",
                                isSelected: _period == 'day',
                                onTap: () => _changePeriod('day'),
                              ),
                              _PeriodButton(
                                label: 'Ce mois',
                                isSelected: _period == 'month',
                                onTap: () => _changePeriod('month'),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (items.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Text('Aucune vente sur cette période', style: TextStyle(color: AppColors.ink400)),
                        )
                      else ...[
                        ...items.map((item) {
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(child: Text(item['name'] ?? '')),
                                Text(
                                  '${item['quantity']} vendu(s)',
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  currencyFormat.format(double.parse((item['revenue'] ?? 0).toString())),
                                  style: const TextStyle(color: AppColors.ink600),
                                ),
                              ],
                            ),
                          );
                        }),
                        const Divider(),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Total', style: TextStyle(fontWeight: FontWeight.w700)),
                            Text(
                              '${_sales?['totalQuantity'] ?? 0} vendu(s)',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            Text(
                              currencyFormat.format(double.parse((_sales?['totalRevenue'] ?? 0).toString())),
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
    );
  }
}

class _PeriodButton extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;
  const _PeriodButton({required this.label, required this.isSelected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : null,
          border: Border.all(color: isSelected ? AppColors.primary : AppColors.ink100),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: TextStyle(fontSize: 12, color: isSelected ? Colors.white : AppColors.ink600),
        ),
      ),
    );
  }
}
