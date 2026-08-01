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
  List<Map<String, dynamic>> _salles = [];
  String? _selectedSalleId;
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
      final salles = await _repo.getMySalles();
      final allAddons = await _repo.getAvailableAddons();
      final selectedSalleId = _selectedSalleId ?? (salles.isNotEmpty ? salles.first['id'] as String : null);
      final activeAddons = selectedSalleId != null ? await _repo.getActiveAddons(selectedSalleId) : <Map<String, dynamic>>[];
      final invoices = await _repo.getMyInvoices();
      setState(() {
        _subscription = subscription;
        _salles = salles;
        _selectedSalleId = selectedSalleId;
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

  Future<void> _onSalleChanged(String? salleId) async {
    if (salleId == null) return;
    setState(() => _selectedSalleId = salleId);
    try {
      final activeAddons = await _repo.getActiveAddons(salleId);
      setState(() => _activeAddons = activeAddons);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.danger));
      }
    }
  }

  Future<void> _requestAddon(Map<String, dynamic> addon) async {
    final salleId = _selectedSalleId;
    if (salleId == null) return;

    final durationMonths = await showDialog<int>(
      context: context,
      builder: (ctx) => _DurationPickerDialog(addonName: addon['name'] ?? '', pricePerMonth: addon['price'] ?? 0),
    );
    if (durationMonths == null) return;

    setState(() => _togglingAddonId = addon['id']);
    try {
      await _repo.attachAddon(salleId, addon['id'], durationMonths: durationMonths);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Demande envoyée — l'add-on sera activé une fois le paiement validé")),
        );
      }
      final activeAddons = await _repo.getActiveAddons(salleId);
      setState(() => _activeAddons = activeAddons);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.danger));
      }
    } finally {
      if (mounted) setState(() => _togglingAddonId = null);
    }
  }

  Future<void> _cancelAddon(String addonId) async {
    final salleId = _selectedSalleId;
    if (salleId == null) return;
    setState(() => _togglingAddonId = addonId);
    try {
      await _repo.detachAddon(salleId, addonId);
      final activeAddons = await _repo.getActiveAddons(salleId);
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
                      if (_salles.length > 1) ...[
                        DropdownButtonFormField<String>(
                          value: _selectedSalleId,
                          decoration: const InputDecoration(labelText: 'Salle'),
                          items: _salles
                              .map((s) => DropdownMenuItem(value: s['id'] as String, child: Text(s['name'] as String)))
                              .toList(),
                          onChanged: _onSalleChanged,
                        ),
                        const SizedBox(height: 12),
                      ],
                      const Text('Add-ons disponibles', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                      const SizedBox(height: 4),
                      const Text(
                        'Jamais inclus automatiquement — activez ceux dont vous avez besoin, facturés séparément au prorata.',
                        style: TextStyle(fontSize: 12.5, color: AppColors.ink400),
                      ),
                      const SizedBox(height: 12),
                      ..._allAddons.map((addon) {
                        final current = _activeAddons.firstWhere(
                          (a) => a['addonId'] == addon['id'],
                          orElse: () => <String, dynamic>{},
                        );
                        final status = current['status'] as String?;
                        final isBusy = _togglingAddonId == addon['id'];
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(addon['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                                    if (status == 'EN_ATTENTE' || status == 'ACTIF') ...[
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: status == 'ACTIF'
                                              ? AppColors.primary.withValues(alpha: 0.1)
                                              : AppColors.ink50,
                                          borderRadius: BorderRadius.circular(20),
                                        ),
                                        child: Text(
                                          status == 'ACTIF' ? 'Actif' : 'En attente',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            color: status == 'ACTIF' ? AppColors.primary : AppColors.ink600,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                                if (addon['description'] != null) ...[
                                  const SizedBox(height: 2),
                                  Text(addon['description'], style: const TextStyle(color: AppColors.ink600, fontSize: 13)),
                                ],
                                const SizedBox(height: 4),
                                Text(
                                  '${currencyFormat.format(double.parse((addon['price'] ?? 0).toString()))} / mois',
                                  style: const TextStyle(color: AppColors.ink600, fontSize: 13),
                                ),
                                if (status == 'ACTIF' && current['endDate'] != null) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    'Jusqu\'au ${DateFormat('dd/MM/yyyy').format(DateTime.parse(current['endDate']))}',
                                    style: const TextStyle(color: AppColors.ink400, fontSize: 12),
                                  ),
                                ],
                                if (status == 'EN_ATTENTE') ...[
                                  const SizedBox(height: 2),
                                  const Text(
                                    'En attente de validation du paiement',
                                    style: TextStyle(color: AppColors.ink400, fontSize: 12),
                                  ),
                                ],
                                const SizedBox(height: 10),
                                SizedBox(
                                  width: double.infinity,
                                  child: OutlinedButton(
                                    onPressed: isBusy
                                        ? null
                                        : status == null
                                            ? () => _requestAddon(addon)
                                            : () => _cancelAddon(addon['id']),
                                    style: OutlinedButton.styleFrom(
                                      backgroundColor: status == null ? AppColors.primary : null,
                                      foregroundColor: status == null ? Colors.white : AppColors.ink900,
                                    ),
                                    child: isBusy
                                        ? const SizedBox(
                                            height: 16,
                                            width: 16,
                                            child: CircularProgressIndicator(strokeWidth: 2),
                                          )
                                        : Text(
                                            status == null
                                                ? 'Activer'
                                                : status == 'EN_ATTENTE'
                                                    ? 'Annuler la demande'
                                                    : 'Désactiver',
                                          ),
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

/// §9.3 — Le propriétaire précise la durée souhaitée (12 mois par
/// défaut) avant l'envoi de la demande — jamais d'activation
/// immédiate, une facture est générée à régler.
class _DurationPickerDialog extends StatefulWidget {
  final String addonName;
  final dynamic pricePerMonth;
  const _DurationPickerDialog({required this.addonName, required this.pricePerMonth});

  @override
  State<_DurationPickerDialog> createState() => _DurationPickerDialogState();
}

class _DurationPickerDialogState extends State<_DurationPickerDialog> {
  int _months = 12;

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(locale: 'fr_FR', symbol: 'FCFA', decimalDigits: 0);
    final pricePerMonth = double.parse(widget.pricePerMonth.toString());
    final total = pricePerMonth * _months;

    return AlertDialog(
      title: Text('Activer "${widget.addonName}"'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Durée (mois)', style: TextStyle(fontSize: 13, color: AppColors.ink600)),
          const SizedBox(height: 8),
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.remove_circle_outline),
                onPressed: _months > 1 ? () => setState(() => _months--) : null,
              ),
              Text('$_months', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
              IconButton(
                icon: const Icon(Icons.add_circle_outline),
                onPressed: () => setState(() => _months++),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Total : ${currencyFormat.format(total)} pour $_months mois',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          const Text(
            "Une facture sera générée, à régler pour activer l'add-on.",
            style: TextStyle(fontSize: 12, color: AppColors.ink400),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Annuler')),
        ElevatedButton(
          onPressed: () => Navigator.pop(context, _months),
          child: const Text("Demander l'activation"),
        ),
      ],
    );
  }
}
