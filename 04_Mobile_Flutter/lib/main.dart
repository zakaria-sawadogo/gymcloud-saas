import 'package:flutter/material.dart';
import 'app.dart';

/// Point d'entrée unique de GymCloud (§2.3) — une seule application,
/// installée par tous les profils (adhérent, coach, gestionnaire,
/// propriétaire). L'écran affiché après connexion dépend du rôle réel
/// renvoyé par l'API, pas d'un flavor de compilation — voir app.dart.
///
/// Lancement : `flutter run --dart-define=API_URL=http://localhost:3000/api/v1`
void main() {
  runApp(const GymCloudApp());
}
