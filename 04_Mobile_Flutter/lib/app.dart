import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/auth/auth_provider.dart';
import 'core/auth/auth_repository.dart';
import 'core/network/api_client.dart';
import 'core/network/token_storage.dart';
import 'core/theme/app_theme.dart';
import 'features/shared/login_screen.dart';
import 'features/adherent/adherent_app.dart';
import 'features/coach/coach_app.dart';
import 'features/gestionnaire/gestionnaire_app.dart';
import 'features/proprietaire/proprietaire_app.dart';

/// Point de composition unique de l'app — une seule application pour
/// tous les profils (§2.3) : après connexion, l'écran affiché dépend
/// du `roleCode` réel renvoyé par GET /auth/me, exactement comme le
/// fait le frontend web (DashboardHomePage). Un seul binaire à
/// installer, quel que soit le rôle de l'utilisateur.
class GymCloudApp extends StatelessWidget {
  const GymCloudApp({super.key});

  @override
  Widget build(BuildContext context) {
    final tokenStorage = TokenStorage();
    final apiClient = ApiClient(tokenStorage);
    final authRepository = AuthRepository(apiClient, tokenStorage);

    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: apiClient),
        ChangeNotifierProvider<AuthProvider>(
          create: (_) {
            final provider = AuthProvider(authRepository);
            apiClient.onSessionExpired = provider.forceLogout;
            return provider;
          },
        ),
      ],
      child: MaterialApp(
        title: 'GymCloud',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        home: const _RootRouter(),
      ),
    );
  }
}

/// Bascule entre l'écran de connexion et l'app correspondant au rôle
/// réel de l'utilisateur connecté (§2.3, §2.8) — SUPER_ADMIN et le
/// personnel interne GymCloud n'ont pas d'écran mobile dédié (gérés
/// depuis le web), comme sur le frontend web.
class _RootRouter extends StatelessWidget {
  const _RootRouter();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (auth.isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (auth.status == AuthStatus.unauthenticated || auth.user == null) {
      return const LoginScreen();
    }

    switch (auth.user!.roleCode) {
      case 'ADHERENT':
        return const AdherentApp();
      case 'COACH':
        return const CoachApp();
      case 'GESTIONNAIRE':
        return const GestionnaireApp();
      case 'PROPRIETAIRE':
        return const ProprietaireApp();
      default:
        return _UnsupportedRoleScreen(roleCode: auth.user!.roleCode);
    }
  }
}

/// SUPER_ADMIN et personnel interne GymCloud : pas d'écran mobile
/// dédié à ce jour (§2.3) — gérés depuis l'application web.
class _UnsupportedRoleScreen extends StatelessWidget {
  const _UnsupportedRoleScreen({required this.roleCode});

  final String roleCode;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.desktop_windows_outlined, size: 40, color: AppColors.ink400),
                const SizedBox(height: 16),
                const Text(
                  'Ce profil n\'est pas disponible sur l\'application mobile',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Text(
                  'Connectez-vous depuis l\'application web GymCloud pour accéder à votre espace ($roleCode).',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13, color: AppColors.ink400),
                ),
                const SizedBox(height: 24),
                TextButton(
                  onPressed: () => context.read<AuthProvider>().logout(),
                  child: const Text('Se déconnecter'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
