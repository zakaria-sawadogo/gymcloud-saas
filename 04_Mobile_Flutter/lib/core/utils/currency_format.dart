import 'package:intl/intl.dart';

/// §14.x — Corrige un bug répandu dans l'app mobile : "FCFA" était
/// codé en dur dans huit écrans différents, ignorant la vraie devise
/// de la salle (potentiellement différente de XOF selon le pays du
/// propriétaire — voir Salle.currency côté backend). Centralisé ici
/// plutôt que dupliqué dans chaque écran.
///
/// "XOF" (code ISO stocké en base) s'affiche comme "FCFA" — le
/// libellé familier que les utilisateurs actuels connaissent déjà,
/// pas le code technique. Toute autre devise (GNF, USD, CDF...)
/// s'affiche telle quelle, sous son propre code.
///
/// `currencyCode` peut être `null` (donnée pas encore chargée) — XOF
/// reste alors la valeur par défaut, cohérente avec le comportement
/// historique de l'app avant ce correctif.
NumberFormat currencyFormatFor(String? currencyCode) {
  final symbol = (currencyCode == null || currencyCode == 'XOF') ? 'FCFA' : currencyCode;
  final decimalDigits = currencyCode == 'USD' ? 2 : 0;
  return NumberFormat.currency(locale: 'fr_FR', symbol: symbol, decimalDigits: decimalDigits);
}
