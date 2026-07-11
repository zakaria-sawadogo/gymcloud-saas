import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/coach.dart';
import '../coach_repository.dart';

/// Gestion des créneaux de disponibilité récurrents (§7.6) — vérifiés
/// par le backend lors de toute réservation de séance individuelle.
class AvailabilityScreen extends StatefulWidget {
  const AvailabilityScreen({super.key});

  @override
  State<AvailabilityScreen> createState() => _AvailabilityScreenState();
}

class _AvailabilityScreenState extends State<AvailabilityScreen> {
  late final CoachRepository _repo;
  List<CoachAvailability> _slots = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _repo = CoachRepository(context.read());
    _load();
  }

  Future<void> _load() async {
    final coachId = context.read<AuthProvider>().user?.coachId;
    if (coachId == null) return;
    setState(() => _isLoading = true);
    final slots = await _repo.getAvailability(coachId);
    slots.sort((a, b) => a.dayOfWeek.compareTo(b.dayOfWeek));
    setState(() {
      _slots = slots;
      _isLoading = false;
    });
  }

  Future<void> _openAddSheet() async {
    final coachId = context.read<AuthProvider>().user?.coachId;
    if (coachId == null) return;

    int dayOfWeek = 1;
    TimeOfDay start = const TimeOfDay(hour: 8, minute: 0);
    TimeOfDay end = const TimeOfDay(hour: 12, minute: 0);

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Nouveau créneau', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              const SizedBox(height: 16),
              DropdownButtonFormField<int>(
                value: dayOfWeek,
                decoration: const InputDecoration(labelText: 'Jour'),
                items: List.generate(
                  7,
                  (i) => DropdownMenuItem(value: i, child: Text(CoachAvailability.dayNames[i])),
                ),
                onChanged: (v) => setSheetState(() => dayOfWeek = v ?? 1),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        final picked = await showTimePicker(context: ctx, initialTime: start);
                        if (picked != null) setSheetState(() => start = picked);
                      },
                      child: Text('Début : ${start.format(ctx)}'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        final picked = await showTimePicker(context: ctx, initialTime: end);
                        if (picked != null) setSheetState(() => end = picked);
                      },
                      child: Text('Fin : ${end.format(ctx)}'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    await _repo.addAvailability(
                      coachId,
                      dayOfWeek,
                      '${start.hour.toString().padLeft(2, '0')}:${start.minute.toString().padLeft(2, '0')}',
                      '${end.hour.toString().padLeft(2, '0')}:${end.minute.toString().padLeft(2, '0')}',
                    );
                    if (ctx.mounted) Navigator.pop(ctx);
                    _load();
                  },
                  child: const Text('Ajouter'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mes disponibilités')),
      floatingActionButton: FloatingActionButton(onPressed: _openAddSheet, child: const Icon(Icons.add)),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _slots.isEmpty
              ? const Center(
                  child: Text('Aucun créneau déclaré', style: TextStyle(color: AppColors.ink400)),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _slots.length,
                  itemBuilder: (context, i) {
                    final s = _slots[i];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: const Icon(Icons.schedule, color: AppColors.primary),
                        title: Text(s.dayName, style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text('${s.startTime} — ${s.endTime}'),
                      ),
                    );
                  },
                ),
    );
  }
}
