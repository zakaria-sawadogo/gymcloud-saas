import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../proprietaire_repository.dart';

/// §2.8, §4.2, §4.4 — Équivalent mobile de la section "Équipe" de la
/// page web salle/[id] : le propriétaire crée, suspend, réactive ou
/// désactive gestionnaires et coachs sur ses propres salles.
class TeamManagementScreen extends StatefulWidget {
  final String salleId;
  final String salleName;
  const TeamManagementScreen({super.key, required this.salleId, required this.salleName});

  @override
  State<TeamManagementScreen> createState() => _TeamManagementScreenState();
}

class _TeamManagementScreenState extends State<TeamManagementScreen> {
  late final ProprietaireRepository _repo;
  List<Map<String, dynamic>> _gestionnaires = [];
  List<Map<String, dynamic>> _coachs = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _repo = ProprietaireRepository(context.read());
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final gestionnaires = await _repo.getGestionnaires(widget.salleId);
      final coachs = await _repo.getCoachs(widget.salleId);
      setState(() {
        _gestionnaires = gestionnaires;
        _coachs = coachs;
      });
    } catch (_) {
      // listes vides en cas d'erreur — l'utilisateur peut tirer pour rafraîchir
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _openCreate(String kind) async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _CreateStaffSheet(repo: _repo, salleId: widget.salleId, kind: kind),
    );
    if (created == true) _load();
  }

  Future<void> _handleAction(String kind, Map<String, dynamic> staff, String action) async {
    final userId = staff['user']['id'] as String;
    try {
      switch (action) {
        case 'suspend':
          await _repo.suspendStaff(kind, userId);
          break;
        case 'reactivate':
          await _repo.reactivateStaff(kind, userId);
          break;
        case 'deactivate':
          final confirmed = await showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('Désactiver ce compte ?'),
              content: const Text('Le compte est désactivé mais son historique reste conservé.'),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
                TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Désactiver')),
              ],
            ),
          );
          if (confirmed != true) return;
          await _repo.deactivateStaff(kind, userId);
          break;
        case 'delete':
          final name = '${staff['user']['firstName']} ${staff['user']['lastName']}';
          final confirmed = await showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('Supprimer définitivement ?'),
              content: Text(
                '$name sera définitivement supprimé — contrairement à "désactiver", son historique ne sera pas conservé. Action irréversible.',
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
                TextButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Supprimer', style: TextStyle(color: AppColors.danger)),
                ),
              ],
            ),
          );
          if (confirmed != true) return;
          await _repo.deleteStaff(kind, userId);
          break;
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppColors.danger));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Équipe — ${widget.salleName}')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _TeamSection(
                    title: 'Gestionnaires',
                    staffList: _gestionnaires,
                    onAdd: () => _openCreate('gestionnaire'),
                    onAction: (staff, action) => _handleAction('gestionnaire', staff, action),
                  ),
                  const SizedBox(height: 24),
                  _TeamSection(
                    title: 'Coachs',
                    staffList: _coachs,
                    onAdd: () => _openCreate('coach'),
                    onAction: (staff, action) => _handleAction('coach', staff, action),
                  ),
                ],
              ),
            ),
    );
  }
}

class _TeamSection extends StatelessWidget {
  final String title;
  final List<Map<String, dynamic>> staffList;
  final VoidCallback onAdd;
  final void Function(Map<String, dynamic> staff, String action) onAction;

  const _TeamSection({
    required this.title,
    required this.staffList,
    required this.onAdd,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            TextButton.icon(
              onPressed: onAdd,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Nouveau'),
            ),
          ],
        ),
        if (staffList.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text('Aucun pour l\'instant', style: TextStyle(color: AppColors.ink400)),
          )
        else
          ...staffList.map((staff) {
            final user = staff['user'] as Map<String, dynamic>;
            final status = user['status'] as String;
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text('${user['firstName']} ${user['lastName']}'),
                subtitle: Text(user['phone'] ?? ''),
                trailing: PopupMenuButton<String>(
                  onSelected: (action) => onAction(staff, action),
                  itemBuilder: (context) => [
                    if (status == 'SUSPENDU')
                      const PopupMenuItem(value: 'reactivate', child: Text('Réactiver'))
                    else
                      const PopupMenuItem(value: 'suspend', child: Text('Suspendre')),
                    const PopupMenuItem(value: 'deactivate', child: Text('Désactiver')),
                    const PopupMenuItem(
                      value: 'delete',
                      child: Text('Supprimer définitivement', style: TextStyle(color: AppColors.danger)),
                    ),
                  ],
                ),
              ),
            );
          }),
      ],
    );
  }
}

class _CreateStaffSheet extends StatefulWidget {
  final ProprietaireRepository repo;
  final String salleId;
  final String kind; // 'gestionnaire' ou 'coach'
  const _CreateStaffSheet({required this.repo, required this.salleId, required this.kind});

  @override
  State<_CreateStaffSheet> createState() => _CreateStaffSheetState();
}

class _CreateStaffSheetState extends State<_CreateStaffSheet> {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  bool _isSubmitting = false;
  String? _error;
  Map<String, dynamic>? _result;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      final result = widget.kind == 'gestionnaire'
          ? await widget.repo.createGestionnaire(
              salleId: widget.salleId,
              firstName: _firstNameController.text.trim(),
              lastName: _lastNameController.text.trim(),
              phone: _phoneController.text.trim(),
              email: _emailController.text.trim(),
            )
          : await widget.repo.createCoach(
              salleId: widget.salleId,
              firstName: _firstNameController.text.trim(),
              lastName: _lastNameController.text.trim(),
              phone: _phoneController.text.trim(),
              email: _emailController.text.trim(),
            );
      setState(() => _result = result);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final label = widget.kind == 'gestionnaire' ? 'gestionnaire' : 'coach';
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: _result != null
          ? Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.check_circle, color: AppColors.primary, size: 40),
                const SizedBox(height: 12),
                Text('Compte $label créé.', textAlign: TextAlign.center),
                const SizedBox(height: 12),
                const Text('Mot de passe temporaire à communiquer :', style: TextStyle(fontSize: 13)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(color: AppColors.ink50, borderRadius: BorderRadius.circular(6)),
                  child: Text(
                    _result!['tempPassword'] ?? '',
                    style: const TextStyle(fontFamily: 'monospace'),
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  child: const Text('Terminé'),
                ),
              ],
            )
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Nouveau $label', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                const SizedBox(height: 16),
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
                const SizedBox(height: 12),
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'E-mail (optionnel)'),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: AppColors.danger)),
                ],
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _isSubmitting ? null : _submit,
                  child: _isSubmitting
                      ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Créer'),
                ),
              ],
            ),
    );
  }
}
