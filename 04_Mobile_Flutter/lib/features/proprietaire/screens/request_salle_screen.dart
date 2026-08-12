import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../proprietaire_repository.dart';

/// §14.x — Corrige un vrai trou trouvé à l'audit : demander une salle
/// supplémentaire existait côté web, jamais côté mobile.
class RequestSalleScreen extends StatefulWidget {
  final ProprietaireRepository repo;

  const RequestSalleScreen({super.key, required this.repo});

  @override
  State<RequestSalleScreen> createState() => _RequestSalleScreenState();
}

class _RequestSalleScreenState extends State<RequestSalleScreen> {
  List<dynamic>? _requests;
  List<dynamic>? _countries;
  bool _isLoading = true;
  String? _error;

  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  String? _selectedCountryId;
  bool _isSubmitting = false;
  String? _submitError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    _cityCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        widget.repo.getMySalleRequests(),
        widget.repo.getCountries(),
      ]);
      setState(() {
        _requests = results[0];
        _countries = results[1];
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _submit() async {
    if (_nameCtrl.text.trim().isEmpty ||
        _phoneCtrl.text.trim().isEmpty ||
        _addressCtrl.text.trim().isEmpty ||
        _cityCtrl.text.trim().isEmpty ||
        _selectedCountryId == null) {
      setState(() => _submitError = 'Merci de remplir tous les champs obligatoires');
      return;
    }
    setState(() {
      _isSubmitting = true;
      _submitError = null;
    });
    try {
      await widget.repo.requestNewSalle(
        name: _nameCtrl.text.trim(),
        phone: _phoneCtrl.text.trim(),
        address: _addressCtrl.text.trim(),
        city: _cityCtrl.text.trim(),
        countryId: _selectedCountryId!,
        email: _emailCtrl.text.trim(),
      );
      _nameCtrl.clear();
      _phoneCtrl.clear();
      _addressCtrl.clear();
      _cityCtrl.clear();
      _emailCtrl.clear();
      setState(() => _selectedCountryId = null);
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Demande envoyée — en attente de validation')),
        );
      }
    } catch (e) {
      setState(() => _submitError = e.toString());
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Demander une salle')),
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
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (_requests != null && _requests!.isNotEmpty) ...[
                      const Text('Mes demandes', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                      const SizedBox(height: 8),
                      ..._requests!.map((r) {
                        final request = r as Map<String, dynamic>;
                        return Card(
                          child: ListTile(
                            title: Text(request['name'] ?? ''),
                            subtitle: Text(request['city'] ?? ''),
                            trailing: _StatusChip(status: request['status'] ?? ''),
                          ),
                        );
                      }),
                      const SizedBox(height: 24),
                    ],
                    const Text('Nouvelle demande', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _nameCtrl,
                      decoration: const InputDecoration(labelText: 'Nom de la salle', border: OutlineInputBorder()),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _phoneCtrl,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(labelText: 'Téléphone', border: OutlineInputBorder()),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _addressCtrl,
                      decoration: const InputDecoration(labelText: 'Adresse', border: OutlineInputBorder()),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _cityCtrl,
                      decoration: const InputDecoration(labelText: 'Ville', border: OutlineInputBorder()),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _selectedCountryId,
                      decoration: const InputDecoration(labelText: 'Pays', border: OutlineInputBorder()),
                      items: (_countries ?? []).map((c) {
                        final country = c as Map<String, dynamic>;
                        return DropdownMenuItem(value: country['id'] as String, child: Text(country['name'] ?? ''));
                      }).toList(),
                      onChanged: (v) => setState(() => _selectedCountryId = v),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(labelText: 'E-mail (optionnel)', border: OutlineInputBorder()),
                    ),
                    const SizedBox(height: 12),
                    if (_submitError != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(_submitError!, style: const TextStyle(color: AppColors.danger)),
                      ),
                    FilledButton(
                      onPressed: _isSubmitting ? null : _submit,
                      child: _isSubmitting
                          ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Text('Envoyer la demande'),
                    ),
                  ],
                ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;
  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    final labels = {
      'EN_ATTENTE': 'En attente',
      'APPROUVEE': 'Approuvée',
      'REJETEE': 'Rejetée',
    };
    final colors = {
      'EN_ATTENTE': AppColors.ink400,
      'APPROUVEE': AppColors.primary,
      'REJETEE': AppColors.danger,
    };
    return Chip(
      label: Text(labels[status] ?? status, style: const TextStyle(fontSize: 11, color: Colors.white)),
      backgroundColor: colors[status] ?? AppColors.ink400,
      padding: EdgeInsets.zero,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
    );
  }
}
