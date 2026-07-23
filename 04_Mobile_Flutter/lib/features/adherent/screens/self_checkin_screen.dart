import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../adherent_repository.dart';

/// §6.14 — L'adhérent scanne lui-même le QR fixe affiché à l'entrée de
/// la salle pour pointer son entrée/sortie, sans passer par le
/// personnel. Distinct du QR "Mon QR code" (celui-là, c'est le
/// personnel qui le scanne) — les deux coexistent.
class SelfCheckinScreen extends StatefulWidget {
  final ApiClient apiClient;

  const SelfCheckinScreen({super.key, required this.apiClient});

  @override
  State<SelfCheckinScreen> createState() => _SelfCheckinScreenState();
}

class _SelfCheckinScreenState extends State<SelfCheckinScreen> {
  final MobileScannerController _controller = MobileScannerController();
  late final AdherentRepository _repo;
  bool _isProcessing = false;
  _CheckinResult? _lastResult;

  @override
  void initState() {
    super.initState();
    _repo = AdherentRepository(widget.apiClient);
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

    setState(() => _isProcessing = true);
    try {
      final result = await _repo.selfCheckin(code);
      setState(() {
        _lastResult = _CheckinResult(
          isError: false,
          direction: result['direction'] ?? '',
          message: result['direction'] == 'ENTREE' ? 'Entrée enregistrée — bonne séance !' : 'Sortie enregistrée',
        );
      });
    } on ApiException catch (e) {
      setState(() => _lastResult = _CheckinResult(isError: true, direction: '', message: e.message));
    } finally {
      // Fenêtre de verrouillage avant d'accepter un nouveau scan.
      await Future.delayed(const Duration(seconds: 2));
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scanner le QR de la salle'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          MobileScanner(controller: _controller, onDetect: _handleDetection),
          Center(
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white.withValues(alpha: 0.8), width: 2),
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
          Positioned(
            top: 16,
            left: 20,
            right: 20,
            child: Text(
              'Visez le QR affiché à l\'entrée de la salle',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 13),
            ),
          ),
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

class _CheckinResult {
  final bool isError;
  final String direction;
  final String message;
  _CheckinResult({required this.isError, required this.direction, required this.message});
}

class _ResultBanner extends StatelessWidget {
  final _CheckinResult result;
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
