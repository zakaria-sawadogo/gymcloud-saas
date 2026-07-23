import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../core/models/adherent.dart';
import '../gestionnaire_repository.dart';
import '../../shared/logout_button.dart';

class AdherentsListScreen extends StatefulWidget {
  const AdherentsListScreen({super.key});

  @override
  State<AdherentsListScreen> createState() => _AdherentsListScreenState();
}

class _AdherentsListScreenState extends State<AdherentsListScreen> {
  late final GestionnaireRepository _repo;
  List<AdherentProfile> _adherents = [];
  bool _isLoading = true;
  String _search = '';

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
    final adherents = await _repo.getAdherents(salleId);
    setState(() {
      _adherents = adherents;
      _isLoading = false;
    });
  }

  List<AdherentProfile> get _filtered {
    if (_search.isEmpty) return _adherents;
    final q = _search.toLowerCase();
    return _adherents.where((a) {
      return (a.user?.fullName.toLowerCase().contains(q) ?? false) ||
          a.memberCode.toLowerCase().contains(q) ||
          (a.user?.phone.contains(q) ?? false);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Adhérents'),
        actions: const [LogoutButton()],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: TextField(
              onChanged: (v) => setState(() => _search = v),
              decoration: InputDecoration(
                hintText: 'Rechercher...',
                prefixIcon: const Icon(Icons.search, size: 20),
                isDense: true,
                filled: true,
                fillColor: AppColors.ink50,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
            ),
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _filtered.isEmpty
                  ? ListView(
                      children: const [
                        Padding(
                          padding: EdgeInsets.only(top: 60),
                          child: Center(child: Text('Aucun adhérent trouvé', style: TextStyle(color: AppColors.ink400))),
                        ),
                      ],
                    )
                  : ListView.builder(
                      itemCount: _filtered.length,
                      itemBuilder: (context, i) {
                        final a = _filtered[i];
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: AppColors.primaryLight,
                            child: Text(
                              a.user?.firstName.substring(0, 1) ?? '?',
                              style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600),
                            ),
                          ),
                          title: Text(a.user?.fullName ?? a.memberCode),
                          subtitle: Text('${a.memberCode} · ${a.user?.phone ?? ''}'),
                          trailing: StatusBadge(status: a.status),
                        );
                      },
                    ),
            ),
    );
  }
}
