import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/widgets/stat_card.dart';
import '../proprietaire_repository.dart';

/// Drill-down vers le détail d'une salle spécifique — mêmes
/// indicateurs que le tableau de bord Gestionnaire, en lecture seule
/// (§2.3 : le propriétaire consulte, il n'opère pas au quotidien).
class SalleDetailScreen extends StatefulWidget {
  final String salleId;
  final String salleName;
  const SalleDetailScreen({super.key, required this.salleId, required this.salleName});

  @override
  State<SalleDetailScreen> createState() => _SalleDetailScreenState();
}

class _SalleDetailScreenState extends State<SalleDetailScreen> {
  late final ProprietaireRepository _repo;
  Map<String, dynamic>? _data;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _repo = ProprietaireRepository(context.read());
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    final data = await _repo.getSalleDashboard(widget.salleId);
    setState(() {
      _data = data;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(locale: 'fr_FR', symbol: 'FCFA', decimalDigits: 0);

    return Scaffold(
      appBar: AppBar(title: Text(widget.salleName)),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: GridView.count(
                padding: const EdgeInsets.all(16),
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.3,
                children: [
                  StatCard(
                    label: 'Adhérents actifs',
                    value: '${_data?['adherents']?['actifs'] ?? 0}',
                    icon: Icons.people_outline,
                  ),
                  StatCard(
                    label: 'Nouveaux ce mois',
                    value: '${_data?['adherents']?['nouveauxCeMois'] ?? 0}',
                    icon: Icons.person_add_outlined,
                  ),
                  StatCard(
                    label: 'Revenus aujourd\'hui',
                    value: currencyFormat.format(_data?['revenus']?['aujourdHui'] ?? 0),
                    icon: Icons.account_balance_wallet_outlined,
                    isAccent: true,
                  ),
                  StatCard(
                    label: 'Revenus ce mois',
                    value: currencyFormat.format(_data?['revenus']?['ceMois'] ?? 0),
                    icon: Icons.trending_up,
                    isAccent: true,
                  ),
                  StatCard(
                    label: 'Présents maintenant',
                    value: '${_data?['frequentation']?['presentsActuellement'] ?? 0}',
                    icon: Icons.directions_run,
                  ),
                  StatCard(
                    label: 'Réservations (7j)',
                    value: '${_data?['reservations']?['confirmeesSeptJoursAVenir'] ?? 0}',
                    icon: Icons.event_available_outlined,
                  ),
                ],
              ),
            ),
    );
  }
}
