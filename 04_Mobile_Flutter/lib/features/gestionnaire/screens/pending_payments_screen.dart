import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/salle_extras.dart';
import '../gestionnaire_repository.dart';
import '../../shared/logout_button.dart';

/// §5.6, §8.3 — Demandes de réabonnement initiées par un adhérent
/// depuis l'app mobile : le gestionnaire constate le règlement (ou non)
/// et valide ou rejette. Jusqu'ici, cette étape n'était possible que
/// depuis le web.
class PendingPaymentsScreen extends StatefulWidget {
  const PendingPaymentsScreen({super.key});

  @override
  State<PendingPaymentsScreen> createState() => _PendingPaymentsScreenState();
}

class _PendingPaymentsScreenState extends State<PendingPaymentsScreen> {
  late final GestionnaireRepository _repo;
  List<PendingPayment> _payments = [];
  bool _isLoading = true;
  String? _actioningId;

  @override
  void initState() {
    super.initState();
    _repo = GestionnaireRepository(context.read());
    _load();
  }

  Future<void> _load() async {
    final salleId = context.read<AuthProvider>().user?.salle?.id;
    if (salleId == null) return;
    setState(() => _isLoading = true);
    try {
      final payments = await _repo.getPendingPayments(salleId);
      setState(() => _payments = payments);
    } catch (_) {
      // liste vide en cas d'erreur — l'utilisateur peut tirer pour rafraîchir
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _approve(PendingPayment p) async {
    setState(() => _actioningId = p.id);
    try {
      await _repo.approvePendingPayment(p.id);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppColors.danger));
      }
    } finally {
      setState(() => _actioningId = null);
    }
  }

  Future<void> _reject(PendingPayment p) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final controller = TextEditingController();
        return AlertDialog(
          title: const Text('Rejeter cette demande ?'),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(labelText: 'Motif (ex: fonds non retrouvés)'),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
            TextButton(onPressed: () => Navigator.pop(ctx, controller.text), child: const Text('Rejeter')),
          ],
        );
      },
    );
    if (reason == null) return;
    setState(() => _actioningId = p.id);
    try {
      await _repo.rejectPendingPayment(p.id, reason: reason);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppColors.danger));
      }
    } finally {
      setState(() => _actioningId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Paiements en attente'), actions: const [LogoutButton()]),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _payments.isEmpty
              ? const Center(
                  child: Text('Aucune demande en attente', style: TextStyle(color: AppColors.ink400)),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _payments.length,
                    itemBuilder: (context, i) {
                      final p = _payments[i];
                      final isActioning = _actioningId == p.id;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(p.adherentName, style: const TextStyle(fontWeight: FontWeight.w600)),
                              const SizedBox(height: 2),
                              Text(
                                '${p.amount.toStringAsFixed(0)} ${p.currency} · ${p.method}',
                                style: const TextStyle(color: AppColors.ink600, fontSize: 13),
                              ),
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  Expanded(
                                    child: OutlinedButton(
                                      onPressed: isActioning ? null : () => _reject(p),
                                      child: const Text('Rejeter'),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: ElevatedButton(
                                      onPressed: isActioning ? null : () => _approve(p),
                                      child: isActioning
                                          ? const SizedBox(
                                              height: 16,
                                              width: 16,
                                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                            )
                                          : const Text('Valider'),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
