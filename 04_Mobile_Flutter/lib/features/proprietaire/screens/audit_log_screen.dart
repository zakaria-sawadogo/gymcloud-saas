import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../proprietaire_repository.dart';

/// §14.x — Corrige un vrai trou trouvé à l'audit : le journal
/// d'activité existait côté web, jamais côté mobile.
class AuditLogScreen extends StatefulWidget {
  final ProprietaireRepository repo;
  final String salleId;

  const AuditLogScreen({super.key, required this.repo, required this.salleId});

  @override
  State<AuditLogScreen> createState() => _AuditLogScreenState();
}

class _AuditLogScreenState extends State<AuditLogScreen> {
  List<dynamic>? _entries;
  int _page = 1;
  int _totalPages = 1;
  bool _isLoading = true;
  String? _error;

  static const Map<String, String> _actionLabels = {
    'adherent.create': 'Nouvel adhérent créé',
    'adherent.update': 'Fiche adhérent modifiée',
    'adherent.suspend': 'Adhérent suspendu',
    'adherent.reactivate': 'Adhérent réactivé',
    'payment.cash_recorded': 'Paiement espèces encaissé',
    'payment.mobile_money_confirmed': 'Paiement Mobile Money confirmé',
    'product.create': 'Produit créé',
    'product.update': 'Produit modifié',
    'product_sale.create': 'Vente boutique enregistrée',
    'booking.create': 'Réservation créée',
    'booking.cancel': 'Réservation annulée',
    'boutique.caisse_closed': 'Caisse boutique clôturée',
    'payments.caisse_closed': 'Paiements clôturés',
  };

  static String _label(String action) => _actionLabels[action] ?? action.replaceAll(RegExp(r'[._]'), ' ');

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
      final result = await widget.repo.getAuditLogs(widget.salleId, page: _page);
      setState(() {
        _entries = result['entries'] as List<dynamic>;
        _totalPages = result['totalPages'] as int;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd MMM · HH:mm', 'fr_FR');

    return Scaffold(
      appBar: AppBar(title: const Text('Journal d\'activité')),
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
              : (_entries == null || _entries!.isEmpty)
                  ? const Center(child: Text('Aucune entrée', style: TextStyle(color: AppColors.ink400)))
                  : Column(
                      children: [
                        Expanded(
                          child: ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: _entries!.length,
                            separatorBuilder: (_, __) => const Divider(height: 1),
                            itemBuilder: (context, index) {
                              final entry = _entries![index] as Map<String, dynamic>;
                              final user = entry['user'] as Map<String, dynamic>?;
                              return ListTile(
                                title: Text(_label(entry['action'] as String)),
                                subtitle: Text(user != null ? '${user['firstName']} ${user['lastName']}' : 'Système'),
                                trailing: Text(
                                  dateFormat.format(DateTime.parse(entry['createdAt'])),
                                  style: const TextStyle(fontSize: 12, color: AppColors.ink400),
                                ),
                              );
                            },
                          ),
                        ),
                        if (_totalPages > 1)
                          Padding(
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                TextButton(
                                  onPressed: _page > 1 ? () => setState(() { _page--; _load(); }) : null,
                                  child: const Text('Précédent'),
                                ),
                                Text('Page $_page / $_totalPages'),
                                TextButton(
                                  onPressed: _page < _totalPages ? () => setState(() { _page++; _load(); }) : null,
                                  child: const Text('Suivant'),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
    );
  }
}
