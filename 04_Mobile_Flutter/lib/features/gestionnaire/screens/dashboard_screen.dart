import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/widgets/stat_card.dart';
import '../gestionnaire_repository.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late final GestionnaireRepository _repo;
  Map<String, dynamic>? _data;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _repo = GestionnaireRepository(context.read());
    _load();
  }

  Future<void> _load() async {
    final salleId = context.read<AuthProvider>().user?.salle?.id;
    if (salleId == null) return;
    setState(() => _isLoading = true);
    final data = await _repo.getDashboard(salleId);
    setState(() {
      _data = data;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final salle = context.watch<AuthProvider>().user?.salle;
    final currencyFormat = NumberFormat.currency(locale: 'fr_FR', symbol: 'FCFA', decimalDigits: 0);

    return Scaffold(
      appBar: AppBar(title: Text(salle?.name ?? 'Tableau de bord')),
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
                    label: 'Présents maintenant',
                    value: '${_data?['frequentation']?['presentsActuellement'] ?? 0}',
                    icon: Icons.directions_run,
                  ),
                  StatCard(
                    label: 'Revenus aujourd\'hui',
                    value: currencyFormat.format(_data?['revenus']?['aujourdHui'] ?? 0),
                    icon: Icons.account_balance_wallet_outlined,
                    isAccent: true,
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
