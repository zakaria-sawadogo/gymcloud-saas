import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../core/models/adherent.dart';
import '../adherent_repository.dart';

class BookingsScreen extends StatefulWidget {
  const BookingsScreen({super.key});

  @override
  State<BookingsScreen> createState() => _BookingsScreenState();
}

class _BookingsScreenState extends State<BookingsScreen> {
  late final AdherentRepository _repo;
  List<Booking> _bookings = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _repo = AdherentRepository(context.read());
    _load();
  }

  Future<void> _load() async {
    final adherentId = context.read<AuthProvider>().user?.adherentId;
    if (adherentId == null) return;
    setState(() => _isLoading = true);
    final bookings = await _repo.getBookings(adherentId);
    setState(() {
      _bookings = bookings..sort((a, b) => a.startAt.compareTo(b.startAt));
      _isLoading = false;
    });
  }

  Future<void> _cancel(Booking booking) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Annuler la réservation ?'),
        content: const Text('Cette action est définitive.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Retour')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Annuler la réservation')),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await _repo.cancelBooking(booking.id);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppColors.danger));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final upcoming = _bookings.where((b) => b.status == 'CONFIRMEE' && b.startAt.isAfter(DateTime.now())).toList();
    final past = _bookings.where((b) => !upcoming.contains(b)).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Mes réservations')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (upcoming.isEmpty && past.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 60),
                      child: Center(child: Text('Aucune réservation pour le moment', style: TextStyle(color: AppColors.ink400))),
                    ),
                  if (upcoming.isNotEmpty) ...[
                    const Text('À venir', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                    const SizedBox(height: 8),
                    ...upcoming.map((b) => _BookingCard(booking: b, onCancel: () => _cancel(b))),
                    const SizedBox(height: 20),
                  ],
                  if (past.isNotEmpty) ...[
                    const Text('Passées', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                    const SizedBox(height: 8),
                    ...past.map((b) => _BookingCard(booking: b, onCancel: null)),
                  ],
                ],
              ),
            ),
    );
  }
}

class _BookingCard extends StatelessWidget {
  final Booking booking;
  final VoidCallback? onCancel;
  const _BookingCard({required this.booking, this.onCancel});

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('EEE dd MMM · HH:mm', 'fr_FR');
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    booking.coursName ?? (booking.type == 'SEANCE_INDIVIDUELLE' ? 'Séance individuelle' : 'Cours'),
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  if (booking.coachName != null) Text('Avec ${booking.coachName}', style: const TextStyle(color: AppColors.ink400, fontSize: 12)),
                  const SizedBox(height: 4),
                  Text(dateFormat.format(booking.startAt), style: const TextStyle(color: AppColors.ink600, fontSize: 13)),
                ],
              ),
            ),
            StatusBadge(status: booking.status),
            if (onCancel != null)
              IconButton(icon: const Icon(Icons.close, size: 20, color: AppColors.danger), onPressed: onCancel),
          ],
        ),
      ),
    );
  }
}
