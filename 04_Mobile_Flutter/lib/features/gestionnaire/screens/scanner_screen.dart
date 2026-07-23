import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../shared/logout_button.dart';
import '../gestionnaire_repository.dart';

/// Scanner QR mobile (§6.3) — équivalent terrain du champ de saisie
/// manuel disponible côté web, pour un contrôle d'accès à l'entrée
/// sans poste fixe. Verrouille temporairement le scan après une
/// lecture pour éviter les doublons pendant l'affichage du résultat.
class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final MobileScannerController _controller = MobileScannerController();
  late final GestionnaireRepository _repo;
  bool _isProcessing = false;
  _ScanResult? _lastResult;

  @override
  void initState() {
    super.initState();
    _repo = GestionnaireRepository(context.read());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _handleDetection(BarcodeCapture capture) async {
    if (_isProcessing) return;
    if (capture.barcodes.isEmpty) return;
    final code = capture.barcodes.first.rawValue;
    if (code == null) return;

    final salleId = context.read<AuthProvider>().user?.salle?.id;
    if (salleId == null) return;

    setState(() => _isProcessing = true);
    try {
      final result = await _repo.scanQr(code, salleId);
      setState(() {
        _lastResult = _ScanResult(
          isError: false,
          direction: result['direction'] ?? '',
          message: result['direction'] == 'ENTREE' ? 'Entrée enregistrée' : 'Sortie enregistrée',
        );
      });
    } on ApiException catch (e) {
      setState(() => _lastResult = _ScanResult(isError: true, direction: '', message: e.message));
    } finally {
      // Fenêtre de verrouillage avant d'accepter un nouveau scan.
      await Future.delayed(const Duration(seconds: 2));
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scanner QR'), backgroundColor: Colors.black, foregroundColor: Colors.white, actions: const [LogoutButton()]),
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          MobileScanner(controller: _controller, onDetect: _handleDetection),
          _ScannerOverlay(),
          if (_lastResult != null)
            Positioned(
              bottom: 32,
              left: 20,
              right: 20,
              child: _ResultBanner(result: _lastResult!),
            ),
        ],
      ),
    );
  }
}

class _ScanResult {
  final bool isError;
  final String direction;
  final String message;
  _ScanResult({required this.isError, required this.direction, required this.message});
}

class _ScannerOverlay extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 240,
        height: 240,
        decoration: BoxDecoration(
          border: Border.all(color: Colors.white.withValues(alpha: 0.8), width: 2),
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }
}

class _ResultBanner extends StatelessWidget {
  final _ScanResult result;
  const _ResultBanner({required this.result});

  @override
  Widget build(BuildContext context) {
    final color = result.isError ? AppColors.danger : AppColors.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(12)),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            result.isError ? Icons.error_outline : (result.direction == 'ENTREE' ? Icons.login : Icons.logout),
            color: Colors.white,
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Text(result.message, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
