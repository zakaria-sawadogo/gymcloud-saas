import 'package:dio/dio.dart';
import '../config/flavor_config.dart';
import 'token_storage.dart';

/// Exception uniforme pour toutes les erreurs API — mêmes
/// caractéristiques que `ApiClientError` côté frontend web.
class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);

  @override
  String toString() => message;
}

/// Callback invoqué quand la session est définitivement perdue
/// (refresh token expiré) — l'app doit rediriger vers l'écran de
/// connexion. Assigné par AuthProvider au démarrage.
typedef OnSessionExpired = void Function();

/// Client API centralisé, construit sur Dio avec un intercepteur qui :
///  1. Ajoute automatiquement le Bearer token à chaque requête.
///  2. Sur 401, tente un refresh silencieux puis rejoue la requête une
///     seule fois (évite les boucles infinies).
///  3. Convertit toute erreur HTTP en `ApiException` lisible.
class ApiClient {
  final Dio _dio;
  final TokenStorage _tokenStorage;
  OnSessionExpired? onSessionExpired;

  ApiClient(this._tokenStorage)
      : _dio = Dio(BaseOptions(baseUrl: ApiConfig.baseUrl, connectTimeout: const Duration(seconds: 15))) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (options.extra['skipAuth'] != true) {
            final token = await _tokenStorage.getAccessToken();
            if (token != null) options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final isAuthError = error.response?.statusCode == 401;
          final skipAuth = error.requestOptions.extra['skipAuth'] == true;
          final alreadyRetried = error.requestOptions.extra['retried'] == true;

          if (isAuthError && !skipAuth && !alreadyRetried) {
            try {
              await _refreshAccessToken();
              final retryOptions = error.requestOptions;
              retryOptions.extra['retried'] = true;
              final response = await _dio.fetch(retryOptions);
              return handler.resolve(response);
            } catch (_) {
              await _tokenStorage.clear();
              onSessionExpired?.call();
              return handler.reject(error);
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  Future<void>? _refreshInFlight;

  Future<void> _refreshAccessToken() async {
    // Mutualise les rafraîchissements concurrents, comme côté web.
    _refreshInFlight ??= _doRefresh();
    try {
      await _refreshInFlight;
    } finally {
      _refreshInFlight = null;
    }
  }

  Future<void> _doRefresh() async {
    final refreshToken = await _tokenStorage.getRefreshToken();
    if (refreshToken == null) throw ApiException(401, 'Session expirée');

    final response = await _dio.post(
      '/auth/refresh',
      data: {'refreshToken': refreshToken},
      options: Options(extra: {'skipAuth': true}),
    );
    await _tokenStorage.setTokens(
      accessToken: response.data['accessToken'],
      refreshToken: response.data['refreshToken'],
    );
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? query}) async {
    try {
      final res = await _dio.get(path, queryParameters: query);
      return res.data as T;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<T> post<T>(String path, {Object? data, bool skipAuth = false}) async {
    try {
      final res = await _dio.post(path, data: data, options: Options(extra: {'skipAuth': skipAuth}));
      return res.data as T;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<T> patch<T>(String path, {Object? data}) async {
    try {
      final res = await _dio.patch(path, data: data);
      return res.data as T;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  ApiException _toApiException(DioException e) {
    final statusCode = e.response?.statusCode ?? 0;
    final body = e.response?.data;
    String message = 'Une erreur est survenue';
    if (body is Map && body['message'] != null) {
      final m = body['message'];
      message = m is List ? m.join(', ') : m.toString();
    }
    return ApiException(statusCode, message);
  }
}
