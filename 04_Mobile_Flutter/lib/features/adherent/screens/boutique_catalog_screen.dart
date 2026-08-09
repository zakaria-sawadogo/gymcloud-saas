import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/currency_format.dart';
import '../adherent_repository.dart';

/// §14.x — Catalogue boutique consultable par l'adhérent : ce qui est
/// disponible et son prix, pour savoir avant d'arriver ce qu'on peut
/// prendre. Le paiement reste au comptoir — aucune action d'achat ici.
class BoutiqueCatalogScreen extends StatefulWidget {
  final String salleId;
  const BoutiqueCatalogScreen({super.key, required this.salleId});

  @override
  State<BoutiqueCatalogScreen> createState() => _BoutiqueCatalogScreenState();
}

class _BoutiqueCatalogScreenState extends State<BoutiqueCatalogScreen> {
  late final AdherentRepository _repo;
  List<Map<String, dynamic>> _products = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _repo = AdherentRepository(context.read());
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final products = await _repo.getBoutiqueProducts(widget.salleId);
      setState(() => _products = products);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = currencyFormatFor(context.watch<AuthProvider>().user?.salle?.currency);
    final available = _products.where((p) => p['active'] == true && (p['stockQty'] as num) > 0).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Boutique')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      _error!.contains('non actif')
                          ? "La boutique n'est pas disponible pour cette salle."
                          : _error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.danger),
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: available.isEmpty
                      ? ListView(
                          children: const [
                            Padding(
                              padding: EdgeInsets.all(24),
                              child: Center(
                                child: Text(
                                  'Rien de disponible pour le moment',
                                  style: TextStyle(color: AppColors.ink400),
                                ),
                              ),
                            ),
                          ],
                        )
                      : ListView(
                          padding: const EdgeInsets.all(16),
                          children: [
                            const Padding(
                              padding: EdgeInsets.only(bottom: 12),
                              child: Text(
                                'Disponible au comptoir — le paiement se fait sur place.',
                                style: TextStyle(fontSize: 13, color: AppColors.ink400),
                              ),
                            ),
                            ...available.map((p) {
                              final imageUrl = p['imageUrl'] as String?;
                              return Card(
                                margin: const EdgeInsets.only(bottom: 10),
                                child: ListTile(
                                  contentPadding: const EdgeInsets.all(10),
                                  leading: imageUrl != null
                                      ? ClipRRect(
                                          borderRadius: BorderRadius.circular(8),
                                          child: Image.network(
                                            imageUrl,
                                            width: 48,
                                            height: 48,
                                            fit: BoxFit.cover,
                                          ),
                                        )
                                      : Container(
                                          width: 48,
                                          height: 48,
                                          decoration: BoxDecoration(
                                            color: AppColors.primary.withValues(alpha: 0.1),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Icon(Icons.shopping_bag_outlined, color: AppColors.primary),
                                        ),
                                  title: Text(p['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                                  trailing: Text(
                                    currencyFormat.format(double.parse((p['price'] ?? 0).toString())),
                                    style: const TextStyle(fontWeight: FontWeight.w700),
                                  ),
                                ),
                              );
                            }),
                          ],
                        ),
                ),
    );
  }
}
