import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/status_badge.dart';
import '../../shared/logout_button.dart';
import '../../../core/models/adherent.dart';
import '../coach_repository.dart';

/// Planning du coach (§7.11) — groupé par jour, avec pointage de
/// présence/absence directement depuis le mobile (utile en salle, sans
/// devoir revenir au poste gestionnaire).
class PlanningScreen extends StatefulWidget {
  const PlanningScreen({super.key});

  @override
  State<PlanningScreen> createState() => _PlanningScreenState();
}

class _PlanningScreenState extends State<PlanningScreen> {
  late final CoachRepository _repo;
  List<Booking> _bookings = [];
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
    final bookings = await _repo.getBookings(coachId);
    bookings.sort((a, b) => a.startAt.compareTo(b.startAt));
    setState(() {
      _bookings = bookings;
      _isLoading = false;
    });
  }

  Future<void> _handleAttendance(Booking booking, bool present) async {
    try {
      if (present) {
        await _repo.markAttendance(booking.id);
      } else {
        await _repo.markAbsence(booking.id);
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppColors.danger));
      }
    }
  }

  Map<String, List<Booking>> get _groupedByDay {
    final grouped = <String, List<Booking>>{};
    final formatter = DateFormat('EEEE dd MMMM', 'fr_FR');
    for (final b in _bookings) {
      final key = formatter.format(b.startAt);
      grouped.putIfAbsent(key, () => []).add(b);
    }
    return grouped;
  }

  @override
  Widget build(BuildContext context) {
    final grouped = _groupedByDay;

    return Scaffold(
      appBar: AppBar(title: const Text('Mon planning'), actions: const [LogoutButton()]),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _bookings.isEmpty
                  ? ListView(
                      children: const [
                        Padding(
                          padding: EdgeInsets.only(top: 60),
                          child: Center(child: Text('Aucune séance planifiée', style: TextStyle(color: AppColors.ink400))),
                        ),
                      ],
                    )
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: grouped.entries.map((entry) {
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8, top: 8),
                              child: Text(
                                entry.key[0].toUpperCase() + entry.key.substring(1),
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                              ),
                            ),
                            ...entry.value.map((b) => _BookingRow(booking: b, onAttendance: _handleAttendance)),
                          ],
                        );
                      }).toList(),
                    ),
            ),
    );
  }
}

class _BookingRow extends StatelessWidget {
  final Booking booking;
  final void Function(Booking, bool present) onAttendance;
  const _BookingRow({required this.booking, required this.onAttendance});

  @override
  Widget build(BuildContext context) {
    final timeFormat = DateFormat('HH:mm');
    final canPoint = booking.status == 'CONFIRMEE' && booking.startAt.isBefore(DateTime.now().add(const Duration(hours: 1)));

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            SizedBox(
              width: 50,
              child: Text(timeFormat.format(booking.startAt), style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    booking.coursName ?? 'Séance individuelle',
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                  StatusBadge(status: booking.status),
                ],
              ),
            ),
            if (canPoint) ...[
              IconButton(
                icon: const Icon(Icons.check_circle_outline, color: AppColors.primary),
                onPressed: () => onAttendance(booking, true),
                tooltip: 'Présent',
              ),
              IconButton(
                icon: const Icon(Icons.cancel_outlined, color: AppColors.danger),
                onPressed: () => onAttendance(booking, false),
                tooltip: 'Absent',
              ),
            ],
          ],
        ),
      ),
    );
  }
}
