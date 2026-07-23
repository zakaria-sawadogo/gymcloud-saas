import '../../core/network/api_client.dart';
import '../../core/models/adherent.dart';
import '../../core/models/salle_extras.dart';

/// Repository dédié à l'app Adhérent — toutes les requêtes API
/// consommées par les écrans de ce flavor.
class AdherentRepository {
  final ApiClient _api;
  AdherentRepository(this._api);

  Future<AdherentProfile> getProfile(String adherentId) async {
    final data = await _api.get<Map<String, dynamic>>('/adherents/$adherentId');
    return AdherentProfile.fromJson(data);
  }

  Future<List<AdherentAbonnement>> getHistory(String adherentId) async {
    final data = await _api.get<List<dynamic>>('/adherents/$adherentId/history');
    return data.map((e) => AdherentAbonnement.fromJson(e)).toList();
  }

  Future<List<Booking>> getBookings(String adherentId) async {
    final data = await _api.get<List<dynamic>>('/bookings/adherent/$adherentId');
    return data.map((e) => Booking.fromJson(e)).toList();
  }

  Future<List<Payment>> getPayments(String adherentId) async {
    final data = await _api.get<List<dynamic>>('/payments/adherent/$adherentId');
    return data.map((e) => Payment.fromJson(e)).toList();
  }

  Future<Map<String, dynamic>> cancelBooking(String bookingId) =>
      _api.patch<Map<String, dynamic>>('/bookings/$bookingId/cancel');

  /// §6.14 — Auto-pointage : l'adhérent scanne lui-même le QR fixe
  /// affiché à l'entrée de la salle, avec son propre téléphone.
  Future<Map<String, dynamic>> selfCheckin(String checkinQrToken) => _api.post<Map<String, dynamic>>(
        '/access-control/self-checkin',
        data: {'checkinQrToken': checkinQrToken},
      );

  /// §4.5 — Carte de membre (PDF), avec QR et informations d'abonnement.
  Future<List<int>> downloadCard(String adherentId) => _api.getBytes('/adherents/$adherentId/card');

  /// §5 — Formules d'abonnement disponibles pour se réabonner.
  Future<List<AbonnementCatalogue>> getCatalogue(String salleId) async {
    final data = await _api.get<List<dynamic>>('/salles/$salleId/abonnement-catalogue');
    return data.map((e) => AbonnementCatalogue.fromJson(e)).toList();
  }

  /// §5.6, §8.3 — Demande de réabonnement + paiement associé, en
  /// attente de validation du gestionnaire (ne crée pas encore
  /// l'abonnement).
  Future<Map<String, dynamic>> requestSubscription({
    required String abonnementCatalogueId,
    required String paymentMethod,
    String? phoneNumber,
  }) =>
      _api.post<Map<String, dynamic>>(
        '/adherents/me/request-subscription',
        data: {
          'abonnementCatalogueId': abonnementCatalogueId,
          'paymentMethod': paymentMethod,
          if (phoneNumber != null) 'phoneNumber': phoneNumber,
        },
      );

  /// §7.2 — Planning des cours collectifs à venir, avec places restantes.
  Future<List<CoursCollectif>> getCoursCollectifs(String salleId, {DateTime? from, DateTime? to}) async {
    final data = await _api.get<List<dynamic>>(
      '/salles/$salleId/cours-collectifs',
      query: {
        if (from != null) 'from': from.toIso8601String(),
        if (to != null) 'to': to.toIso8601String(),
      },
    );
    return data.map((e) => CoursCollectif.fromJson(e)).toList();
  }

  /// §7.4 — Réserver un cours collectif ; bascule en liste d'attente si complet.
  Future<Map<String, dynamic>> bookCoursCollectif(String coursId, String adherentId) =>
      _api.post<Map<String, dynamic>>('/bookings/cours-collectifs/$coursId', data: {'adherentId': adherentId});

  /// §7.6 — Coachs disponibles pour une séance individuelle/personnalisée.
  Future<List<CoachForBooking>> getCoachsForBooking(String salleId) async {
    final data = await _api.get<List<dynamic>>('/coachs/salle/$salleId/for-booking');
    return data.map((e) => CoachForBooking.fromJson(e)).toList();
  }

  /// §7.6, §7.7 — Demande de séance individuelle (cours personnalisé) avec un coach.
  Future<Map<String, dynamic>> bookSeanceIndividuelle({
    required String salleId,
    required String adherentId,
    required String coachId,
    required DateTime startAt,
    required DateTime endAt,
  }) =>
      _api.post<Map<String, dynamic>>(
        '/bookings/salle/$salleId/seance-individuelle',
        data: {
          'adherentId': adherentId,
          'coachId': coachId,
          'startAt': startAt.toIso8601String(),
          'endAt': endAt.toIso8601String(),
        },
      );

  /// §7.7 — Paiement d'une séance individuelle déjà validée par le coach.
  Future<Map<String, dynamic>> paySeance({
    required String bookingId,
    required String billingMode,
    required String paymentMethod,
    String? paymentPhoneNumber,
  }) =>
      _api.post<Map<String, dynamic>>(
        '/bookings/$bookingId/pay-seance',
        data: {
          'billingMode': billingMode,
          'paymentMethod': paymentMethod,
          if (paymentPhoneNumber != null) 'paymentPhoneNumber': paymentPhoneNumber,
        },
      );
}
