import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/auth/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../gestionnaire_repository.dart';
import '../../shared/logout_button.dart';
import '../../shared/notification_bell.dart';

const Map<String, String> _paymentMethodLabels = {
  'ESPECES': 'Espèces',
  'ORANGE_MONEY': 'Orange Money',
  'MOOV_MONEY': 'Moov Money',
  'WAVE': 'Wave',
  'CARTE_BANCAIRE': 'Carte bancaire',
  'VIREMENT': 'Virement',
};

/// §14.x — Mini caisse boutique : vente au comptoir, catalogue,
/// caisse journalière — équivalent mobile de la page web /boutique.
class BoutiqueScreen extends StatefulWidget {
  const BoutiqueScreen({super.key});

  @override
  State<BoutiqueScreen> createState() => _BoutiqueScreenState();
}

class _BoutiqueScreenState extends State<BoutiqueScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  late final GestionnaireRepository _repo;
  List<Map<String, dynamic>> _products = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _repo = GestionnaireRepository(context.read());
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String? get _salleId => context.read<AuthProvider>().user?.salle?.id;

  Future<void> _load() async {
    final salleId = _salleId;
    if (salleId == null) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final products = await _repo.getBoutiqueProducts(salleId);
      setState(() => _products = products);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final salleId = _salleId;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Boutique'),
        actions: const [NotificationBell(), LogoutButton()],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Vendre'),
            Tab(text: 'Catalogue'),
            Tab(text: 'Caisse'),
          ],
        ),
      ),
      body: salleId == null
          ? const SizedBox.shrink()
          : _isLoading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          _error!.contains('non actif')
                              ? "L'add-on Boutique n'est pas actif pour cette salle."
                              : _error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.danger),
                        ),
                      ),
                    )
                  : TabBarView(
                      controller: _tabController,
                      children: [
                        _SellTab(repo: _repo, salleId: salleId, products: _products, onSold: _load),
                        _CatalogueTab(repo: _repo, salleId: salleId, products: _products, onChanged: _load),
                        _CaisseTab(repo: _repo, salleId: salleId),
                      ],
                    ),
    );
  }
}

class _SellTab extends StatefulWidget {
  final GestionnaireRepository repo;
  final String salleId;
  final List<Map<String, dynamic>> products;
  final VoidCallback onSold;
  const _SellTab({required this.repo, required this.salleId, required this.products, required this.onSold});

  @override
  State<_SellTab> createState() => _SellTabState();
}

class _SellTabState extends State<_SellTab> {
  String? _productId;
  int _quantity = 1;
  String _paymentMethod = 'ESPECES';
  bool _isSubmitting = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(locale: 'fr_FR', symbol: 'FCFA', decimalDigits: 0);
    final available = widget.products
        .where((p) => p['active'] == true && (p['stockQty'] as num) > 0)
        .toList();
    final selectedMatches = available.where((p) => p['id'] == _productId);
    final selected = selectedMatches.isEmpty ? null : selectedMatches.first;
    final unitPrice = selected != null ? double.parse((selected['price'] ?? 0).toString()) : 0.0;
    final total = unitPrice * _quantity;

    if (available.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Aucun produit en stock à vendre', style: TextStyle(color: AppColors.ink400)),
        ),
      );
    }

    Future<void> submit() async {
      if (_productId == null) return;
      setState(() {
        _isSubmitting = true;
        _error = null;
      });
      try {
        await widget.repo.recordBoutiqueSale(
          salleId: widget.salleId,
          productId: _productId!,
          quantity: _quantity,
          paymentMethod: _paymentMethod,
        );
        setState(() {
          _productId = null;
          _quantity = 1;
        });
        widget.onSold();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Vente enregistrée')));
        }
      } catch (e) {
        setState(() => _error = '$e');
      } finally {
        setState(() => _isSubmitting = false);
      }
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Produit', style: TextStyle(fontSize: 13, color: AppColors.ink600)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          initialValue: _productId,
          decoration: const InputDecoration(border: OutlineInputBorder(), isDense: true),
          hint: const Text('Sélectionner un produit'),
          items: available
              .map(
                (p) => DropdownMenuItem(
                  value: p['id'] as String,
                  child: Text(
                    '${p['name']} — ${currencyFormat.format(double.parse((p['price'] ?? 0).toString()))} (stock : ${p['stockQty']})',
                  ),
                ),
              )
              .toList(),
          onChanged: (value) => setState(() => _productId = value),
        ),
        const SizedBox(height: 16),
        const Text('Quantité', style: TextStyle(fontSize: 13, color: AppColors.ink600)),
        const SizedBox(height: 6),
        Row(
          children: [
            IconButton(
              icon: const Icon(Icons.remove_circle_outline),
              onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null,
            ),
            Text('$_quantity', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            IconButton(
              icon: const Icon(Icons.add_circle_outline),
              onPressed: selected != null && _quantity < (selected['stockQty'] as num)
                  ? () => setState(() => _quantity++)
                  : null,
            ),
          ],
        ),
        const SizedBox(height: 16),
        const Text('Moyen de paiement', style: TextStyle(fontSize: 13, color: AppColors.ink600)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          initialValue: _paymentMethod,
          decoration: const InputDecoration(border: OutlineInputBorder(), isDense: true),
          items: _paymentMethodLabels.entries
              .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
              .toList(),
          onChanged: (value) => setState(() => _paymentMethod = value ?? 'ESPECES'),
        ),
        if (_productId != null) ...[
          const SizedBox(height: 16),
          Text('Total : ${currencyFormat.format(total)}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        ],
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: const TextStyle(color: AppColors.danger)),
        ],
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: _productId == null || _isSubmitting ? null : submit,
          child: _isSubmitting
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Enregistrer la vente'),
        ),
      ],
    );
  }
}

