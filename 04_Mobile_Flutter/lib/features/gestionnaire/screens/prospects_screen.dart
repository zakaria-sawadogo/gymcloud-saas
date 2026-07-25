import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/salle_extras.dart';
import '../gestionnaire_repository.dart';
import '../../shared/logout_button.dart';

const _paymentMethods = {
  'ESPECES': 'Espèces',
  'ORANGE_MONEY': 'Orange Money',
  'MOOV_MONEY': 'Moov Money',
  'WAVE': 'Wave',
};

/// §3.2 — Suivi des prospects captés par le site public de la salle.
/// Convertir crée réellement l'adhérent et déclenche son paiement —
/// jusqu'ici, cette étape n'était possible que depuis le web.
class ProspectsScreen extends StatefulWidget {
  const ProspectsScreen({super.key});

  @override
  State<ProspectsScreen> createState() => _ProspectsScreenState();
}

class _ProspectsScreenState extends State<ProspectsScreen> {
  late final GestionnaireRepository _repo;
  List<Prospect> _prospects = [];
  bool _isLoading = true;
  String? _actioningId;

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
    try {
      final prospects = await _repo.getProspects(salleId);
      setState(() => _prospects = prospects);
    } catch (_) {
      // liste vide en cas d'erreur
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _markContacted(Prospect p) async {
    setState(() => _actioningId = p.id);
    try {
      await _repo.markProspectContacted(p.id);
      _load();
    } finally {
      setState(() => _actioningId = null);
    }
  }

  Future<void> _markLost(Prospect p) async {
    final note = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final controller = TextEditingController();
        return AlertDialog(
          title: const Text('Marquer comme perdu'),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(labelText: 'Motif (obligatoire)'),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
            TextButton(onPressed: () => Navigator.pop(ctx, controller.text), child: const Text('Confirmer')),
          ],
        );
      },
    );
    if (note == null || note.trim().isEmpty) return;
    setState(() => _actioningId = p.id);
    try {
      await _repo.markProspectLost(p.id, note);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppColors.danger));
      }
    } finally {
      setState(() => _actioningId = null);
    }
  }

  Future<void> _convert(Prospect p) async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _ConvertSheet(prospect: p, repository: _repo),
    );
    if (result == null) return;
    _load();
    if (mounted) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Adhérent créé'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${p.firstName} ${p.lastName} est maintenant adhérent, paiement encaissé.'),
              const SizedBox(height: 12),
              const Text('Mot de passe temporaire à lui communiquer :', style: TextStyle(fontSize: 13)),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(color: AppColors.ink50, borderRadius: BorderRadius.circular(6)),
                child: Text(result['tempPassword'] ?? '', style: const TextStyle(fontFamily: 'monospace')),
              ),
            ],
          ),
          actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Fermer'))],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Prospects'), actions: const [LogoutButton()]),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _prospects.isEmpty
              ? const Center(child: Text('Aucun prospect', style: TextStyle(color: AppColors.ink400)))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _prospects.length,
                    itemBuilder: (context, i) {
                      final p = _prospects[i];
                      final isActioning = _actioningId == p.id;
                      final isDone = p.status == 'CONVERTI' || p.status == 'PERDU';
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text('${p.firstName} ${p.lastName}',
                                        style: const TextStyle(fontWeight: FontWeight.w600)),
                                  ),
                                  StatusBadgeText(status: p.status),
                                ],
                              ),
                              Text(p.phone, style: const TextStyle(color: AppColors.ink600, fontSize: 13)),
                              if (p.desiredCatalogueName != null)
                                Text('Souhaite : ${p.desiredCatalogueName}',
                                    style: const TextStyle(color: AppColors.ink400, fontSize: 12)),
                              if (!isDone) ...[
                                const SizedBox(height: 10),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: [
                                    if (p.status == 'NOUVEAU')
                                      OutlinedButton(
                                        onPressed: isActioning ? null : () => _markContacted(p),
                                        child: const Text('Contacté'),
                                      ),
                                    ElevatedButton(
                                      onPressed: isActioning ? null : () => _convert(p),
                                      child: const Text('Convertir'),
                                    ),
                                    TextButton(
                                      onPressed: isActioning ? null : () => _markLost(p),
                                      child: const Text('Perdu'),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}

class StatusBadgeText extends StatelessWidget {
  final String status;
  const StatusBadgeText({super.key, required this.status});

  static const _labels = {
    'NOUVEAU': 'Nouveau',
    'CONTACTE': 'Contacté',
    'CONVERTI': 'Converti',
    'PERDU': 'Perdu',
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: statusColor(status).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(
        _labels[status] ?? status,
        style: TextStyle(color: statusColor(status), fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _ConvertSheet extends StatefulWidget {
  final Prospect prospect;
  final GestionnaireRepository repository;
  const _ConvertSheet({required this.prospect, required this.repository});

  @override
  State<_ConvertSheet> createState() => _ConvertSheetState();
}

class _ConvertSheetState extends State<_ConvertSheet> {
  List<AbonnementCatalogue> _catalogue = [];
  AbonnementCatalogue? _selected;
  String _paymentMethod = 'ESPECES';
  final _phoneController = TextEditingController();
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _phoneController.text = widget.prospect.phone;
    _load();
  }

  Future<void> _load() async {
    final salleId = context.read<AuthProvider>().user?.salle?.id;
    if (salleId == null) return;
    final catalogue = await widget.repository.getCatalogue(salleId);
    setState(() {
      _catalogue = catalogue;
      if (widget.prospect.desiredCatalogueId != null) {
        for (final c in catalogue) {
          if (c.id == widget.prospect.desiredCatalogueId) {
            _selected = c;
            break;
          }
        }
      }
      _isLoading = false;
    });
  }

  Future<void> _submit() async {
    if (_selected == null) return;
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      final res = await widget.repository.convertProspect(
        prospectId: widget.prospect.id,
        abonnementCatalogueId: _selected!.id,
        paymentMethod: _paymentMethod,
        phoneNumber: _paymentMethod != 'ESPECES' ? _phoneController.text.trim() : null,
      );
      if (mounted) Navigator.of(context).pop(res);
    } catch (e) {
      setState(() => _error = 'Une erreur est survenue');
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
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: _isLoading
          ? const SizedBox(height: 120, child: Center(child: CircularProgressIndicator()))
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Convertir ${widget.prospect.firstName} ${widget.prospect.lastName}',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                const SizedBox(height: 16),
                const Text('Formule', style: TextStyle(fontWeight: FontWeight.w500)),
                ..._catalogue.map(
                  (c) => RadioListTile<AbonnementCatalogue>(
                    value: c,
                    groupValue: _selected,
                    onChanged: (v) => setState(() => _selected = v),
                    title: Text('${c.name} — ${c.price.toStringAsFixed(0)} ${c.currency}'),
                    dense: true,
                  ),
                ),
                const SizedBox(height: 8),
                const Text('Moyen de paiement', style: TextStyle(fontWeight: FontWeight.w500)),
                DropdownButtonFormField<String>(
                  initialValue: _paymentMethod,
                  items: _paymentMethods.entries
                      .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                      .toList(),
                  onChanged: (v) => setState(() => _paymentMethod = v!),
                ),
                if (_paymentMethod != 'ESPECES') ...[
                  const SizedBox(height: 12),
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
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _selected == null || _isSubmitting ? null : _submit,
                    child: _isSubmitting
                        ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Confirmer et encaisser'),
                  ),
                ),
              ],
            ),
    );
  }
}
