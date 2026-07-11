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

  Future<void> logout() => _tokenStorage.clear();

  Future<bool> hasStoredSession() async => (await _tokenStorage.getAccessToken()) != null;
}
