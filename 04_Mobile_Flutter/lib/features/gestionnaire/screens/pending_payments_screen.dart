import 'dart:async';
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
  State<PendingPaymentsScreen> createState() => PendingPaymentsScreenState();
}

class PendingPaymentsScreenState extends State<PendingPaymentsScreen> {
  late final GestionnaireRepository _repo;
  List<PendingPayment> _payments = [];
  bool _isLoading = true;
  String? _actioningId;

  String? _error;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _repo = GestionnaireRepository(context.read());
    _load();
    // §14.x — reconstruire l'écran au changement d'onglet ne suffit
    // pas : si le gestionnaire reste sur cet écran (le cas le plus
    // fréquent en pratique — il vient justement consulter les
    // demandes), une nouvelle demande soumise pendant ce temps
    // n'apparaissait jamais tant qu'il ne quittait pas l'écran pour y
    // revenir. Vérification périodique en tâche de fond, même
    // principe que NotificationBell (30s) — attrape le cas où
    // l'utilisateur reste sur place.
    _pollTimer = Timer.periodic(const Duration(seconds: 20), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  /// §14.x — appelée par GestionnaireApp quand on revient sur cet
  /// onglet (même patron que DashboardScreenState.refresh) —
  /// l'IndexedStack garde cet écran en mémoire sans jamais le
  /// recharger tout seul ; sans ça, une nouvelle demande de
  /// réabonnement soumise par un adhérent restait invisible tant que
  /// le gestionnaire ne tirait pas explicitement pour rafraîchir (ou
  /// se déconnectait/reconnectait) — ni intuitif ni découvrable.
  Future<void> refresh() => _load();

  Future<void> _load({bool silent = false}) async {
    final salleId = context.read<AuthProvider>().user?.salle?.id;
    if (salleId == null) return;
    if (!silent) {
      setState(() {
        _isLoading = true;
        _error = null;
      });
    }
    try {
      final payments = await _repo.getPendingPayments(salleId);
      if (mounted) setState(() => _payments = payments);
    } catch (e) {
      // §14.x — rendu visible plutôt qu'avalé silencieusement : une
      // erreur (permission, réseau, session expirée) affichait
      // jusqu'ici exactement le même écran qu'une liste réellement
      // vide, impossible à distinguer pour l'utilisateur comme pour
      // nous en diagnostic. En mode silencieux (vérification
      // périodique en tâche de fond) : une erreur ponctuelle
      // (coupure réseau passagère) ne doit pas faire disparaître une
      // liste déjà affichée et fonctionnelle — seul le chargement
      // explicite (bouton, premier affichage) remonte l'erreur.
      if (!silent && mounted) setState(() => _error = e.toString());
    } finally {
      if (!silent && mounted) setState(() => _isLoading = false);
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
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, color: AppColors.danger, size: 32),
                        const SizedBox(height: 12),
                        Text(_error!, style: const TextStyle(color: AppColors.danger), textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        OutlinedButton(onPressed: _load, child: const Text('Réessayer')),
                      ],
                    ),
                  ),
                )
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
