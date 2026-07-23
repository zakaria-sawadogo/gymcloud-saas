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
