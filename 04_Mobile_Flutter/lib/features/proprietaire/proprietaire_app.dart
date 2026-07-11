import 'package:flutter/material.dart';
import 'screens/consolidated_dashboard_screen.dart';

/// Pas de bottom navigation ici, volontairement : le propriétaire
/// consulte une vue consolidée puis navigue en profondeur (drill-down)
/// vers une salle — un empilement de routes classique suffit, pas
/// besoin d'un shell à onglets pour un seul point d'entrée.
class ProprietaireApp extends StatelessWidget {
  const ProprietaireApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const ConsolidatedDashboardScreen();
  }
}
