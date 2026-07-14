/// URL de base de l'API — à surcharger via `--dart-define=API_URL=...`
/// pour les environnements de recette/production.
///
/// Note : ce fichier s'appelait historiquement flavor_config.dart et
/// portait aussi la notion de "flavor" (une app compilée par rôle).
/// L'application est désormais unique pour tous les profils (§2.3) —
/// le rôle réel de l'utilisateur, renvoyé par GET /auth/me, détermine
/// l'écran affiché après connexion (voir app.dart, _RootRouter) —
/// seule la configuration de l'API reste à porter ici.
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://localhost:3000/api/v1',
  );
}
