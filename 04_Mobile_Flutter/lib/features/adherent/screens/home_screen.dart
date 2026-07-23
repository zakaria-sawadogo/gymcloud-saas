import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../core/models/adherent.dart';
import '../adherent_repository.dart';
import '../../shared/logout_button.dart';
import 'renew_subscription_screen.dart';

class HomeScreen extends StatefulWidget {
  final void Function(int tabIndex) onNavigateToTab;
  const HomeScreen({super.key, required this.onNavigateToTab});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final AdherentRepository _repo;
  List<AdherentAbonnement> _history = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _repo = AdherentRepository(context.read());
    _load();
  }

  Future<void> _load() async {
    final adherentId = context.read<AuthProvider>().user?.adherentId;
    if (adherentId == null) return;
    setState(() => _isLoading = true);
    try {
      final history = await _repo.getHistory(adherentId);
      setState(() {
        _history = history;
        _error = null;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  AdherentAbonnement? get _currentSubscription {
    try {
      return _history.firstWhere((h) => h.status == 'ACTIF' || h.status == 'EN_GRACE');
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    return Scaffold(
      appBar: AppBar(title: Text('Bonjour, ${user?.firstName ?? ''}'), actions: const [LogoutButton()]),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(_error!, style: const TextStyle(color: AppColors.danger)),
                    ),
                  _SubscriptionCard(subscription: _currentSubscription, salleName: user?.salle?.name),
                  const SizedBox(height: 16),
                  _QuickActionsRow(onNavigateToTab: widget.onNavigateToTab),
                ],
              ),
      ),
    );
  }
}

class _SubscriptionCard extends StatelessWidget {
  final AdherentAbonnement? subscription;
  final String? salleName;
  const _SubscriptionCard({required this.subscription, this.salleName});

  @override
  Widget build(BuildContext context) {
    if (subscription == null) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Aucun abonnement actif', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              const SizedBox(height: 4),
              Text(
                'Faites votre demande de réabonnement directement ici, ou à l\'accueil de ${salleName ?? 'votre salle'}.',
                style: const TextStyle(color: AppColors.ink600),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const RenewSubscriptionScreen()),
                ),
                child: const Text('Se réabonner'),
              ),
            ],
          ),
        ),
      );
    }

    final daysLeft = subscription!.daysRemaining;
    return Card(
      color: AppColors.primary,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  subscription!.catalogueName ?? 'Abonnement',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 16),
                ),
                StatusBadge(status: subscription!.status),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              daysLeft > 0 ? '$daysLeft jours restants' : 'Expire aujourd\'hui',
              style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              'Jusqu\'au ${DateFormat('dd MMM yyyy', 'fr_FR').format(subscription!.endDate)}',
              style: const TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Colors.white70),
                ),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const RenewSubscriptionScreen()),
                ),
                child: const Text('Se réabonner par avance'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickActionsRow extends StatelessWidget {
  final void Function(int tabIndex) onNavigateToTab;
  const _QuickActionsRow({required this.onNavigateToTab});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ActionTile(
            icon: Icons.qr_code_2,
            label: 'Mon QR code',
            onTap: () => onNavigateToTab(1),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _ActionTile(
            icon: Icons.event,
            label: 'Réserver une séance',
            onTap: () => onNavigateToTab(2),
          ),
        ),
      ],
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _ActionTile({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Icon(icon, color: AppColors.primary, size: 28),
              const SizedBox(height: 8),
              Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      ),
    );
  }
}
