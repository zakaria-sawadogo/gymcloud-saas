import 'package:flutter/material.dart';
import 'screens/dashboard_screen.dart';
import 'screens/scanner_screen.dart';
import 'screens/adherents_list_screen.dart';
import 'screens/pending_payments_screen.dart';
import 'screens/prospects_screen.dart';

class GestionnaireApp extends StatefulWidget {
  const GestionnaireApp({super.key});

  @override
  State<GestionnaireApp> createState() => _GestionnaireAppState();
}

class _GestionnaireAppState extends State<GestionnaireApp> {
  int _currentIndex = 0;

  final _screens = const [
    DashboardScreen(),
    ScannerScreen(),
    AdherentsListScreen(),
    PendingPaymentsScreen(),
    ProspectsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _screens),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), activeIcon: Icon(Icons.dashboard), label: 'Tableau de bord'),
          BottomNavigationBarItem(icon: Icon(Icons.qr_code_scanner_outlined), activeIcon: Icon(Icons.qr_code_scanner), label: 'Scanner'),
          BottomNavigationBarItem(icon: Icon(Icons.people_outline), activeIcon: Icon(Icons.people), label: 'Adhérents'),
          BottomNavigationBarItem(icon: Icon(Icons.payments_outlined), activeIcon: Icon(Icons.payments), label: 'Paiements'),
          BottomNavigationBarItem(icon: Icon(Icons.groups_outlined), activeIcon: Icon(Icons.groups), label: 'Prospects'),
        ],
      ),
    );
  }
}
