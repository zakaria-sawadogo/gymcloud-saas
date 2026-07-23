import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/config/flavor_config.dart';
import '../../../core/theme/app_theme.dart';
import '../adherent_repository.dart';
import '../../shared/logout_button.dart';
import 'self_checkin_screen.dart';

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

  Future<void> _openPublicSite(String subdomain) async {
    // ApiConfig.baseUrl = "https://domaine/api/v1" -> on ne garde que
    // la racine du domaine, le site public vit sur le même domaine
    // (chemin /s/xxx), pas un sous-domaine générique — voir §3.2.
    final apiUri = Uri.parse(ApiConfig.baseUrl);
    final root = Uri(scheme: apiUri.scheme, host: apiUri.host, port: apiUri.hasPort ? apiUri.port : null);
    final siteUri = root.replace(path: '/s/$subdomain');
    await launchUrl(siteUri, mode: LaunchMode.externalApplication);
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
                  const SizedBox(height: 32),
                  OutlinedButton.icon(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => SelfCheckinScreen(apiClient: context.read()),
                        ),
                      );
                    },
                    icon: const Icon(Icons.qr_code_scanner),
                    label: const Text('Scanner le QR de la salle'),
                  ),
                  if (user?.salle?.publicSubdomain != null) ...[
                    const SizedBox(height: 12),
                    TextButton.icon(
                      onPressed: () => _openPublicSite(user!.salle!.publicSubdomain!),
                      icon: const Icon(Icons.open_in_new, size: 18),
                      label: const Text('Voir le site de la salle'),
                    ),
                  ],
                ],
              ),
      ),
    );
  }
}
