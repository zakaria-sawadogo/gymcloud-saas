import '../network/api_client.dart';
import '../network/token_storage.dart';
import '../models/user.dart';

class AuthRepository {
  final ApiClient _apiClient;
  final TokenStorage _tokenStorage;

  AuthRepository(this._apiClient, this._tokenStorage);

  Future<CurrentUser> login(String phone, String password) async {
    final data = await _apiClient.post<Map<String, dynamic>>(
      '/auth/login',
      data: {'phone': phone, 'password': password},
      skipAuth: true,
    );
    await _tokenStorage.setTokens(accessToken: data['accessToken'], refreshToken: data['refreshToken']);
    return getMe();
  }

  Future<CurrentUser> getMe() async {
    final data = await _apiClient.get<Map<String, dynamic>>('/auth/me');
    return CurrentUser.fromJson(data);
  }

  /// §14.x — corrige un vrai trou trouvé à l'audit : aucun écran de
  /// profil/paramètres n'existait dans toute l'app, quel que soit le
  /// rôle — impossible de changer son mot de passe ou son nom/email
  /// depuis le téléphone.
  Future<CurrentUser> updateProfile({String? firstName, String? lastName, String? email}) async {
    final data = await _apiClient.patch<Map<String, dynamic>>('/auth/me', data: {
      if (firstName != null) 'firstName': firstName,
      if (lastName != null) 'lastName': lastName,
      if (email != null) 'email': email,
    });
    return CurrentUser.fromJson(data);
  }

  Future<void> changePassword({required String currentPassword, required String newPassword}) =>
      _apiClient.patch('/auth/change-password', data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });

  Future<void> logout() => _tokenStorage.clear();

  Future<bool> hasStoredSession() async => (await _tokenStorage.getAccessToken()) != null;

  /// §14.x — corrige un vrai trou trouvé à l'audit : aucun écran de
  /// profil/paramètres n'existait du tout, pour aucun rôle — personne
  /// ne pouvait changer son mot de passe ni modifier ses infos depuis
  /// le mobile.
  Future<void> changePassword({required String currentPassword, required String newPassword}) =>
      _apiClient.post('/auth/change-password', data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });

  Future<CurrentUser> updateProfile({String? firstName, String? lastName, String? email}) async {
    final data = await _apiClient.patch<Map<String, dynamic>>('/auth/me', data: {
      if (firstName != null) 'firstName': firstName,
      if (lastName != null) 'lastName': lastName,
      if (email != null) 'email': email,
    });
    return CurrentUser.fromJson(data);
  }
}
