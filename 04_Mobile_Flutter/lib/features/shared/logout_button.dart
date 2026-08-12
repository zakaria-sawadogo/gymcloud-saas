import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import 'profile_screen.dart';

/// §2.3, §14.x — Menu compte, présent sur l'écran principal de chaque
/// rôle mobile (adhérent, coach, gestionnaire, propriétaire). Nom de
/// classe conservé tel quel malgré l'ajout de "Profil" — évite de
/// devoir modifier les quatorze écrans qui l'utilisent déjà pour un
/// simple changement de nom.
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
    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert),
      tooltip: 'Mon compte',
      onSelected: (value) {
        if (value == 'profile') {
          Navigator.push(context, MaterialPageRoute(builder: (_) => const ProfileScreen()));
        } else if (value == 'logout') {
          _confirmAndLogout(context);
        }
      },
      itemBuilder: (context) => const [
        PopupMenuItem(value: 'profile', child: Row(children: [Icon(Icons.person_outline, size: 20), SizedBox(width: 10), Text('Profil')])),
        PopupMenuItem(value: 'logout', child: Row(children: [Icon(Icons.logout, size: 20), SizedBox(width: 10), Text('Se déconnecter')])),
      ],
    );
  }
}
