import 'package:flutter/foundation.dart';
import '../models/user.dart';
import 'auth_repository.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

/// État d'authentification global, exposé via Provider à toute l'app.
/// Équivalent Flutter du `AuthContext` React côté frontend web — même
/// contrat fonctionnel (login, logout, user courant, isLoading) pour
/// que les deux équipes raisonnent de la même façon.
class AuthProvider extends ChangeNotifier {
  final AuthRepository _repository;

  AuthProvider(this._repository) {
    _restoreSession();
  }

  AuthStatus _status = AuthStatus.unknown;
  CurrentUser? _user;
  String? _error;

  AuthStatus get status => _status;
  CurrentUser? get user => _user;
  String? get error => _error;
  bool get isLoading => _status == AuthStatus.unknown;

  Future<void> _restoreSession() async {
    if (await _repository.hasStoredSession()) {
      try {
        _user = await _repository.getMe();
        _status = AuthStatus.authenticated;
      } catch (_) {
        _status = AuthStatus.unauthenticated;
      }
    } else {
      _status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<bool> login(String phone, String password) async {
    _error = null;
    try {
      _user = await _repository.login(phone, password);
      _status = AuthStatus.authenticated;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  /// Invoqué par ApiClient.onSessionExpired quand le refresh token
  /// est lui-même expiré — force un retour à l'écran de connexion.
  void forceLogout() {
    _user = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  Future<void> logout() async {
    await _repository.logout();
    forceLogout();
  }
}
