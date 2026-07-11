/// Identifie quel profil compile l'application courante.
///
/// Chaque flavor correspond à une app distincte publiée séparément sur
/// les stores (§2.3 du cahier des charges — un utilisateur n'a besoin
/// que des écrans de son propre rôle). Défini au lancement via
/// `flutter run --dart-define=FLAVOR=adherent` ou par les fichiers
/// `main_*.dart` dédiés.
enum AppFlavor { adherent, coach, gestionnaire, proprietaire }

class FlavorConfig {
  final AppFlavor flavor;
  final String appName;

  static FlavorConfig? _instance;

  FlavorConfig._({required this.flavor, required this.appName});

  factory FlavorConfig({required AppFlavor flavor, required String appName}) {
    _instance ??= FlavorConfig._(flavor: flavor, appName: appName);
    return _instance!;
  }

  static FlavorConfig get instance {
    if (_instance == null) {
      throw StateError(
        'FlavorConfig non initialisé — appelez FlavorConfig(flavor: ..., appName: ...) dans main_*.dart avant runApp().',
      );
    }
    return _instance!;
  }

  static bool get isAdherent => instance.flavor == AppFlavor.adherent;
  static bool get isCoach => instance.flavor == AppFlavor.coach;
  static bool get isGestionnaire => instance.flavor == AppFlavor.gestionnaire;
  static bool get isProprietaire => instance.flavor == AppFlavor.proprietaire;
}

/// URL de base de l'API — à surcharger via `--dart-define=API_URL=...`
/// pour les environnements de recette/production.
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://localhost:3000/api/v1',
  );
}
