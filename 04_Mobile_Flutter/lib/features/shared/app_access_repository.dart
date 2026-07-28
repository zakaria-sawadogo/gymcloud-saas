import '../../core/network/api_client.dart';

/// §9.3, §14.x — Vérifie si la salle d'un gestionnaire, coach ou
/// adhérent a bien l'add-on "Application mobile" actif. Sans lui,
/// aucun accès à l'app mobile — uniquement le web. Vérifié à chaque
/// lancement de l'app, pas seulement à la connexion, pour qu'une
/// désactivation en cours de session coupe l'accès aussi.
class AppAccessRepository {
  final ApiClient _api;
  AppAccessRepository(this._api);

  Future<bool> hasAccess(String salleId) async {
    final data = await _api.get<Map<String, dynamic>>('/salles/$salleId/app-access');
    return data['hasAccess'] as bool;
  }
}
