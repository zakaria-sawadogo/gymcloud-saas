import '../../core/network/api_client.dart';
import '../../core/models/salle_extras.dart';

/// §6.5, §6.14, §14.x — Commun aux apps Gestionnaire et Adhérent :
/// chaque compte ne voit jamais que ses propres notifications
/// (filtrage par userId déjà fait côté serveur).
class NotificationsRepository {
  final ApiClient _api;
  NotificationsRepository(this._api);

  Future<List<AppNotification>> getNotifications() async {
    final data = await _api.get<List<dynamic>>('/notifications/me');
    return data.map((e) => AppNotification.fromJson(e)).toList();
  }

  Future<int> getUnreadCount() async {
    final data = await _api.get<Map<String, dynamic>>('/notifications/me/unread-count');
    return data['count'] as int;
  }

  Future<void> markRead(String id) => _api.patch('/notifications/$id/read');

  Future<void> markAllRead() => _api.patch('/notifications/me/read-all');
}
