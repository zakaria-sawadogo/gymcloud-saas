import '../../core/network/api_client.dart';
import '../../core/models/adherent.dart';

class GestionnaireRepository {
  final ApiClient _api;
  GestionnaireRepository(this._api);

  Future<Map<String, dynamic>> getDashboard(String salleId) =>
      _api.get<Map<String, dynamic>>('/reporting/salle/$salleId/dashboard');

  Future<Map<String, dynamic>> scanQr(String qrCodeToken, String salleId) => _api.post<Map<String, dynamic>>(
        '/access-control/scan',
        data: {'qrCodeToken': qrCodeToken, 'salleId': salleId},
      );

  Future<List<AdherentProfile>> getAdherents(String salleId, {String? status}) async {
    final data = await _api.get<List<dynamic>>(
      '/adherents/salle/$salleId',
      query: status != null ? {'status': status} : null,
    );
    return data.map((e) => AdherentProfile.fromJson(e)).toList();
  }
}
