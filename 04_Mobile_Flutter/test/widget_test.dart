// Test de fumée minimal — remplace le modèle par défaut de
// `flutter create` (qui référençait une classe "MyApp" et testait un
// compteur de démonstration inexistants dans cette app réelle,
// jamais mis à jour depuis la création initiale du projet).
//
// Se contente de vérifier que l'app se construit et s'affiche sans
// exception — pas d'assertion sur un contenu précis (écran de
// connexion, chargement...) puisque ça dépend de l'état du stockage
// sécurisé au moment du test, hors du périmètre d'un simple test de
// fumée.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gymcloud_mobile/app.dart';

void main() {
  testWidgets('GymCloudApp se construit sans exception', (WidgetTester tester) async {
    await tester.pumpWidget(const GymCloudApp());
    await tester.pump();

    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
