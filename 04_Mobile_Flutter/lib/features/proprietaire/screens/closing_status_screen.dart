import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/currency_format.dart';
import '../proprietaire_repository.dart';

/// §14.x — Corrige un vrai trou trouvé à l'audit : la clôture (caisse
/// boutique + paiements + vue générale) existait côté web, jamais
/// côté mobile. Lecture seule — comme le web (canClose=false), le
/// propriétaire consulte, ne déclenche pas la clôture lui-même.
class ClosingStatusScreen extends StatefulWidget {
  final ProprietaireRepository repo;
  final String salleId;
  final String currency;

  const ClosingStatusScreen({super.key, required this.repo, required this.salleId, required this.currency});

  @override
  State<ClosingStatusScreen> createState() => _ClosingStatusScreenState();
}

class _ClosingStatusScreenState extends State<ClosingStatusScreen> {
  Map<String, dynamic>? _general;
  Map<String, dynamic>? _boutique;
  Map<String, dynamic>? _payments;
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
      final results = await Future.wait([
        widget.repo.getGeneralClosing(widget.salleId),
        widget.repo.getBoutiqueClosingStatus(widget.salleId).catchError((_) => <String, dynamic>{}),
        widget.repo.getPaymentsClosingStatus(widget.salleId),
      ]);
      setState(() {
        _general = results[0];
        _boutique = results[1];
        _payments = results[2];
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Clôture')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _isLoading
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
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_general != null) _buildGeneralCard(_general!),
                      const SizedBox(height: 12),
                      _buildStatusCard(
                        'Boutique',
                        _boutique,
                        (c) => c['closing']?['totalAmount'],
                      ),
                      const SizedBox(height: 12),
                      _buildStatusCard(
                        'Paiements',
                        _payments,
                        (c) => c['closing']?['cashAmount'],
                      ),
                    ],
                  ),
      ),
    );
  }

  Widget _buildGeneralCard(Map<String, dynamic> general) {
    final cashToVerify = (general['cashToVerify'] as num?)?.toDouble() ?? 0;
    final grandTotal = (general['grandTotal'] as num?)?.toDouble() ?? 0;
    return Card(
      color: AppColors.primaryLight,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Espèces à vérifier en caisse', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(
              currencyFormatFor(widget.currency).format(cashToVerify),
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: AppColors.primary),
            ),
            const SizedBox(height: 8),
            Text(
              'Total général (tous moyens) : ${currencyFormatFor(widget.currency).format(grandTotal)}',
              style: const TextStyle(fontSize: 12, color: AppColors.ink400),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusCard(String title, Map<String, dynamic>? status, num? Function(Map<String, dynamic>) getAmount) {
    final isClosed = status?['isClosed'] == true;
    final closing = status?['closing'] as Map<String, dynamic>?;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                Icon(
                  isClosed ? Icons.check_circle : Icons.schedule,
                  color: isClosed ? AppColors.primary : AppColors.ink400,
                  size: 20,
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (isClosed && closing != null) ...[
              Text(
                currencyFormatFor(widget.currency).format((getAmount(status!) as num?)?.toDouble() ?? 0),
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 4),
              Text(
                'Par ${closing['closedBy']?['firstName'] ?? ''} ${closing['closedBy']?['lastName'] ?? ''}',
                style: const TextStyle(fontSize: 12, color: AppColors.ink400),
              ),
            ] else
              const Text('Pas encore clôturé aujourd\'hui', style: TextStyle(color: AppColors.ink400)),
          ],
        ),
      ),
    );
  }
}
