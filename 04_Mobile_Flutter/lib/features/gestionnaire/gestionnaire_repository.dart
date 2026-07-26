import '../../core/network/api_client.dart';
import '../../core/models/adherent.dart';
import '../../core/models/salle_extras.dart';

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

  /// §4.5 — Inscrire un nouvel adhérent avec encaissement immédiat.
  Future<Map<String, dynamic>> createAdherent({
    required String salleId,
    required String firstName,
    required String lastName,
    required String phone,
    String? email,
    required String abonnementCatalogueId,
    required String paymentMethod,
    String? paymentPhoneNumber,
  }) =>
      _api.post<Map<String, dynamic>>(
        '/adherents/with-payment',
        data: {
          'salleId': salleId,
          'firstName': firstName,
          'lastName': lastName,
          'phone': phone,
          if (email != null) 'email': email,
          'abonnementCatalogueId': abonnementCatalogueId,
          'payment': {'method': paymentMethod, 'phoneNumber': paymentPhoneNumber},
        },
      );

  Future<List<AbonnementCatalogue>> getCatalogue(String salleId) async {
    final data = await _api.get<List<dynamic>>('/salles/$salleId/abonnement-catalogue');
    return data.map((e) => AbonnementCatalogue.fromJson(e)).toList();
  }

  /// §5.6, §8.3 — Demandes de réabonnement en attente de validation.
  Future<List<PendingPayment>> getPendingPayments(String salleId) async {
    final data = await _api.get<List<dynamic>>('/adherents/salle/$salleId/pending-subscriptions');
    return data.map((e) => PendingPayment.fromJson(e)).toList();
  }

  Future<void> approvePendingPayment(String paymentId) =>
      _api.patch('/adherents/pending-subscriptions/$paymentId/approve');

  Future<void> rejectPendingPayment(String paymentId, {String? reason}) => _api.patch(
        '/adherents/pending-subscriptions/$paymentId/reject',
        data: {'reason': reason},
      );

  /// §3.2 — Suivi commercial des prospects captés par le site public.
  Future<List<Prospect>> getProspects(String salleId, {String? status}) async {
    final data = await _api.get<List<dynamic>>(
      '/prospects/salle/$salleId',
      query: status != null ? {'status': status} : null,
    );
    return data.map((e) => Prospect.fromJson(e)).toList();
  }

  Future<void> markProspectContacted(String prospectId) => _api.patch('/prospects/$prospectId/contacted');

  Future<void> markProspectLost(String prospectId, String note) =>
      _api.patch('/prospects/$prospectId/lost', data: {'note': note});

  /// §3.2, §5.6 — Convertir un prospect crée l'adhérent et déclenche son paiement.
  Future<Map<String, dynamic>> convertProspect({
    required String prospectId,
    required String abonnementCatalogueId,
    required String paymentMethod,
    String? phoneNumber,
  }) =>
      _api.patch<Map<String, dynamic>>(
        '/prospects/$prospectId/converted',
        data: {
          'abonnementCatalogueId': abonnementCatalogueId,
          'paymentMethod': paymentMethod,
          if (phoneNumber != null) 'phoneNumber': phoneNumber,
        },
      );
}
