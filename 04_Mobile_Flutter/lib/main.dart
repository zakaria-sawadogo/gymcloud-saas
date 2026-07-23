import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'app.dart';

/// Point d'entrée unique de GymCloud (§2.3) — une seule application,
/// installée par tous les profils (adhérent, coach, gestionnaire,
/// propriétaire). L'écran affiché après connexion dépend du rôle réel
/// renvoyé par l'API, pas d'un flavor de compilation — voir app.dart.
///
/// Lancement : `flutter run --dart-define=API_URL=http://localhost:3000/api/v1`
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Requis avant tout DateFormat('...', 'fr_FR') utilisé dans l'app
  // (accueil, réservations, paiements, planning coach...) — sans ça,
  // LocaleDataException dès le premier écran affichant une date.
  await initializeDateFormatting('fr_FR', null);
  runApp(const GymCloudApp());
}
