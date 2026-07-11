import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/stat_card.dart';
import '../proprietaire_repository.dart';
import 'salle_detail_screen.dart';

/// Vue consolidée multi-salles (§2.3, §11) — équivalent mobile de
/// ProprietaireDashboardView.tsx côté web. Un propriétaire n'a pas
/// besoin d'actions terrain (pas de scanner, pas d'encaissement) : sa
/// app se limite volontairement au pilotage et à la consultation.
class ConsolidatedDashboardScreen extends StatefulWidget {
  const ConsolidatedDashboardScreen({super.key});

  @override
  State<ConsolidatedDashboardScreen> createState() => _ConsolidatedDashboardScreenState();
}

class _ConsolidatedDashboardScreenState extends State<ConsolidatedDashboardScreen> {
  late final ProprietaireRepository _repo;
  Map<String, dynamic>? _data;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _repo = ProprietaireRepository(context.read());
    _load();
  }

  Future<void> _load() async {
    final proprietaireId = context.read<AuthProvider>().user?.proprietaireId;
    if (proprietaireId == null) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final data = await _repo.getConsolidatedDashboard(proprietaireId);
      setState(() => _data = data);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(locale: 'fr_FR', symbol: 'FCFA', decimalDigits: 0);
    final consolidated = _data?['consolidated'] as Map<String, dynamic>?;
    final salles = (_data?['salles'] as List<dynamic>?) ?? [];

    return Scaffold(
      appBar: AppBar(title: const Text('Vue consolidée')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: AppColors.danger)))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      GridView.count(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisCount: 2,
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                        childAspectRatio: 1.3,
                        children: [
                          StatCard(
                            label: 'Adhérents actifs (total)',
                            value: '${consolidated?['totalAdherentsActifs'] ?? 0}',
                            icon: Icons.people_outline,
                          ),
                          StatCard(
                            label: 'Présents maintenant',
                            value: '${consolidated?['presentsActuellement'] ?? 0}',
                            icon: Icons.directions_run,
                          ),
                          StatCard(
                            label: 'Revenus aujourd\'hui',
                            value: currencyFormat.format(consolidated?['revenusAujourdHui'] ?? 0),
                            icon: Icons.account_balance_wallet_outlined,
                            isAccent: true,
                          ),
                          StatCard(
                            label: 'Revenus ce mois',
                            value: currencyFormat.format(consolidated?['revenusCeMois'] ?? 0),
                            icon: Icons.trending_up,
                            isAccent: true,
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      const Text('Mes salles', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                      const SizedBox(height: 8),
                      ...salles.map((s) => _SalleRow(salle: s as Map<String, dynamic>)),
                    ],
                  ),
                ),
    );
  }
}

class _SalleRow extends StatelessWidget {
  final Map<String, dynamic> salle;
  const _SalleRow({required this.salle});

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(locale: 'fr_FR', symbol: 'FCFA', decimalDigits: 0);
    final adherentsActifs = salle['adherents']?['actifs'] ?? 0;
    final revenusCeMois = salle['revenus']?['ceMois'] ?? 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: const CircleAvatar(
          backgroundColor: AppColors.primaryLight,
          child: Icon(Icons.storefront_outlined, color: AppColors.primary),
        ),
        title: Text(salle['salleName'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('$adherentsActifs adhérents · ${currencyFormat.format(revenusCeMois)}'),
        trailing: const Icon(Icons.chevron_right, color: AppColors.ink400),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => SalleDetailScreen(salleId: salle['salleId'], salleName: salle['salleName'] ?? ''),
          ),
        ),
      ),
    );
  }
}
