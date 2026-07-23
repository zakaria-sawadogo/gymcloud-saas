import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/status_badge.dart';
import '../../shared/logout_button.dart';
import '../../../core/models/adherent.dart';
import '../adherent_repository.dart';
import 'booking_hub_screen.dart';

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

  Future<void> _pay(Booking booking) async {
    final result = await showModalBottomSheet<Map<String, String>>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => const _PaySeanceSheet(),
    );
    if (result == null) return;

    try {
      await _repo.paySeance(
        bookingId: booking.id,
        billingMode: result['billingMode']!,
        paymentMethod: result['paymentMethod']!,
        paymentPhoneNumber: result['phone'],
      );
      _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Paiement effectué — séance confirmée')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppColors.danger));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = _bookings.where((b) => b.status == 'EN_ATTENTE' || b.status == 'EN_ATTENTE_PAIEMENT').toList();
    final upcoming = _bookings.where((b) => b.status == 'CONFIRMEE' && b.startAt.isAfter(DateTime.now())).toList();
    final past = _bookings.where((b) => !upcoming.contains(b) && !pending.contains(b)).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Mes réservations'), actions: const [LogoutButton()]),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BookingHubScreen()));
          _load();
        },
        icon: const Icon(Icons.add),
        label: const Text('Réserver'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (pending.isEmpty && upcoming.isEmpty && past.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 60),
                      child: Center(child: Text('Aucune réservation pour le moment', style: TextStyle(color: AppColors.ink400))),
                    ),
                  if (pending.isNotEmpty) ...[
                    const Text('En attente', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                    const SizedBox(height: 8),
                    ...pending.map(
                      (b) => _BookingCard(
                        booking: b,
                        onCancel: null,
                        onPay: b.status == 'EN_ATTENTE_PAIEMENT' ? () => _pay(b) : null,
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
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
  final VoidCallback? onPay;
  const _BookingCard({required this.booking, this.onCancel, this.onPay});

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('EEE dd MMM · HH:mm', 'fr_FR');
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
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
                      if (booking.status == 'EN_ATTENTE')
                        const Padding(
                          padding: EdgeInsets.only(top: 4),
                          child: Text('En attente de validation du coach', style: TextStyle(color: AppColors.ink400, fontSize: 12)),
                        ),
                    ],
                  ),
                ),
                StatusBadge(status: booking.status),
                if (onCancel != null)
                  IconButton(icon: const Icon(Icons.close, size: 20, color: AppColors.danger), onPressed: onCancel),
              ],
            ),
            if (onPay != null) ...[
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(onPressed: onPay, child: const Text('Payer pour confirmer')),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PaySeanceSheet extends StatefulWidget {
  const _PaySeanceSheet();

  @override
  State<_PaySeanceSheet> createState() => _PaySeanceSheetState();
}

class _PaySeanceSheetState extends State<_PaySeanceSheet> {
  String _billingMode = 'PAR_SEANCE';
  String _paymentMethod = 'ESPECES';
  final _phoneController = TextEditingController();

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Payer la séance', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
          const SizedBox(height: 16),
          const Text('Formule de facturation', style: TextStyle(fontWeight: FontWeight.w500)),
          RadioListTile<String>(
            value: 'PAR_SEANCE',
            groupValue: _billingMode,
            onChanged: (v) => setState(() => _billingMode = v!),
            title: const Text('Cette séance uniquement'),
            dense: true,
          ),
          RadioListTile<String>(
            value: 'MENSUEL',
            groupValue: _billingMode,
            onChanged: (v) => setState(() => _billingMode = v!),
            title: const Text('Forfait mensuel avec ce coach'),
            dense: true,
          ),
          const SizedBox(height: 8),
          const Text('Moyen de paiement', style: TextStyle(fontWeight: FontWeight.w500)),
          DropdownButtonFormField<String>(
            initialValue: _paymentMethod,
            items: const [
              DropdownMenuItem(value: 'ESPECES', child: Text('Espèces (à la salle)')),
              DropdownMenuItem(value: 'ORANGE_MONEY', child: Text('Orange Money')),
              DropdownMenuItem(value: 'MOOV_MONEY', child: Text('Moov Money')),
              DropdownMenuItem(value: 'WAVE', child: Text('Wave')),
            ],
            onChanged: (v) => setState(() => _paymentMethod = v!),
          ),
          if (_paymentMethod != 'ESPECES') ...[
            const SizedBox(height: 12),
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Numéro Mobile Money'),
            ),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.of(context).pop({
                'billingMode': _billingMode,
                'paymentMethod': _paymentMethod,
                if (_phoneController.text.isNotEmpty) 'phone': _phoneController.text,
              }),
              child: const Text('Confirmer le paiement'),
            ),
          ),
        ],
      ),
    );
  }
}
