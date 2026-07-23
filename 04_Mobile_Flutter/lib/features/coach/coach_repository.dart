import '../../core/network/api_client.dart';
import '../../core/models/adherent.dart';
import '../../core/models/coach.dart';

class CoachRepository {
  final ApiClient _api;
  CoachRepository(this._api);

  Future<List<Booking>> getBookings(String coachId) async {
    final data = await _api.get<List<dynamic>>('/bookings/coach/$coachId');
    return data.map((e) => Booking.fromJson(e)).toList();
  }

  Future<List<CoachAvailability>> getAvailability(String coachId) async {
    final data = await _api.get<List<dynamic>>('/coachs/$coachId/availability');
    return data.map((e) => CoachAvailability.fromJson(e)).toList();
  }

  Future<void> addAvailability(String coachId, int dayOfWeek, String startTime, String endTime) {
    return _api.post(
      '/coachs/$coachId/availability',
      data: {'dayOfWeek': dayOfWeek, 'startTime': startTime, 'endTime': endTime},
    );
  }

  Future<void> markAttendance(String bookingId) => _api.patch('/bookings/$bookingId/attendance');
  Future<void> markAbsence(String bookingId) => _api.patch('/bookings/$bookingId/absence');

  /// §7.7 — Valider ou refuser une séance individuelle demandée par un adhérent.
  Future<void> approveSeance(String bookingId) => _api.patch('/bookings/$bookingId/approve-seance');
  Future<void> rejectSeance(String bookingId) => _api.patch('/bookings/$bookingId/reject-seance');
}
