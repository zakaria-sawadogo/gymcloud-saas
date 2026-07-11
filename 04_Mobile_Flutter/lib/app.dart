import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/auth/auth_provider.dart';
import 'core/auth/auth_repository.dart';
import 'core/network/api_client.dart';
import 'core/network/token_storage.dart';
import 'core/theme/app_theme.dart';
import 'core/config/flavor_config.dart';
import 'features/shared/login_screen.dart';
import 'features/adherent/adherent_app.dart';
import 'features/coach/coach_app.dart';
import 'features/gestionnaire/gestionnaire_app.dart';
import 'features/proprietaire/proprietaire_app.dart';

/// Point de composition unique de l'app, quel que soit le flavor.
/// Chaque main_*.dart appelle `runApp(GymCloudApp())` après avoir
/// initialisé `FlavorConfig`.
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

/// Bascule entre l'écran de connexion et l'app du profil courant selon
/// l'état d'authentification.
class _RootRouter extends StatelessWidget {
  const _RootRouter();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (auth.isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (auth.status == AuthStatus.unauthenticated) {
      return const LoginScreen();
    }

    // Authentifié : route vers l'app du flavor compilé.
    switch (FlavorConfig.instance.flavor) {
      case AppFlavor.adherent:
        return const AdherentApp();
      case AppFlavor.coach:
        return const CoachApp();
      case AppFlavor.gestionnaire:
        return const GestionnaireApp();
      case AppFlavor.proprietaire:
        return const ProprietaireApp();
    }
  }
}
