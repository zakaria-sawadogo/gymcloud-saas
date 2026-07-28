import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import 'notifications_repository.dart';
import 'notifications_list_screen.dart';

/// §6.5, §6.14, §14.x — Icône cloche avec badge de notifications non
/// lues, à placer dans l'AppBar. Interrogation périodique simple
/// plutôt qu'un flux temps réel — largement suffisant pour ce volume
/// d'événements, sans infrastructure supplémentaire (websocket...).
class NotificationBell extends StatefulWidget {
  const NotificationBell({super.key});

  @override
  State<NotificationBell> createState() => _NotificationBellState();
}

class _NotificationBellState extends State<NotificationBell> {
  late final NotificationsRepository _repo;
  int _unreadCount = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _repo = NotificationsRepository(context.read());
    _refresh();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _refresh());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final count = await _repo.getUnreadCount();
      if (mounted) setState(() => _unreadCount = count);
    } catch (_) {
      // silencieux — un compteur qui ne se met pas à jour une fois n'est pas bloquant
    }
  }

  Future<void> _open() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const NotificationsListScreen()),
    );
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        IconButton(
          icon: const Icon(Icons.notifications_outlined),
          onPressed: _open,
        ),
        if (_unreadCount > 0)
          Positioned(
            right: 6,
            top: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
              decoration: const BoxDecoration(color: AppColors.danger, shape: BoxShape.circle),
              child: Text(
                _unreadCount > 9 ? '9+' : '$_unreadCount',
                style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
                textAlign: TextAlign.center,
              ),
            ),
          ),
      ],
    );
  }
}
