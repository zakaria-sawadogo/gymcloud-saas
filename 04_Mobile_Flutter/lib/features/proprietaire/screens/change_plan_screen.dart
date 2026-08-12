import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/network/api_client.dart';
import '../proprietaire_repository.dart';

/// §14.x — Corrige un vrai trou trouvé à l'audit : changer de plan
/// SaaS existait côté web, jamais côté mobile. Ne gère que le
/// paiement en espèces sur mobile — un montant dû payé par Mobile
/// Money reste à faire depuis le web (le chantier Mobile Money
/// direct par salle n'est pas encore branché, voir ailleurs).
class ChangePlanScreen extends StatefulWidget {
  final ProprietaireRepository repo;
  final String currentSubscriptionId;
  final String currentPlanId;

  const ChangePlanScreen({
    super.key,
    required this.repo,
    required this.currentSubscriptionId,
    required this.currentPlanId,
  });

  @override
  State<ChangePlanScreen> createState() => _ChangePlanScreenState();
}

class _ChangePlanScreenState extends State<ChangePlanScreen> {
  List<dynamic>? _plans;
  bool _isLoading = true;
  String? _error;
  String? _changingPlanId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final plans = await widget.repo.getSaasPlans();
      setState(() => _plans = plans);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _attemptChange(String planId, {bool payCash = false}) async {
    setState(() => _changingPlanId = planId);
    try {
      await widget.repo.changeSaasPlan(widget.currentSubscriptionId, planId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Plan changé avec succès')),
        );
        Navigator.pop(context, true);
      }
    } on ApiException catch (e) {
      // §14.x — le backend rejette explicitement si un montant est dû
      // sans moyen de paiement fourni — le message inclut déjà le
      // montant exact et la devise, pas besoin de le recalculer ici.
      if (!payCash && mounted) {
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Paiement requis'),
            content: Text('${e.message}\n\nPayer en espèces maintenant ?'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Annuler')),
              FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Payer en espèces')),
            ],
          ),
        );
        if (confirmed == true) {
          await _confirmCashPayment(planId);
        } else {
          setState(() => _changingPlanId = null);
        }
      } else {
        setState(() => _changingPlanId = null);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
        }
      }
    } catch (e) {
      setState(() => _changingPlanId = null);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> _confirmCashPayment(String planId) async {
    try {
      await widget.repo.changeSaasPlan(
        widget.currentSubscriptionId,
        planId,
        payment: {'method': 'ESPECES'},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Paiement enregistré — en attente de validation')),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      setState(() => _changingPlanId = null);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Changer de plan')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, style: const TextStyle(color: AppColors.danger), textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        OutlinedButton(onPressed: _load, child: const Text('Réessayer')),
                      ],
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: (_plans ?? []).map((p) {
                    final plan = p as Map<String, dynamic>;
                    final isCurrent = plan['id'] == widget.currentPlanId;
                    final isChanging = _changingPlanId == plan['id'];
                    return Card(
                      color: isCurrent ? AppColors.primaryLight : null,
                      child: ListTile(
                        title: Text(plan['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text('${plan['priceMonthly'] ?? '?'} / mois'),
                        trailing: isCurrent
                            ? const Chip(label: Text('Actuel', style: TextStyle(fontSize: 11)))
                            : isChanging
                                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                                : OutlinedButton(
                                    onPressed: () => _attemptChange(plan['id']),
                                    child: const Text('Choisir'),
                                  ),
                      ),
                    );
                  }).toList(),
                ),
    );
  }
}
