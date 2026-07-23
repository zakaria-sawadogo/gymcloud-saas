import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/salle_extras.dart';
import '../adherent_repository.dart';

/// §7.2, §7.4, §7.6 — Deux façons de réserver : rejoindre un cours
/// collectif déjà planifié, ou demander une séance personnalisée
/// (individuelle) avec le coach de son choix.
class BookingHubScreen extends StatelessWidget {
  const BookingHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Réserver'),
          bottom: const TabBar(tabs: [Tab(text: 'Cours collectifs'), Tab(text: 'Séance personnalisée')]),
        ),
        body: const TabBarView(children: [_CoursCollectifsTab(), _SeancePersonnaliseeTab()]),
      ),
    );
  }
}

class _CoursCollectifsTab extends StatefulWidget {
  const _CoursCollectifsTab();

  @override
  State<_CoursCollectifsTab> createState() => _CoursCollectifsTabState();
}

class _CoursCollectifsTabState extends State<_CoursCollectifsTab> {
  late final AdherentRepository _repo;
  List<CoursCollectif> _cours = [];
  bool _isLoading = true;
  String? _bookingCoursId;

  @override
  void initState() {
    super.initState();
    _repo = AdherentRepository(context.read());
    _load();
  }

  Future<void> _load() async {
    final salleId = context.read<AuthProvider>().user?.salle?.id;
    if (salleId == null) return;
    setState(() => _isLoading = true);
    try {
      final now = DateTime.now();
      final cours = await _repo.getCoursCollectifs(salleId, from: now, to: now.add(const Duration(days: 14)));
      setState(() => _cours = cours);
    } catch (_) {
      // Salle sans module réservations, ou hors ligne — liste vide.
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _book(CoursCollectif c) async {
    final adherentId = context.read<AuthProvider>().user?.adherentId;
    if (adherentId == null) return;
    setState(() => _bookingCoursId = c.id);
    try {
      final result = await _repo.bookCoursCollectif(c.id, adherentId);
      if (mounted) {
        final onWaitingList = result['status'] == 'LISTE_ATTENTE';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              onWaitingList
                  ? 'Cours complet — vous êtes en liste d\'attente (position ${result['position']})'
                  : 'Réservation confirmée pour "${c.name}"',
            ),
          ),
        );
        _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _bookingCoursId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_cours.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Aucun cours prévu dans les 14 prochains jours.', style: TextStyle(color: AppColors.ink400)),
        ),
      );
    }
    final dateFormat = DateFormat('EEE dd MMM · HH:mm', 'fr_FR');
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _cours.length,
        itemBuilder: (context, i) {
          final c = _cours[i];
          final isFull = c.placesRestantes <= 0;
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text(
                '${dateFormat.format(c.startAt)}${c.coachName != null ? ' · ${c.coachName}' : ''}\n'
                '${isFull ? 'Complet' : '${c.placesRestantes} place(s) restante(s)'}',
              ),
              isThreeLine: true,
              trailing: _bookingCoursId == c.id
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : ElevatedButton(
                      onPressed: () => _book(c),
                      style: isFull ? ElevatedButton.styleFrom(backgroundColor: AppColors.ink400) : null,
                      child: Text(isFull ? 'File d\'attente' : 'Réserver'),
                    ),
            ),
          );
        },
      ),
    );
  }
}

class _SeancePersonnaliseeTab extends StatefulWidget {
  const _SeancePersonnaliseeTab();

  @override
  State<_SeancePersonnaliseeTab> createState() => _SeancePersonnaliseeTabState();
}

class _SeancePersonnaliseeTabState extends State<_SeancePersonnaliseeTab> {
  late final AdherentRepository _repo;
  List<CoachForBooking> _coachs = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _repo = AdherentRepository(context.read());
    _load();
  }

  Future<void> _load() async {
    final salleId = context.read<AuthProvider>().user?.salle?.id;
    if (salleId == null) return;
    setState(() => _isLoading = true);
    try {
      final coachs = await _repo.getCoachsForBooking(salleId);
      setState(() => _coachs = coachs);
    } catch (_) {
      // Salle sans module réservations — liste vide.
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _requestSession(CoachForBooking coach) async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 60)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 10, minute: 0));
    if (time == null || !mounted) return;

    final startAt = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    final endAt = startAt.add(const Duration(hours: 1));

    final salleId = context.read<AuthProvider>().user?.salle?.id;
    final adherentId = context.read<AuthProvider>().user?.adherentId;
    if (salleId == null || adherentId == null) return;

    try {
      await _repo.bookSeanceIndividuelle(
        salleId: salleId,
        adherentId: adherentId,
        coachId: coach.id,
        startAt: startAt,
        endAt: endAt,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Demande envoyée à ${coach.firstName} pour le ${DateFormat('dd MMM à HH:mm', 'fr_FR').format(startAt)}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_coachs.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Aucun coach disponible pour une séance personnalisée pour le moment.', style: TextStyle(color: AppColors.ink400)),
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _coachs.length,
      itemBuilder: (context, i) {
        final c = _coachs[i];
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: CircleAvatar(
              backgroundImage: c.photoUrl != null ? NetworkImage(c.photoUrl!) : null,
              child: c.photoUrl == null ? Text(c.firstName.isNotEmpty ? c.firstName[0] : '?') : null,
            ),
            title: Text('${c.firstName} ${c.lastName}', style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(
              [
                if (c.specialties.isNotEmpty) c.specialties.join(', '),
                if (c.pricePerSession != null) '${c.pricePerSession!.toStringAsFixed(0)} ${c.currency ?? ''}/séance',
              ].join(' · '),
            ),
            trailing: ElevatedButton(
              onPressed: () => _requestSession(c),
              child: const Text('Demander'),
            ),
          ),
        );
      },
    );
  }
}
