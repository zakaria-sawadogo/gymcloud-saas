/// §5, §7 — Formule d'abonnement proposée par une salle (pour se
/// réabonner depuis l'app), cours collectif (pour s'y inscrire) et
/// coach (pour demander une séance individuelle/personnalisée).
class AbonnementCatalogue {
  final String id;
  final String name;
  final String? description;
  final int durationDays;
  final double price;
  final String currency;

  AbonnementCatalogue({
    required this.id,
    required this.name,
    this.description,
    required this.durationDays,
    required this.price,
    required this.currency,
  });

  factory AbonnementCatalogue.fromJson(Map<String, dynamic> json) => AbonnementCatalogue(
        id: json['id'],
        name: json['name'],
        description: json['description'],
        durationDays: json['durationDays'],
        price: double.parse(json['price'].toString()),
        currency: json['currency'],
      );
}

class CoursCollectif {
  final String id;
  final String name;
  final DateTime startAt;
  final DateTime endAt;
  final int capacity;
  final int placesRestantes;
  final String? coachName;

  CoursCollectif({
    required this.id,
    required this.name,
    required this.startAt,
    required this.endAt,
    required this.capacity,
    required this.placesRestantes,
    this.coachName,
  });

  factory CoursCollectif.fromJson(Map<String, dynamic> json) {
    final bookingsCount = json['_count']?['bookings'] ?? 0;
    final capacity = json['capacity'] as int;
    return CoursCollectif(
      id: json['id'],
      name: json['name'],
      startAt: DateTime.parse(json['startAt']),
      endAt: DateTime.parse(json['endAt']),
      capacity: capacity,
      placesRestantes: capacity - (bookingsCount as int),
      coachName: json['coach']?['user'] != null
          ? '${json['coach']['user']['firstName'] ?? ''} ${json['coach']['user']['lastName'] ?? ''}'.trim()
          : null,
    );
  }
}

class CoachForBooking {
  final String id;
  final String firstName;
  final String lastName;
  final String? bio;
  final String? photoUrl;
  final List<String> specialties;
  final double? pricePerSession;
  final String? currency;

  CoachForBooking({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.bio,
    this.photoUrl,
    required this.specialties,
    this.pricePerSession,
    this.currency,
  });

  factory CoachForBooking.fromJson(Map<String, dynamic> json) => CoachForBooking(
        id: json['id'],
        firstName: json['firstName'] ?? '',
        lastName: json['lastName'] ?? '',
        bio: json['bio'],
        photoUrl: json['photoUrl'],
        specialties: (json['specialties'] as List?)?.map((e) => e.toString()).toList() ?? [],
        pricePerSession: json['pricePerSession'] != null ? double.parse(json['pricePerSession'].toString()) : null,
        currency: json['currency'],
      );
}

/// §3.2 — Piste commerciale captée depuis le site public d'une salle.
class Prospect {
  final String id;
  final String firstName;
  final String lastName;
  final String phone;
  final String? email;
  final String? message;
  final String source;
  final String status;
  final String? note;
  final String? desiredCatalogueId;
  final String? desiredCatalogueName;

  Prospect({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.phone,
    this.email,
    this.message,
    required this.source,
    required this.status,
    this.note,
    this.desiredCatalogueId,
    this.desiredCatalogueName,
  });

  factory Prospect.fromJson(Map<String, dynamic> json) => Prospect(
        id: json['id'],
        firstName: json['firstName'],
        lastName: json['lastName'],
        phone: json['phone'],
        email: json['email'],
        message: json['message'],
        source: json['source'],
        status: json['status'],
        note: json['note'],
        desiredCatalogueId: json['desiredCatalogueId'],
        desiredCatalogueName: json['desiredCatalogue']?['name'],
      );
}

/// §5.6, §8.3 — Demande de réabonnement initiée par un adhérent depuis
/// l'app mobile, en attente de validation du gestionnaire.
class PendingPayment {
  final String id;
  final String adherentName;
  final double amount;
  final String currency;
  final String method;

  PendingPayment({
    required this.id,
    required this.adherentName,
    required this.amount,
    required this.currency,
    required this.method,
  });

  factory PendingPayment.fromJson(Map<String, dynamic> json) => PendingPayment(
        id: json['id'],
        adherentName: json['adherent']?['user'] != null
            ? '${json['adherent']['user']['firstName']} ${json['adherent']['user']['lastName']}'
            : 'Adhérent',
        amount: double.parse(json['amount'].toString()),
        currency: json['currency'],
        method: json['method'],
      );
}

/// §6.5, §6.14, §14.x — Notification interne, commune aux apps
/// Gestionnaire et Adhérent (chacun ne voit jamais que les siennes,
/// filtrées côté serveur par userId).
class AppNotification {
  final String id;
  final String title;
  final String body;
  final DateTime? readAt;
  final DateTime createdAt;

  AppNotification({
    required this.id,
    required this.title,
    required this.body,
    this.readAt,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) => AppNotification(
        id: json['id'],
        title: json['title'],
        body: json['body'],
        readAt: json['readAt'] != null ? DateTime.parse(json['readAt']) : null,
        createdAt: DateTime.parse(json['createdAt']),
      );
}
