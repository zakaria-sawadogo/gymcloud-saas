import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/models/salle_extras.dart';
import 'notifications_repository.dart';

/// §6.5, §6.14, §14.x — Liste des notifications de l'utilisateur
/// connecté (Gestionnaire ou Adhérent) : filtrage par compte déjà
/// fait côté serveur, cet écran est identique pour les deux rôles.
class NotificationsListScreen extends StatefulWidget {
  const NotificationsListScreen({super.key});

  @override
  State<NotificationsListScreen> createState() => _NotificationsListScreenState();
}

class _NotificationsListScreenState extends State<NotificationsListScreen> {
  late final NotificationsRepository _repo;
  List<AppNotification> _notifications = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _repo = NotificationsRepository(context.read());
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final notifications = await _repo.getNotifications();
      setState(() => _notifications = notifications);
    } catch (_) {
      // liste vide en cas d'erreur — l'utilisateur peut tirer pour rafraîchir
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _markAllRead() async {
    try {
      await _repo.markAllRead();
      _load();
    } catch (_) {
      // pas bloquant — réessayable au prochain appui
    }
  }

  Future<void> _onTapNotification(AppNotification n) async {
    if (n.readAt == null) {
      try {
        await _repo.markRead(n.id);
        _load();
      } catch (_) {
        // pas bloquant
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasUnread = _notifications.any((n) => n.readAt == null);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (hasUnread)
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Tout marquer lu', style: TextStyle(color: AppColors.primary)),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _notifications.isEmpty
              ? const Center(child: Text('Aucune notification', style: TextStyle(color: AppColors.ink400)))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    itemCount: _notifications.length,
                    itemBuilder: (context, i) {
                      final n = _notifications[i];
                      final isUnread = n.readAt == null;
                      return InkWell(
                        onTap: () => _onTapNotification(n),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            color: isUnread ? AppColors.primary.withValues(alpha: 0.05) : null,
                            border: const Border(bottom: BorderSide(color: AppColors.ink50)),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (isUnread)
                                Container(
                                  margin: const EdgeInsets.only(top: 6, right: 10),
                                  width: 8,
                                  height: 8,
                                  decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                                )
                              else
                                const SizedBox(width: 18),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      n.title,
                                      style: TextStyle(
                                        fontWeight: isUnread ? FontWeight.w700 : FontWeight.w500,
                                        fontSize: 14,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(n.body, style: const TextStyle(color: AppColors.ink600, fontSize: 13)),
                                    const SizedBox(height: 4),
                                    Text(
                                      DateFormat('dd/MM/yyyy à HH:mm', 'fr_FR').format(n.createdAt),
                                      style: const TextStyle(color: AppColors.ink400, fontSize: 11),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
