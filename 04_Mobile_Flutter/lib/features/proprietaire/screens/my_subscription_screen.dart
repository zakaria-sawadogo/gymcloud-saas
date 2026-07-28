import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'dart:io';
import '../../../core/theme/app_theme.dart';
import '../proprietaire_repository.dart';

/// §9.3, §9.4, §9.8 — Équivalent mobile de la page web "Mon
/// abonnement" : plan actuel + add-ons activables à tout moment,
/// jamais automatiques, facturés séparément au prorata dès leur
/// activation (voir SaasBillingService.attachAddon côté backend).
class MySubscriptionScreen extends StatefulWidget {
  const MySubscriptionScreen({super.key});

  @override
  State<MySubscriptionScreen> createState() => _MySubscriptionScreenState();
}

class _MySubscriptionScreenState extends State<MySubscriptionScreen> {
  late final ProprietaireRepository _repo;
  Map<String, dynamic>? _subscription;
  List<Map<String, dynamic>> _allAddons = [];
  List<Map<String, dynamic>> _activeAddons = [];
  List<Map<String, dynamic>> _invoices = [];
  bool _isLoading = true;
  String? _error;
  String? _togglingAddonId;
  String? _downloadingInvoiceId;

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
      final subscription = await _repo.getMySubscription();
      final allAddons = await _repo.getAvailableAddons();
      final activeAddons = await _repo.getActiveAddons(subscription['id']);
      final invoices = await _repo.getMyInvoices();
      setState(() {
        _subscription = subscription;
        _allAddons = allAddons;
        _activeAddons = activeAddons;
        _invoices = invoices;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _toggleAddon(String addonId, bool isActive) async {
    final subscriptionId = _subscription?['id'];
    if (subscriptionId == null) return;
    setState(() => _togglingAddonId = addonId);
    try {
      if (isActive) {
        await _repo.detachAddon(subscriptionId, addonId);
      } else {
        await _repo.attachAddon(subscriptionId, addonId);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Add-on activé — facturé séparément au prorata sur une facture à part')),
          );
        }
      }
      final activeAddons = await _repo.getActiveAddons(subscriptionId);
      setState(() => _activeAddons = activeAddons);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.danger));
      }
    } finally {
      setState(() => _togglingAddonId = null);
    }
  }

  Future<void> _downloadInvoice(String invoiceId, String invoiceNumber) async {
    setState(() => _downloadingInvoiceId = invoiceId);
    try {
      final bytes = await _repo.downloadInvoicePdf(invoiceId);
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/facture-$invoiceNumber.pdf');
      await file.writeAsBytes(bytes);
      if (mounted) {
        await Share.shareXFiles([XFile(file.path)], text: 'Facture GymCloud $invoiceNumber');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.danger));
      }
    } finally {
      if (mounted) setState(() => _downloadingInvoiceId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(locale: 'fr_FR', symbol: 'FCFA', decimalDigits: 0);
    final activeAddonIds = _activeAddons.map((a) => a['addonId'] as String).toSet();

    return Scaffold(
      appBar: AppBar(title: const Text('Mon abonnement')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: AppColors.danger)))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Plan actuel', style: TextStyle(color: AppColors.ink400, fontSize: 13)),
                              const SizedBox(height: 2),
                              Text(
                                _subscription?['saasPlan']?['name'] ?? '',
                                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 12),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  _InfoColumn(
                                    label: 'Cycle',
                                    value: _subscription?['billingCycle'] == 'ANNUEL' ? 'Annuel' : 'Mensuel',
                                  ),
                                  _InfoColumn(
                                    label: 'Prochaine échéance',
                                    value: _subscription?['currentPeriodEnd'] != null
                                        ? DateFormat('dd/MM/yyyy')
                                            .format(DateTime.parse(_subscription!['currentPeriodEnd']))
                                        : '—',
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text('Add-ons disponibles', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                      const SizedBox(height: 4),
                      const Text(
                        'Jamais inclus automatiquement — activez ceux dont vous avez besoin, facturés séparément au prorata.',
                        style: TextStyle(fontSize: 12.5, color: AppColors.ink400),
                      ),
                      const SizedBox(height: 12),
                      ..._allAddons.map((addon) {
                        final isActive = activeAddonIds.contains(addon['id']);
                        final isToggling = _togglingAddonId == addon['id'];
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(addon['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                                if (addon['description'] != null) ...[
                                  const SizedBox(height: 2),
                                  Text(addon['description'], style: const TextStyle(color: AppColors.ink600, fontSize: 13)),
                                ],
                                const SizedBox(height: 4),
                                Text(
                                  '${currencyFormat.format(double.parse((addon['price'] ?? 0).toString()))} / mois',
                                  style: const TextStyle(color: AppColors.ink600, fontSize: 13),
                                ),
                                const SizedBox(height: 10),
                                SizedBox(
                                  width: double.infinity,
                                  child: OutlinedButton(
                                    onPressed: isToggling ? null : () => _toggleAddon(addon['id'], isActive),
                                    style: OutlinedButton.styleFrom(
                                      backgroundColor: isActive ? null : AppColors.primary,
                                      foregroundColor: isActive ? AppColors.ink900 : Colors.white,
                                    ),
                                    child: isToggling
                                        ? const SizedBox(
                                            height: 16,
                                            width: 16,
                                            child: CircularProgressIndicator(strokeWidth: 2),
                                          )
                                        : Text(isActive ? 'Désactiver' : 'Activer'),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                      const SizedBox(height: 24),
                      const Text('Mes factures', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                      const SizedBox(height: 12),
                      if (_invoices.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Text('Aucune facture pour le moment', style: TextStyle(color: AppColors.ink400)),
                        )
                      else
                        ..._invoices.map((invoice) {
                          final isDownloading = _downloadingInvoiceId == invoice['id'];
                          final status = invoice['status'] as String?;
                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              title: Text(invoice['invoiceNumber'] ?? ''),
                              subtitle: Text(
                                '${currencyFormat.format(double.parse((invoice['totalAmount'] ?? 0).toString()))} · '
                                '${status == 'PAYEE' ? 'Payée' : status ?? ''}',
                              ),
                              trailing: isDownloading
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : IconButton(
                                      icon: const Icon(Icons.download_outlined),
                                      onPressed: () => _downloadInvoice(invoice['id'], invoice['invoiceNumber']),
                                    ),
                            ),
                          );
                        }),
                    ],
                  ),
                ),
    );
  }
}

class _InfoColumn extends StatelessWidget {
  final String label;
  final String value;
  const _InfoColumn({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: AppColors.ink400, fontSize: 12)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
      ],
    );
  }
}