class _CatalogueTab extends StatelessWidget {
  final GestionnaireRepository repo;
  final String salleId;
  final List<Map<String, dynamic>> products;
  final VoidCallback onChanged;
  const _CatalogueTab({required this.repo, required this.salleId, required this.products, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(locale: 'fr_FR', symbol: 'FCFA', decimalDigits: 0);
    return Scaffold(
      body: products.isEmpty
          ? const Center(
              child: Text('Aucun produit pour le moment', style: TextStyle(color: AppColors.ink400)),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: products.length,
              itemBuilder: (context, i) {
                final p = products[i];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text('${p['name']}${p['active'] == false ? ' (désactivé)' : ''}'),
                    subtitle: Text(
                      '${currencyFormat.format(double.parse((p['price'] ?? 0).toString()))} · stock : ${p['stockQty']}',
                    ),
                    trailing: IconButton(
                      icon: const Icon(Icons.edit_outlined),
                      onPressed: () => _openEdit(context, p),
                    ),
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openCreate(context),
        icon: const Icon(Icons.add),
        label: const Text('Nouveau produit'),
      ),
    );
  }

  Future<void> _openCreate(BuildContext context) async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ProductFormSheet(repo: repo, salleId: salleId),
    );
    if (created == true) onChanged();
  }

  Future<void> _openEdit(BuildContext context, Map<String, dynamic> product) async {
    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ProductFormSheet(repo: repo, salleId: salleId, product: product),
    );
    if (updated == true) onChanged();
  }
}

class _ProductFormSheet extends StatefulWidget {
  final GestionnaireRepository repo;
  final String salleId;
  final Map<String, dynamic>? product;
  const _ProductFormSheet({required this.repo, required this.salleId, this.product});

  @override
  State<_ProductFormSheet> createState() => _ProductFormSheetState();
}

class _ProductFormSheetState extends State<_ProductFormSheet> {
  late final TextEditingController _nameController;
  late final TextEditingController _priceController;
  late final TextEditingController _stockController;
  late bool _active;
  bool _isSubmitting = false;
  String? _error;

  bool get _isEditing => widget.product != null;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.product?['name'] ?? '');
    _priceController = TextEditingController(text: widget.product != null ? '${widget.product!['price']}' : '');
    _stockController = TextEditingController(text: widget.product != null ? '${widget.product!['stockQty']}' : '0');
    _active = widget.product?['active'] ?? true;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    _stockController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      if (_isEditing) {
        await widget.repo.updateBoutiqueProduct(
          salleId: widget.salleId,
          productId: widget.product!['id'],
          name: _nameController.text.trim(),
          price: num.tryParse(_priceController.text) ?? 0,
          stockQty: int.tryParse(_stockController.text) ?? 0,
          active: _active,
        );
      } else {
        await widget.repo.createBoutiqueProduct(
          salleId: widget.salleId,
          name: _nameController.text.trim(),
          price: num.tryParse(_priceController.text) ?? 0,
          stockQty: int.tryParse(_stockController.text) ?? 0,
        );
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
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
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            _isEditing ? 'Modifier le produit' : 'Nouveau produit',
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
          ),
          const SizedBox(height: 16),
          TextField(controller: _nameController, decoration: const InputDecoration(labelText: 'Nom')),
          const SizedBox(height: 12),
          TextField(
            controller: _priceController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Prix (XOF)'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _stockController,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(labelText: _isEditing ? 'Stock' : 'Stock initial'),
          ),
          if (_isEditing) ...[
            const SizedBox(height: 8),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Produit actif (vendable)'),
              value: _active,
              onChanged: (value) => setState(() => _active = value),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: AppColors.danger)),
          ],
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _isSubmitting ? null : _submit,
            child: _isSubmitting
                ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(_isEditing ? 'Enregistrer' : 'Créer'),
          ),
        ],
      ),
    );
  }
}

class _CaisseTab extends StatefulWidget {
  final GestionnaireRepository repo;
  final String salleId;
  const _CaisseTab({required this.repo, required this.salleId});

  @override
  State<_CaisseTab> createState() => _CaisseTabState();
}

class _CaisseTabState extends State<_CaisseTab> {
  Map<String, dynamic>? _caisse;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final caisse = await widget.repo.getBoutiqueCaisse(widget.salleId);
      setState(() => _caisse = caisse);
    } catch (_) {
      // laisse _caisse à null — l'utilisateur peut tirer pour rafraîchir
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(locale: 'fr_FR', symbol: 'FCFA', decimalDigits: 0);
    if (_isLoading) return const Center(child: CircularProgressIndicator());

    final byMethod = (_caisse?['byMethod'] as Map<String, dynamic>?) ?? {};
    final total = double.parse((_caisse?['total'] ?? 0).toString());
    final salesCount = _caisse?['salesCount'] ?? 0;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Ventes aujourd\'hui', style: TextStyle(color: AppColors.ink400, fontSize: 13)),
                  Text('$salesCount', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 12),
                  const Text('Total encaissé', style: TextStyle(color: AppColors.ink400, fontSize: 13)),
                  Text(
                    currencyFormat.format(total),
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (byMethod.isNotEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Par moyen de paiement', style: TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    ...byMethod.entries.map(
                      (e) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(_paymentMethodLabels[e.key] ?? e.key),
                            Text(
                              currencyFormat.format(double.parse(e.value.toString())),
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
