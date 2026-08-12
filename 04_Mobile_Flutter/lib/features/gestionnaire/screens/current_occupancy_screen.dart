import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../gestionnaire_repository.dart';

/// §6.9, §14.x — Corrige un vrai trou trouvé à l'audit : le
/// gestionnaire mobile pouvait scanner un QR code, mais n'avait aucun
/// moyen de voir qui était actuellement présent dans la salle —
/// contrairement au web, où cette liste est juste à côté du scanner.
class CurrentOccupancyScreen extends StatefulWidget {
  final GestionnaireRepository repo;
  final String salleId;

  const CurrentOccupancyScreen({super.key, required this.repo, required this.salleId});

  @override
  State<CurrentOccupancyScreen> createState() => _CurrentOccupancyScreenState();
}

class _CurrentOccupancyScreenState extends State<CurrentOccupancyScreen> {
  List<Map<String, dynamic>>? _occupancy;
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
      final occupancy = await widget.repo.getCurrentOccupancy(widget.salleId);
      setState(() => _occupancy = occupancy);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final timeFormat = DateFormat('HH:mm', 'fr_FR');

    return Scaffold(
      appBar: AppBar(title: Text('Présents actuellement (${_occupancy?.length ?? 0})')),
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
                : (_occupancy == null || _occupancy!.isEmpty)
                    ? ListView(
                        children: const [
                          SizedBox(height: 80),
                          Icon(Icons.people_outline, size: 40, color: AppColors.ink400),
                          SizedBox(height: 12),
                          Center(
                            child: Text('Personne dans la salle pour le moment', style: TextStyle(color: AppColors.ink400)),
                          ),
                        ],
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _occupancy!.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final log = _occupancy![index];
                          final adherent = log['adherent'] as Map<String, dynamic>?;
                          final user = adherent?['user'] as Map<String, dynamic>?;
                          final checkInAt = DateTime.parse(log['checkInAt']);
                          return Card(
                            child: ListTile(
                              leading: const CircleAvatar(
                                backgroundColor: AppColors.primaryLight,
                                child: Icon(Icons.person, color: AppColors.primary, size: 20),
                              ),
                              title: Text('${user?['firstName'] ?? ''} ${user?['lastName'] ?? ''}'),
                              subtitle: Text('Entré à ${timeFormat.format(checkInAt)}'),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
