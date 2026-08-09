import '../../core/network/api_client.dart';

class ProprietaireRepository {
  final ApiClient _api;
  ProprietaireRepository(this._api);

  Future<Map<String, dynamic>> getConsolidatedDashboard(String proprietaireId) =>
      _api.get<Map<String, dynamic>>('/reporting/proprietaire/$proprietaireId/dashboard');

  /// §14.x — Liste des salles du propriétaire connecté (même endpoint
  /// que le web, qui distingue déjà le rôle côté serveur) — nécessaire
  /// pour choisir sur quelle salle activer/gérer un add-on, désormais
  /// par salle et non plus par propriétaire.
  Future<List<Map<String, dynamic>>> getMySalles() async {
    final data = await _api.get<List<dynamic>>('/salles');
    return data.cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> getSalleDashboard(String salleId) =>
      _api.get<Map<String, dynamic>>('/reporting/salle/$salleId/dashboard');

  /// §9.4, §9.8 — Ma souscription SaaS (plan actuel, échéance, tarif).
  Future<Map<String, dynamic>> getMySubscription() =>
      _api.get<Map<String, dynamic>>('/saas/invoices/me/subscription');

  /// §14.x — Code de parrainage du propriétaire, généré à la volée
  /// côté backend s'il n'existe pas encore (voir
  /// UsersService.getOrCreateReferralCode) — même endpoint que la
  /// page web "Mon abonnement", jamais construit côté mobile jusqu'ici.
  Future<String> getMyReferralCode() async {
    final data = await _api.get<Map<String, dynamic>>('/proprietaires/me/referral');
    return data['referralCode'] as String;
  }

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

  /// §14.x — Add-ons déjà actifs sur cette salle précise (par salle,
  /// pas par propriétaire — deux salles peuvent différer).
  Future<List<Map<String, dynamic>>> getActiveAddons(String salleId) async {
    final data = await _api.get<List<dynamic>>('/saas/plans/salles/$salleId/addons');
    return data.cast<Map<String, dynamic>>();
  }

  /// §9.3, §9.8, §14.x — Jamais automatique : le propriétaire active
  /// explicitement, pour UNE salle précise, facturé séparément au
  /// prorata (voir SaasBillingService.requestAddonActivation côté
  /// backend).
  Future<void> attachAddon(String salleId, String addonId, {int durationMonths = 12}) =>
      _api.post<dynamic>('/saas/plans/salles/$salleId/addons/$addonId', data: {'durationMonths': durationMonths});

  Future<void> detachAddon(String salleId, String addonId) =>
      _api.delete<dynamic>('/saas/plans/salles/$salleId/addons/$addonId');

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

  // ── Boutique (§14.x) — supervision en lecture seule, la vente au
  // comptoir reste une tâche du gestionnaire. ────────────────────

  Future<List<Map<String, dynamic>>> getBoutiqueProducts(String salleId) async {
    final data = await _api.get<List<dynamic>>('/salles/$salleId/boutique/products');
    return data.cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> getBoutiqueSalesByProduct(String salleId, {String period = 'day'}) =>
      _api.get<Map<String, dynamic>>('/salles/$salleId/boutique/sales-by-product', query: {'period': period});

  // ── GymCloud Finances (§14.x) — accès complet, contrairement à la
  // boutique : c'est le seul moyen de saisir une dépense
  // confidentielle (salaires, loyer...), jamais visible pour un
  // gestionnaire. ─────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getFinancesExpenses(String salleId, {required int year, required int month}) async {
    final data = await _api.get<List<dynamic>>(
      '/salles/$salleId/finances/expenses',
      query: {'year': '$year', 'month': '$month'},
    );
    return data.cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> getFinancesNetResult(String salleId, {required int year, required int month}) =>
      _api.get<Map<String, dynamic>>(
        '/salles/$salleId/finances/net-result',
        query: {'year': '$year', 'month': '$month'},
      );

  Future<Map<String, dynamic>> createFinancesExpense({
    required String salleId,
    required String category,
    required num amount,
    String? description,
    required String date,
    bool isRecurring = false,
    bool recurringAmountVaries = true,
    bool isConfidential = false,
  }) =>
      _api.post<Map<String, dynamic>>(
        '/salles/$salleId/finances/expenses',
        data: {
          'category': category,
          'amount': amount,
          if (description != null) 'description': description,
          'date': date,
          'isRecurring': isRecurring,
          'recurringAmountVaries': recurringAmountVaries,
          'isConfidential': isConfidential,
        },
      );

  Future<Map<String, dynamic>> updateFinancesExpense({
    required String salleId,
    required String expenseId,
    String? category,
    num? amount,
    String? description,
    String? date,
    bool? isRecurring,
    bool? recurringAmountVaries,
    bool? isConfidential,
  }) =>
      _api.patch<Map<String, dynamic>>(
        '/salles/$salleId/finances/expenses/$expenseId',
        data: {
          if (category != null) 'category': category,
          if (amount != null) 'amount': amount,
          if (description != null) 'description': description,
          if (date != null) 'date': date,
          if (isRecurring != null) 'isRecurring': isRecurring,
          if (recurringAmountVaries != null) 'recurringAmountVaries': recurringAmountVaries,
          if (isConfidential != null) 'isConfidential': isConfidential,
        },
      );

  Future<void> deleteFinancesExpense(String salleId, String expenseId) =>
      _api.delete<dynamic>('/salles/$salleId/finances/expenses/$expenseId');

  Future<List<Map<String, dynamic>>> getFinancesBudgets(String salleId) async {
    final data = await _api.get<List<dynamic>>('/salles/$salleId/finances/budgets');
    return data.cast<Map<String, dynamic>>();
  }

  Future<void> setFinancesBudget(String salleId, String category, num monthlyLimit) =>
      _api.post<dynamic>('/salles/$salleId/finances/budgets', data: {'category': category, 'monthlyLimit': monthlyLimit});

  Future<void> deleteFinancesBudget(String salleId, String category) =>
      _api.delete<dynamic>('/salles/$salleId/finances/budgets?category=${Uri.encodeComponent(category)}');
}
