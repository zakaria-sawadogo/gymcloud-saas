import '../../core/network/api_client.dart';

class ProprietaireRepository {
  final ApiClient _api;
  ProprietaireRepository(this._api);

  Future<Map<String, dynamic>> getConsolidatedDashboard(String proprietaireId) =>
      _api.get<Map<String, dynamic>>('/reporting/proprietaire/$proprietaireId/dashboard');

  Future<Map<String, dynamic>> getSalleDashboard(String salleId) =>
      _api.get<Map<String, dynamic>>('/reporting/salle/$salleId/dashboard');
}
