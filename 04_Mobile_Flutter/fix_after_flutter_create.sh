#!/bin/bash
# À exécuter UNE FOIS après chaque `flutter create --org com.gymcloud --project-name gymcloud_mobile .`
# Réapplique ce qui est systématiquement perdu lors de la régénération :
#   - permission caméra Android (nécessaire pour mobile_scanner : scan du QR
#     de la salle par l'adhérent, et scan de l'adhérent par le gestionnaire)
#   - permission caméra iOS (même raison)
#   - cible iOS 15.5 minimum dans le Podfile (mobile_scanner l'exige)
#   - exclusion arm64 pour le simulateur iOS (ML Kit n'a pas de build arm64
#     simulateur, nécessaire uniquement sur Mac Apple Silicon)
#
# Lancer depuis le dossier 04_Mobile_Flutter :
#   chmod +x fix_after_flutter_create.sh && ./fix_after_flutter_create.sh

set -e

MANIFEST="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ] && ! grep -q "android.permission.CAMERA" "$MANIFEST"; then
  # Insère juste avant la balise <application, qui existe toujours dans le
  # manifeste généré par flutter create.
  sed -i.bak 's#<application#<uses-permission android:name="android.permission.CAMERA" />\n    <application#' "$MANIFEST"
  rm -f "$MANIFEST.bak"
  echo "✔ Permission caméra ajoutée à AndroidManifest.xml"
else
  echo "· AndroidManifest.xml déjà correct (ou introuvable)"
fi

INFOPLIST="ios/Runner/Info.plist"
if [ -f "$INFOPLIST" ] && ! grep -q "NSCameraUsageDescription" "$INFOPLIST"; then
  sed -i.bak 's#<key>CFBundleDevelopmentRegion</key>#<key>NSCameraUsageDescription</key>\n\t<string>GymCloud a besoin de la caméra pour scanner les codes QR (entrée de salle, carte adhérent)</string>\n\t<key>CFBundleDevelopmentRegion</key>#' "$INFOPLIST"
  rm -f "$INFOPLIST.bak"
  echo "✔ Permission caméra ajoutée à Info.plist"
else
  echo "· Info.plist déjà correct (ou introuvable)"
fi

PODFILE="ios/Podfile"
if [ -f "$PODFILE" ]; then
  if grep -q "platform :ios, '13.0'" "$PODFILE"; then
    sed -i.bak "s/platform :ios, '13.0'/platform :ios, '15.5'/" "$PODFILE"
    rm -f "$PODFILE.bak"
    echo "✔ Podfile : cible iOS relevée à 15.5"
  elif grep -q "^platform :ios" "$PODFILE"; then
    echo "· Podfile : cible iOS déjà définie"
  fi

  if ! grep -q "EXCLUDED_ARCHS" "$PODFILE"; then
    sed -i.bak "s#flutter_additional_ios_build_settings(target)#flutter_additional_ios_build_settings(target)\n    target.build_configurations.each do |config|\n      config.build_settings['EXCLUDED_ARCHS\[sdk=iphonesimulator*\]'] = 'arm64'\n    end#" "$PODFILE"
    rm -f "$PODFILE.bak"
    echo "✔ Podfile : exclusion arm64 simulateur ajoutée"
  else
    echo "· Podfile : exclusion arm64 déjà présente"
  fi
fi

echo ""
echo "Terminé. Si vous ciblez Android : flutter pub get puis flutter run/build apk."
echo "Si vous ciblez iOS : cd ios && rm -rf Pods Podfile.lock && pod install && cd .."
