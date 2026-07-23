import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/salle_extras.dart';
import '../adherent_repository.dart';

const _paymentMethods = {
  'ESPECES': 'Espèces (à la salle)',
  'ORANGE_MONEY': 'Orange Money',
  'MOOV_MONEY': 'Moov Money',
  'WAVE': 'Wave',
};

/// §5.6, §8.3 — Demande de réabonnement depuis l'app : l'adhérent
/// choisit une formule et un moyen de paiement ; ça ne crée pas
/// l'abonnement directement, ça crée une demande que le gestionnaire
/// valide (paiement en espèces à confirmer physiquement, ou Mobile
/// Money à rapprocher).
class RenewSubscriptionScreen extends StatefulWidget {
  const RenewSubscriptionScreen({super.key});

  @override
  State<RenewSubscriptionScreen> createState() => _RenewSubscriptionScreenState();
}

class _RenewSubscriptionScreenState extends State<RenewSubscriptionScreen> {
  late final AdherentRepository _repo;
  List<AbonnementCatalogue> _catalogue = [];
  AbonnementCatalogue? _selected;
  String _paymentMethod = 'ESPECES';
  final _phoneController = TextEditingController();
  bool _isLoading = true;
  bool _isSubmitting = false;
  bool _isDone = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _repo = AdherentRepository(context.read());
    _load();
  }

  Future<void> _load() async {
    final salleId = context.read<AuthProvider>().user?.salle?.id;
    if (salleId == null) return;
    try {
      final catalogue = await _repo.getCatalogue(salleId);
      setState(() {
        _catalogue = catalogue;
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _submit() async {
    if (_selected == null) return;
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      await _repo.requestSubscription(
        abonnementCatalogueId: _selected!.id,
        paymentMethod: _paymentMethod,
        phoneNumber: _paymentMethod != 'ESPECES' ? _phoneController.text.trim() : null,
      );
      setState(() => _isDone = true);
    } catch (e) {
      setState(() => _error = 'Une erreur est survenue — réessayez ou contactez la salle');
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Se réabonner')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _isDone
              ? _buildDoneState()
              : _buildForm(),
    );
  }

  Widget _buildDoneState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle, color: AppColors.primary, size: 48),
            const SizedBox(height: 16),
            const Text(
              'Demande envoyée. La salle va confirmer votre paiement et activer votre abonnement.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Retour'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildForm() {
    if (_catalogue.isEmpty) {
      return const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('Aucune formule disponible pour le moment.')));
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Choisissez une formule', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        ..._catalogue.map(
          (c) => Card(
            child: RadioListTile<AbonnementCatalogue>(
              value: c,
              groupValue: _selected,
              onChanged: (v) => setState(() => _selected = v),
              title: Text(c.name),
              subtitle: Text('${c.price.toStringAsFixed(0)} ${c.currency} · ${c.durationDays} jours'),
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text('Moyen de paiement', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        ..._paymentMethods.entries.map(
          (e) => RadioListTile<String>(
            value: e.key,
            groupValue: _paymentMethod,
            onChanged: (v) => setState(() => _paymentMethod = v!),
            title: Text(e.value),
          ),
        ),
        if (_paymentMethod != 'ESPECES') ...[
          const SizedBox(height: 8),
          TextField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'Numéro Mobile Money'),
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: const TextStyle(color: AppColors.danger)),
        ],
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: _selected == null || _isSubmitting ? null : _submit,
          child: _isSubmitting
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Envoyer la demande'),
        ),
      ],
    );
  }
}
