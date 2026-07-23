/// Miroir de la réponse GET /auth/me (backend). Contient le strict
/// nécessaire à l'affichage : le JWT lui-même ne porte que roleCode et
/// salleId pour l'autorisation, pas le profil complet.
class CurrentUser {
  final String userId;
  final String firstName;
  final String lastName;
  final String phone;
  final String? email;
  final String roleCode;
  final String? proprietaireId;
  final String? adherentId;
  final String? coachId;
  final String? gestionnaireId;
  final SalleSummary? salle;

  CurrentUser({
    required this.userId,
    required this.firstName,
    required this.lastName,
    required this.phone,
    this.email,
    required this.roleCode,
    this.proprietaireId,
    this.adherentId,
    this.coachId,
    this.gestionnaireId,
    this.salle,
  });

  factory CurrentUser.fromJson(Map<String, dynamic> json) => CurrentUser(
        userId: json['userId'],
        firstName: json['firstName'],
        lastName: json['lastName'],
        phone: json['phone'],
        email: json['email'],
        roleCode: json['roleCode'],
        proprietaireId: json['proprietaireId'],
        adherentId: json['adherentId'],
        coachId: json['coachId'],
        gestionnaireId: json['gestionnaireId'],
        salle: json['salle'] != null ? SalleSummary.fromJson(json['salle']) : null,
      );

  String get fullName => '$firstName $lastName';
}

class SalleSummary {
  final String id;
  final String name;
  final String? logoUrl;
  final String? currency;
  final String? publicSubdomain;

  SalleSummary({required this.id, required this.name, this.logoUrl, this.currency, this.publicSubdomain});

  factory SalleSummary.fromJson(Map<String, dynamic> json) => SalleSummary(
        id: json['id'],
        name: json['name'],
        logoUrl: json['logoUrl'],
        currency: json['currency'],
        publicSubdomain: json['publicSubdomain'],
      );
}
