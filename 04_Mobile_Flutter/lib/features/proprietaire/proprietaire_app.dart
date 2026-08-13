import 'package:flutter/material.dart';
import 'screens/consolidated_dashboard_screen.dart';
import 'screens/my_subscription_screen.dart';

/// §14.x — Deux onglets en bas (Accueil, Abonnement) plutôt qu'un
/// point d'entrée unique — la construction de plusieurs écrans
/// propriétaire de premier niveau ce jour (Mon abonnement notamment,
/// devenu assez riche pour mériter son propre onglet permanent plutôt
/// qu'une icône enfouie dans la barre d'app) a rendu l'ancien choix
/// "pas besoin d'onglets" caduc. Profil et Déconnexion restent dans
/// le menu ⋮ partagé (LogoutButton) sur chaque onglet, pas dans la
/// barre du bas — ce ne sont pas des destinations de navigation au
/// même titre.
class ProprietaireApp extends StatefulWidget {
  const ProprietaireApp({super.key});

  @override
  State<ProprietaireApp> createState() => _ProprietaireAppState();
}

class _ProprietaireAppState extends State<ProprietaireApp> {
  int _currentIndex = 0;

  static const _screens = [
    ConsolidatedDashboardScreen(),
    MySubscriptionScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _screens),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), activeIcon: Icon(Icons.dashboard), label: 'Accueil'),
          BottomNavigationBarItem(icon: Icon(Icons.layers_outlined), activeIcon: Icon(Icons.layers), label: 'Abonnement'),
        ],
      ),
    );
  }
}
