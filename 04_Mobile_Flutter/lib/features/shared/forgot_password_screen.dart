import 'package:flutter/material.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_theme.dart';

/// §4.9 — Réinitialisation de mot de passe en deux étapes : demande
/// d'un code (OTP) envoyé par SMS, puis confirmation avec ce code + un
/// nouveau mot de passe. Sans ça, un adhérent qui perd ou oublie le
/// mot de passe temporaire donné à l'inscription resterait bloqué
/// sans aucun moyen de récupérer l'accès à son compte.
class ForgotPasswordScreen extends StatefulWidget {
  final ApiClient apiClient;

  const ForgotPasswordScreen({super.key, required this.apiClient});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

enum _Step { phone, confirm, done }

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  _Step _step = _Step.phone;
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _newPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _error;

  Future<void> _requestOtp() async {
    setState(() {
      _error = null;
      _isLoading = true;
    });
    try {
      await widget.apiClient.post<Map<String, dynamic>>(
        '/auth/forgot-password',
        data: {'phone': _phoneController.text.trim()},
        skipAuth: true,
      );
      if (mounted) setState(() => _step = _Step.confirm);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _confirmReset() async {
    setState(() {
      _error = null;
      _isLoading = true;
    });
    try {
      await widget.apiClient.post<Map<String, dynamic>>(
        '/auth/reset-password',
        data: {
          'phone': _phoneController.text.trim(),
          'otpCode': _otpController.text.trim(),
          'newPassword': _newPasswordController.text,
        },
        skipAuth: true,
      );
      if (mounted) setState(() => _step = _Step.done);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    _newPasswordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.ink900,
      appBar: AppBar(
        backgroundColor: AppColors.ink900,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text('Mot de passe oublié'),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                  child: _buildStepContent(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStepContent() {
    switch (_step) {
      case _Step.phone:
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Saisissez le numéro de téléphone associé à votre compte — un code vous sera envoyé par SMS.',
              style: TextStyle(color: AppColors.ink600, fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Numéro de téléphone', hintText: '+226 70 00 00 00'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
            ],
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _isLoading ? null : _requestOtp,
              child: _isLoading ? _loadingIndicator() : const Text('Recevoir le code'),
            ),
          ],
        );
      case _Step.confirm:
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Saisissez le code reçu par SMS, ainsi que votre nouveau mot de passe.',
              style: TextStyle(color: AppColors.ink600, fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _otpController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Code reçu par SMS'),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _newPasswordController,
              obscureText: _obscurePassword,
              decoration: InputDecoration(
                labelText: 'Nouveau mot de passe',
                helperText: 'Au moins 10 caractères, une majuscule, une minuscule, un chiffre',
                helperMaxLines: 2,
                suffixIcon: IconButton(
                  icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                ),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
            ],
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _isLoading ? null : _confirmReset,
              child: _isLoading ? _loadingIndicator() : const Text('Réinitialiser le mot de passe'),
            ),
          ],
        );
      case _Step.done:
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.check_circle, color: AppColors.primary, size: 48),
            const SizedBox(height: 12),
            const Text(
              'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.ink900, fontSize: 14),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Retour à la connexion'),
            ),
          ],
        );
    }
  }

  Widget _loadingIndicator() => const SizedBox(
        height: 18,
        width: 18,
        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
      );
}
