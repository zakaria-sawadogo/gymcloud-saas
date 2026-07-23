import 'package:flutter/material.dart';

/// Mêmes tokens que le frontend web (03_Frontend_NextJS/tailwind.config.ts)
/// — émeraude comme couleur de marque, corail comme accent — pour une
/// cohérence de marque totale entre web et mobile.
class AppColors {
  static const primary = Color(0xFF0F6E56);
  static const primaryLight = Color(0xFFE8F5F1);
  static const primaryDark = Color(0xFF094537);

  static const accent = Color(0xFFD85A30);
  static const accentLight = Color(0xFFFDEEE8);

  static const ink900 = Color(0xFF14181B);
  static const ink600 = Color(0xFF494F54);
  static const ink400 = Color(0xFF71767A);
  static const ink100 = Color(0xFFE5E7E8);
  static const ink50 = Color(0xFFF5F6F6);

  static const danger = Color(0xFFDC2626);
  static const dangerLight = Color(0xFFFEF2F2);
}

class AppTheme {
  static ThemeData get light {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: const Color(0xFFFAFAF9),
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        primary: AppColors.primary,
        secondary: AppColors.accent,
        brightness: Brightness.light,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.ink900,
        elevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: AppColors.ink100),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          elevation: 0,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.ink100),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.ink100),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.ink400,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
    );
  }
}

/// Couleurs de statut, cohérentes avec StatusBadge.tsx côté web.
Color statusColor(String status) {
  switch (status) {
    case 'ACTIF':
    case 'VALIDE':
    case 'CONFIRMEE':
      return AppColors.primary;
    case 'EN_GRACE':
    case 'EN_ATTENTE':
    case 'EN_ATTENTE_PAIEMENT':
      return AppColors.accent;
    case 'EXPIRE':
    case 'REJETE':
    case 'ANNULEE':
      return AppColors.danger;
    default:
      return AppColors.ink600;
  }
}
