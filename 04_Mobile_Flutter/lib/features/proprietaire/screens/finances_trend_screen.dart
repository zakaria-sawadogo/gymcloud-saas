import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/currency_format.dart';
import '../proprietaire_repository.dart';

const _monthLabels = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
];

/// §14.x — Corrige un vrai trou trouvé à l'audit : la courbe
/// d'évolution sur 6-12 mois existait côté web (avec recharts),
/// jamais côté mobile. Pas de bibliothèque de graphiques installée
/// côté mobile — reconstruit ici en Flutter natif (barres simples,
/// sans dépendance) plutôt que d'ajouter un paquet non testé.
class FinancesTrendScreen extends StatefulWidget {
  final ProprietaireRepository repo;
  final String salleId;
  final String currency;

  const FinancesTrendScreen({super.key, required this.repo, required this.salleId, required this.currency});

  @override
  State<FinancesTrendScreen> createState() => _FinancesTrendScreenState();
}

class _FinancesTrendScreenState extends State<FinancesTrendScreen> {
  List<Map<String, dynamic>>? _trend;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final trend = await widget.repo.getFinancesTrend(widget.salleId, months: 6);
      setState(() => _trend = trend);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Évolution (6 mois)')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, style: const TextStyle(color: AppColors.danger), textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        OutlinedButton(onPressed: _load, child: const Text('Réessayer')),
                      ],
                    ),
                  ),
                )
              : (_trend == null || _trend!.isEmpty)
                  ? const Center(child: Text('Aucune donnée', style: TextStyle(color: AppColors.ink400)))
                  : _buildChart(),
    );
  }

  Widget _buildChart() {
    final currencyFormat = currencyFormatFor(widget.currency);
    final maxValue = _trend!
        .expand((t) => [
              (t['totalRevenus'] as num).toDouble(),
              (t['totalDepenses'] as num).toDouble(),
              (t['resultatNet'] as num).abs().toDouble(),
            ])
        .fold<double>(1, (max, v) => v > max ? v : max);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            _LegendDot(color: AppColors.primary, label: 'Revenus'),
            SizedBox(width: 16),
            _LegendDot(color: AppColors.danger, label: 'Dépenses'),
          ],
        ),
        const SizedBox(height: 20),
        SizedBox(
          height: 220,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: _trend!.map((t) {
              final revenus = (t['totalRevenus'] as num).toDouble();
              final depenses = (t['totalDepenses'] as num).toDouble();
              final month = (t['month'] as num).toInt();
              return Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 14,
                        height: 160 * (revenus / maxValue),
                        decoration: const BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.only(topLeft: Radius.circular(3), topRight: Radius.circular(3)),
                        ),
                      ),
                      const SizedBox(width: 3),
                      Container(
                        width: 14,
                        height: 160 * (depenses / maxValue),
                        decoration: const BoxDecoration(
                          color: AppColors.danger,
                          borderRadius: BorderRadius.only(topLeft: Radius.circular(3), topRight: Radius.circular(3)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(_monthLabels[month - 1], style: const TextStyle(fontSize: 11, color: AppColors.ink400)),
                ],
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 24),
        const Divider(),
        const SizedBox(height: 8),
        ..._trend!.reversed.map((t) {
          final month = (t['month'] as num).toInt();
          final year = (t['year'] as num).toInt();
          final resultatNet = (t['resultatNet'] as num).toDouble();
          return ListTile(
            dense: true,
            title: Text('${_monthLabels[month - 1]} $year'),
            trailing: Text(
              currencyFormat.format(resultatNet),
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: resultatNet >= 0 ? AppColors.primary : AppColors.danger,
              ),
            ),
          );
        }),
      ],
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.ink400)),
      ],
    );
  }
}
