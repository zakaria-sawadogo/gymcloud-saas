import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../adherent_repository.dart';
import '../../shared/logout_button.dart';

/// Écran d'accès rapide (§1.3, §6.3) — affiche le QR code en plein
/// écran, luminosité maximale implicite (fond blanc) pour un scan
/// fiable même en conditions de faible éclairage à l'entrée de la
/// salle.
class QrCodeScreen extends StatefulWidget {
  const QrCodeScreen({super.key});

  @override
  State<QrCodeScreen> createState() => _QrCodeScreenState();
}

class _QrCodeScreenState extends State<QrCodeScreen> {
  String? _qrToken;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final adherentId = context.read<AuthProvider>().user?.adherentId;
    if (adherentId == null) return;
    final repo = AdherentRepository(context.read());
    final profile = await repo.getProfile(adherentId);
    setState(() {
      _qrToken = profile.qrCodeToken;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(title: const Text('Mon QR code'), backgroundColor: Colors.white, actions: const [LogoutButton()]),
      body: Center(
        child: _isLoading
            ? const CircularProgressIndicator()
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.ink100, width: 2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: QrImageView(
                      data: _qrToken ?? '',
                      size: 240,
                      backgroundColor: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    user?.fullName ?? '',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Présentez ce code à l\'entrée de la salle',
                    style: TextStyle(color: AppColors.ink400, fontSize: 13),
                  ),
                ],
              ),
      ),
    );
  }
}
