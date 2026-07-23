import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';

/// §2.3 — Bouton de déconnexion, présent sur l'écran principal de
/// chaque rôle mobile (adhérent, coach, gestionnaire, propriétaire).
/// Demande confirmation avant de couper la session, pour éviter une
/// déconnexion accidentelle en appuyant dessus par erreur.
class LogoutButton extends StatelessWidget {
  const LogoutButton({super.key});

  Future<void> _confirmAndLogout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Se déconnecter ?'),
        content: const Text('Vous devrez ressaisir votre mot de passe pour vous reconnecter.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Se déconnecter'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      await context.read<AuthProvider>().logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.logout),
      tooltip: 'Se déconnecter',
      onPressed: () => _confirmAndLogout(context),
    );
  }
}
