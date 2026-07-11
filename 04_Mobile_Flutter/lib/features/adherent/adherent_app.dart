import 'package:flutter/material.dart';
import 'screens/home_screen.dart';
import 'screens/qr_code_screen.dart';
import 'screens/bookings_screen.dart';
import 'screens/payments_screen.dart';

/// Shell de l'app Adhérent — 4 onglets, conformes à la vision produit
/// du cahier des charges (§1.3 : « Accéder rapidement à la salle via
/// QR Code », « Réserver facilement les séances », « Faciliter les
/// paiements »).
class AdherentApp extends StatefulWidget {
  const AdherentApp({super.key});

  @override
  State<AdherentApp> createState() => _AdherentAppState();
}

class _AdherentAppState extends State<AdherentApp> {
  int _currentIndex = 0;

  void _navigateToTab(int index) => setState(() => _currentIndex = index);

  @override
  Widget build(BuildContext context) {
    final screens = [
      HomeScreen(onNavigateToTab: _navigateToTab),
      const QrCodeScreen(),
      const BookingsScreen(),
      const PaymentsScreen(),
    ];

    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: screens),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: _navigateToTab,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: 'Accueil'),
          BottomNavigationBarItem(icon: Icon(Icons.qr_code_2_outlined), activeIcon: Icon(Icons.qr_code_2), label: 'Mon QR'),
          BottomNavigationBarItem(icon: Icon(Icons.event_outlined), activeIcon: Icon(Icons.event), label: 'Réservations'),
          BottomNavigationBarItem(icon: Icon(Icons.receipt_long_outlined), activeIcon: Icon(Icons.receipt_long), label: 'Paiements'),
        ],
      ),
    );
  }
}
