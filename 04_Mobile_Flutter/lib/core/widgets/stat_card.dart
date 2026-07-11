import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Carte de statistique réutilisée par les apps Gestionnaire et
/// Propriétaire — évite de dupliquer ce widget dans chaque feature.
class StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final bool isAccent;

  const StatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.isAccent = false,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: isAccent ? AppColors.accent : AppColors.primary),
            const Spacer(),
            Text(
              value,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(color: AppColors.ink400, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
