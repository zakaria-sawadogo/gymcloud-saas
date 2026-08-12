import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/auth/auth_repository.dart';
import '../../core/models/user.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/status_badge.dart';

/// §4.9, §14.x — Corrige un vrai trou trouvé à l'audit : aucun écran
/// de profil/paramètres n'existait, pour aucun rôle — personne ne
/// pouvait changer son mot de passe ni modifier ses informations
/// depuis le mobile. Écran commun à tous les rôles (adhérent, coach,
/// gestionnaire, propriétaire) plutôt que dupliqué quatre fois — le
/// contenu (nom, e-mail, mot de passe) est strictement identique
/// quel que soit le profil.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final AuthRepository _repo;

  @override
  void initState() {
    super.initState();
    _repo = context.read<AuthRepository>();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    if (user == null) return const SizedBox.shrink();

    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: AppColors.primaryLight,
                  child: Text(
                    '${user.firstName.isNotEmpty ? user.firstName[0] : ''}${user.lastName.isNotEmpty ? user.lastName[0] : ''}',
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.primary),
                  ),
                ),
                const SizedBox(height: 12),
                Text(user.fullName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                StatusBadge(status: user.roleCode),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _SectionCard(
            title: 'Informations',
            child: _EditProfileForm(repo: _repo, user: user),
          ),
          const SizedBox(height: 16),
          _SectionCard(
            title: 'Mot de passe',
            child: _ChangePasswordForm(repo: _repo),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final Widget child;
  const _SectionCard({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _EditProfileForm extends StatefulWidget {
  final AuthRepository repo;
  final CurrentUser user;
  const _EditProfileForm({required this.repo, required this.user});

  @override
  State<_EditProfileForm> createState() => _EditProfileFormState();
}

class _EditProfileFormState extends State<_EditProfileForm> {
  late final TextEditingController _firstName;
  late final TextEditingController _lastName;
  late final TextEditingController _email;
  bool _isSubmitting = false;
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    _firstName = TextEditingController(text: widget.user.firstName);
    _lastName = TextEditingController(text: widget.user.lastName);
    _email = TextEditingController(text: widget.user.email ?? '');
  }

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
      _success = null;
    });
    try {
      final updated = await widget.repo.updateProfile(
        firstName: _firstName.text.trim(),
        lastName: _lastName.text.trim(),
        email: _email.text.trim().isEmpty ? null : _email.text.trim(),
      );
      if (mounted) {
        context.read<AuthProvider>().updateUser(updated);
        setState(() => _success = 'Profil mis à jour');
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TextField(controller: _firstName, decoration: const InputDecoration(labelText: 'Prénom')),
        const SizedBox(height: 12),
        TextField(controller: _lastName, decoration: const InputDecoration(labelText: 'Nom')),
        const SizedBox(height: 12),
        TextField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(labelText: 'E-mail (optionnel)'),
        ),
        const SizedBox(height: 4),
        Align(
          alignment: Alignment.centerLeft,
          child: Padding(
            padding: const EdgeInsets.only(top: 4, bottom: 8),
            child: Text('Téléphone : ${widget.user.phone} (non modifiable)', style: const TextStyle(fontSize: 12, color: AppColors.ink400)),
          ),
        ),
        if (_error != null) Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
        if (_success != null) Text(_success!, style: const TextStyle(color: AppColors.primary, fontSize: 13)),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: _isSubmitting ? null : _submit,
            child: _isSubmitting
                ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Enregistrer'),
          ),
        ),
      ],
    );
  }
}

class _ChangePasswordForm extends StatefulWidget {
  final AuthRepository repo;
  const _ChangePasswordForm({required this.repo});

  @override
  State<_ChangePasswordForm> createState() => _ChangePasswordFormState();
}

class _ChangePasswordFormState extends State<_ChangePasswordForm> {
  final _current = TextEditingController();
  final _newPassword = TextEditingController();
  bool _isSubmitting = false;
  String? _error;
  String? _success;

  @override
  void dispose() {
    _current.dispose();
    _newPassword.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
      _success = null;
    });
    try {
      await widget.repo.changePassword(currentPassword: _current.text, newPassword: _newPassword.text);
      _current.clear();
      _newPassword.clear();
      setState(() => _success = 'Mot de passe modifié');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TextField(
          controller: _current,
          obscureText: true,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(labelText: 'Mot de passe actuel'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _newPassword,
          obscureText: true,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(
            labelText: 'Nouveau mot de passe',
            helperText: 'Au moins 10 caractères, avec majuscule, minuscule et chiffre',
            helperMaxLines: 2,
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
        ],
        if (_success != null) ...[
          const SizedBox(height: 8),
          Text(_success!, style: const TextStyle(color: AppColors.primary, fontSize: 13)),
        ],
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton(
            onPressed: _isSubmitting || _current.text.isEmpty || _newPassword.text.isEmpty ? null : _submit,
            child: _isSubmitting
                ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Changer le mot de passe'),
          ),
        ),
      ],
    );
  }
}
