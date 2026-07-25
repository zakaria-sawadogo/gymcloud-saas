import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/salle_extras.dart';
import '../gestionnaire_repository.dart';

const _paymentMethods = {
  'ESPECES': 'Espèces',
  'ORANGE_MONEY': 'Orange Money',
  'MOOV_MONEY': 'Moov Money',
  'WAVE': 'Wave',
};

/// §4.5 — Inscrire un nouvel adhérent avec encaissement immédiat,
/// depuis l'app mobile (jusqu'ici réservé au guichet web).
class CreateAdherentScreen extends StatefulWidget {
  const CreateAdherentScreen({super.key});

  @override
  State<CreateAdherentScreen> createState() => _CreateAdherentScreenState();
}

class _CreateAdherentScreenState extends State<CreateAdherentScreen> {
  late final GestionnaireRepository _repo;
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _mobileMoneyPhoneController = TextEditingController();
  List<AbonnementCatalogue> _catalogue = [];
  AbonnementCatalogue? _selected;
  String _paymentMethod = 'ESPECES';
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _error;
  Map<String, dynamic>? _result;

  @override
  void initState() {
    super.initState();
    _repo = GestionnaireRepository(context.read());
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
    final salleId = context.read<AuthProvider>().user?.salle?.id;
    if (salleId == null || _selected == null) return;
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      final res = await _repo.createAdherent(
        salleId: salleId,
        firstName: _firstNameController.text.trim(),
        lastName: _lastNameController.text.trim(),
        phone: _phoneController.text.trim(),
        abonnementCatalogueId: _selected!.id,
        paymentMethod: _paymentMethod,
        paymentPhoneNumber: _paymentMethod != 'ESPECES' ? _mobileMoneyPhoneController.text.trim() : null,
      );
      setState(() => _result = res);
    } catch (e) {
      setState(() => _error = 'Une erreur est survenue — vérifiez les informations et réessayez');
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _mobileMoneyPhoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nouvel adhérent')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _result != null
              ? _buildResult()
              : _buildForm(),
    );
  }

  Widget _buildResult() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Icon(Icons.check_circle, color: AppColors.primary, size: 48),
          const SizedBox(height: 16),
          const Text(
            'Adhérent inscrit et paiement encaissé avec succès.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 15),
          ),
          const SizedBox(height: 16),
          const Text(
            'Mot de passe temporaire — à communiquer directement à l\'adhérent (à changer à sa première connexion) :',
            style: TextStyle(color: AppColors.ink600, fontSize: 13),
          ),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(color: AppColors.ink50, borderRadius: BorderRadius.circular(8)),
            child: Text(
              _result!['tempPassword'] ?? '',
              style: const TextStyle(fontFamily: 'monospace', fontSize: 15),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Terminé'),
          ),
        ],
      ),
    );
  }

  Widget _buildForm() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: _firstNameController,
          decoration: const InputDecoration(labelText: 'Prénom'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _lastNameController,
          decoration: const InputDecoration(labelText: 'Nom'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _phoneController,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(labelText: 'Téléphone'),
        ),
        const SizedBox(height: 20),
        const Text('Formule', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        if (_catalogue.isEmpty)
          const Text('Aucune formule disponible pour cette salle.', style: TextStyle(color: AppColors.ink400))
        else
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
        const SizedBox(height: 12),
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
            controller: _mobileMoneyPhoneController,
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
              : const Text('Inscrire et encaisser'),
        ),
      ],
    );
  }
}
