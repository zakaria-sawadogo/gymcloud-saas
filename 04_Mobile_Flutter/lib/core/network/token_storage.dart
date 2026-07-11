import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Stockage des jetons via le keychain iOS / keystore Android
/// (flutter_secure_storage), jamais dans SharedPreferences en clair —
/// équivalent mobile du choix fait côté web (sessionStorage) mais
/// avec un niveau de protection supérieur, disponible nativement sur
/// mobile.
class TokenStorage {
  static const _accessTokenKey = 'gymcloud_access_token';
  static const _refreshTokenKey = 'gymcloud_refresh_token';

  final _storage = const FlutterSecureStorage();

  Future<String?> getAccessToken() => _storage.read(key: _accessTokenKey);
  Future<String?> getRefreshToken() => _storage.read(key: _refreshTokenKey);

  Future<void> setTokens({required String accessToken, required String refreshToken}) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
  }

  Future<void> clear() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }
}
