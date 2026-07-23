import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

const Map<String, String> _statusLabels = {
  'ACTIF': 'Actif',
  'EN_GRACE': 'En grâce',
  'SUSPENDU': 'Suspendu',
  'EXPIRE': 'Expiré',
  'VALIDE': 'Validé',
  'EN_ATTENTE': 'En attente',
  'EN_ATTENTE_PAIEMENT': 'À payer',
  'REJETE': 'Rejeté',
  'CONFIRMEE': 'Confirmée',
  'ANNULEE': 'Annulée',
  'TERMINEE': 'Terminée',
};

/// Équivalent Flutter de StatusBadge.tsx côté web — mêmes couleurs,
/// mêmes libellés français.
class StatusBadge extends StatelessWidget {
  final String status;
  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final color = statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(99)),
      child: Text(
        _statusLabels[status] ?? status,
        style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}
