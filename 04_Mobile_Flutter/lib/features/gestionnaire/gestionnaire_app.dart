import 'package:flutter/material.dart';
import 'screens/dashboard_screen.dart';
import 'screens/scanner_screen.dart';
import 'screens/adherents_list_screen.dart';
import 'screens/pending_payments_screen.dart';
import 'screens/prospects_screen.dart';
import 'screens/boutique_screen.dart';
import 'screens/finances_screen.dart';

class GestionnaireApp extends StatefulWidget {
  const GestionnaireApp({super.key});

  @override
  State<GestionnaireApp> createState() => _GestionnaireAppState();
}

class _GestionnaireAppState extends State<GestionnaireApp> {
  int _currentIndex = 0;
  final _dashboardKey = GlobalKey<DashboardScreenState>();
  // §14.x — reconstruit entièrement l'écran Paiements à chaque fois
  // qu'on le sélectionne (compteur qui change à chaque tap), plutôt
  // que de dépendre d'un GlobalKey.currentState?.refresh() qui s'est
  // avéré ne pas suffire en pratique pour ce cas précis — changer la
  // Key d'un widget force Flutter à le détruire et le reconstruire
  // intégralement (nouvel appel à initState), une garantie plus
  // robuste qu'une méthode appelée sur un état potentiellement pas
  // encore prêt au moment exact du tap.
  int _pendingPaymentsRebuildCount = 0;

  List<Widget> get _screens => [
        DashboardScreen(key: _dashboardKey),
        const ScannerScreen(),
        const AdherentsListScreen(),
        PendingPaymentsScreen(key: ValueKey('pending-payments-$_pendingPaymentsRebuildCount')),
        const ProspectsScreen(),
        const BoutiqueScreen(),
        const FinancesScreen(),
      ];

  void _onTap(int index) {
    // §14.x — incrémenté AVANT setState pour que la nouvelle Key soit
    // déjà en place au moment où _screens est reconstruit par le
    // setState ci-dessous — sinon l'ancien écran (avec son ancien
    // état encore chargé) resterait affiché un instant de plus.
    if (index == 3) {
      _pendingPaymentsRebuildCount++;
    }
    setState(() => _currentIndex = index);
    // §11.x — Les chiffres du jour (revenu, adhérents actifs...)
    // doivent refléter ce qui vient d'être fait ailleurs (nouvel
    // adhérent, paiement validé) ; l'IndexedStack garde cet écran en
    // mémoire sans jamais le recharger tout seul, donc on force un
    // rafraîchissement à chaque fois qu'on y revient.
    if (index == 0) {
      _dashboardKey.currentState?.refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _screens),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: _currentIndex,
        onTap: _onTap,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), activeIcon: Icon(Icons.dashboard), label: 'Tableau de bord'),
          BottomNavigationBarItem(icon: Icon(Icons.qr_code_scanner_outlined), activeIcon: Icon(Icons.qr_code_scanner), label: 'Scanner'),
          BottomNavigationBarItem(icon: Icon(Icons.people_outline), activeIcon: Icon(Icons.people), label: 'Adhérents'),
          BottomNavigationBarItem(icon: Icon(Icons.payments_outlined), activeIcon: Icon(Icons.payments), label: 'Paiements'),
          BottomNavigationBarItem(icon: Icon(Icons.groups_outlined), activeIcon: Icon(Icons.groups), label: 'Prospects'),
          BottomNavigationBarItem(icon: Icon(Icons.shopping_bag_outlined), activeIcon: Icon(Icons.shopping_bag), label: 'Boutique'),
          BottomNavigationBarItem(icon: Icon(Icons.account_balance_wallet_outlined), activeIcon: Icon(Icons.account_balance_wallet), label: 'Finances'),
        ],
      ),
    );
  }
}
