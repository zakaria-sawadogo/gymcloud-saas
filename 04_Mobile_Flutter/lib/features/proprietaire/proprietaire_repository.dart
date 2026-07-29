import '../../core/network/api_client.dart';

class ProprietaireRepository {
  final ApiClient _api;
  ProprietaireRepository(this._api);

  Future<Map<String, dynamic>> getConsolidatedDashboard(String proprietaireId) =>
      _api.get<Map<String, dynamic>>('/reporting/proprietaire/$proprietaireId/dashboard');

  Future<Map<String, dynamic>> getSalleDashboard(String salleId) =>
      _api.get<Map<String, dynamic>>('/reporting/salle/$salleId/dashboard');

  /// §9.4, §9.8 — Ma souscription SaaS (plan actuel, échéance, tarif).
  Future<Map<String, dynamic>> getMySubscription() =>
      _api.get<Map<String, dynamic>>('/saas/invoices/me/subscription');

  /// §9.9 — Mes factures SaaS (historique complet).
  Future<List<Map<String, dynamic>>> getMyInvoices() async {
    final data = await _api.get<List<dynamic>>('/saas/invoices/me/invoices');
    return data.cast<Map<String, dynamic>>();
  }

  Future<List<int>> downloadInvoicePdf(String invoiceId) => _api.getBytes('/saas/invoices/$invoiceId/pdf');

  /// §9.3 — Add-ons disponibles (catalogue complet, avec prix).
  Future<List<Map<String, dynamic>>> getAvailableAddons() async {
    final data = await _api.get<List<dynamic>>('/saas/plans/addons');
    return data.cast<Map<String, dynamic>>();
  }

  /// §9.3 — Add-ons déjà actifs sur cette souscription précise.
  Future<List<Map<String, dynamic>>> getActiveAddons(String subscriptionId) async {
    final data = await _api.get<List<dynamic>>('/saas/plans/$subscriptionId/addons');
    return data.cast<Map<String, dynamic>>();
  }

  /// §9.3, §9.8 — Jamais automatique : le propriétaire active
  /// explicitement, facturé séparément au prorata (voir
  /// SaasBillingService.attachAddon côté backend).
  Future<void> attachAddon(String subscriptionId, String addonId, {int durationMonths = 12}) =>
      _api.post<dynamic>('/saas/plans/$subscriptionId/addons/$addonId', data: {'durationMonths': durationMonths});

  Future<void> detachAddon(String subscriptionId, String addonId) =>
      _api.delete<dynamic>('/saas/plans/$subscriptionId/addons/$addonId');

  // ── Personnel (§2.8, §4.2, §4.4) — le propriétaire crée, suspend,
  // réactive ou désactive gestionnaires et coachs sur ses propres
  // salles, au même titre que le SUPER_ADMIN. ────────────────────

  Future<List<Map<String, dynamic>>> getGestionnaires(String salleId) async {
    final data = await _api.get<List<dynamic>>('/gestionnaires/salle/$salleId');
    return data.cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> createGestionnaire({
    required String salleId,
    required String firstName,
    required String lastName,
    required String phone,
    String? email,
  }) =>
      _api.post<Map<String, dynamic>>('/gestionnaires', data: {
        'salleId': salleId,
        'firstName': firstName,
        'lastName': lastName,
        'phone': phone,
        if (email != null && email.isNotEmpty) 'email': email,
      });

  Future<List<Map<String, dynamic>>> getCoachs(String salleId) async {
    final data = await _api.get<List<dynamic>>('/coachs/salle/$salleId');
    return data.cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> createCoach({
    required String salleId,
    required String firstName,
    required String lastName,
    required String phone,
    String? email,
  }) =>
      _api.post<Map<String, dynamic>>('/coachs', data: {
        'salleId': salleId,
        'firstName': firstName,
        'lastName': lastName,
        'phone': phone,
        if (email != null && email.isNotEmpty) 'email': email,
      });

  Future<void> suspendStaff(String kind, String userId) =>
      _api.patch<dynamic>('/${kind}s/$userId/suspend');

  Future<void> reactivateStaff(String kind, String userId) =>
      _api.patch<dynamic>('/${kind}s/$userId/reactivate');

  Future<void> deactivateStaff(String kind, String userId) =>
      _api.patch<dynamic>('/${kind}s/$userId/deactivate');

  /// §4.2, §4.4, §4.5 — Suppression définitive, contrairement à
  /// "désactiver" qui conserve l'historique.
  Future<void> deleteStaff(String kind, String userId) =>
      _api.delete<dynamic>('/${kind}s/$userId');
}
