import '../../core/network/api_client.dart';
import '../../core/models/adherent.dart';

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
}
