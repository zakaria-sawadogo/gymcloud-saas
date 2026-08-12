import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../adherent_repository.dart';

/// §6.11, §14.x — Corrige un vrai trou trouvé à l'audit : l'adhérent
/// pouvait pointer son entrée (self-checkin) mais n'avait aucun moyen
/// de revoir ses propres passages en salle, contrairement au
/// gestionnaire qui voit tout côté web.
class AccessHistoryScreen extends StatefulWidget {
  final AdherentRepository repo;
  final String adherentId;

  const AccessHistoryScreen({super.key, required this.repo, required this.adherentId});

  @override
  State<AccessHistoryScreen> createState() => _AccessHistoryScreenState();
}

class _AccessHistoryScreenState extends State<AccessHistoryScreen> {
  List<Map<String, dynamic>>? _history;
  bool _isLoading = true;
  String? _error;

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
      final history = await widget.repo.getMyAccessHistory(widget.adherentId);
      setState(() => _history = history);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd MMM yyyy · HH:mm', 'fr_FR');

    return Scaffold(
      appBar: AppBar(title: const Text('Mes passages en salle')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _isLoading
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
                : (_history == null || _history!.isEmpty)
                    ? ListView(
                        children: const [
                          SizedBox(height: 80),
                          Icon(Icons.history, size: 40, color: AppColors.ink400),
                          SizedBox(height: 12),
                          Center(
                            child: Text('Aucun passage enregistré', style: TextStyle(color: AppColors.ink400)),
                          ),
                        ],
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _history!.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final log = _history![index];
                          final checkInAt = DateTime.parse(log['checkInAt']);
                          final checkOutAt = log['checkOutAt'] != null ? DateTime.parse(log['checkOutAt']) : null;
                          return Card(
                            child: ListTile(
                              leading: const CircleAvatar(
                                backgroundColor: AppColors.primaryLight,
                                child: Icon(Icons.fitness_center, color: AppColors.primary, size: 20),
                              ),
                              title: Text(dateFormat.format(checkInAt)),
                              subtitle: Text(
                                checkOutAt != null
                                    ? 'Sortie à ${DateFormat('HH:mm').format(checkOutAt)}'
                                    : 'Session en cours',
                                style: checkOutAt == null
                                    ? const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w500)
                                    : null,
                              ),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
