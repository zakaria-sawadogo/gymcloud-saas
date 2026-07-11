class AdherentUserInfo {
  final String firstName;
  final String lastName;
  final String phone;

  AdherentUserInfo({required this.firstName, required this.lastName, required this.phone});

  factory AdherentUserInfo.fromJson(Map<String, dynamic> json) =>
      AdherentUserInfo(firstName: json['firstName'], lastName: json['lastName'], phone: json['phone']);

  String get fullName => '$firstName $lastName';
}

class AdherentProfile {
  final String id;
  final String salleId;
  final String memberCode;
  final String qrCodeToken;
  final String status;
  final DateTime joinedAt;
  final AdherentUserInfo? user;

  AdherentProfile({
    required this.id,
    required this.salleId,
    required this.memberCode,
    required this.qrCodeToken,
    required this.status,
    required this.joinedAt,
    this.user,
  });

  factory AdherentProfile.fromJson(Map<String, dynamic> json) => AdherentProfile(
        id: json['id'],
        salleId: json['salleId'],
        memberCode: json['memberCode'],
        qrCodeToken: json['qrCodeToken'],
        status: json['status'],
        joinedAt: DateTime.parse(json['joinedAt']),
        user: json['user'] != null ? AdherentUserInfo.fromJson(json['user']) : null,
      );
}

class AdherentAbonnement {
  final String id;
  final DateTime startDate;
  final DateTime endDate;
  final String status;
  final bool isRenewal;
  final String? catalogueName;

  AdherentAbonnement({
    required this.id,
    required this.startDate,
    required this.endDate,
    required this.status,
    required this.isRenewal,
    this.catalogueName,
  });

  factory AdherentAbonnement.fromJson(Map<String, dynamic> json) => AdherentAbonnement(
        id: json['id'],
        startDate: DateTime.parse(json['startDate']),
        endDate: DateTime.parse(json['endDate']),
        status: json['status'],
        isRenewal: json['isRenewal'] ?? false,
        catalogueName: json['abonnementCatalogue']?['name'],
      );

  int get daysRemaining => endDate.difference(DateTime.now()).inDays;
}

class Booking {
  final String id;
  final String type;
  final String status;
  final DateTime startAt;
  final DateTime endAt;
  final String? coursName;
  final String? coachName;

  Booking({
    required this.id,
    required this.type,
    required this.status,
    required this.startAt,
    required this.endAt,
    this.coursName,
    this.coachName,
  });

  factory Booking.fromJson(Map<String, dynamic> json) => Booking(
        id: json['id'],
        type: json['type'],
        status: json['status'],
        startAt: DateTime.parse(json['startAt']),
        endAt: DateTime.parse(json['endAt']),
        coursName: json['coursCollectif']?['name'],
        coachName: json['coach'] != null
            ? '${json['coach']['user']['firstName']} ${json['coach']['user']['lastName']}'
            : null,
      );
}

class Payment {
  final String id;
  final String type;
  final double amount;
  final String currency;
  final String method;
  final String status;
  final DateTime createdAt;

  Payment({
    required this.id,
    required this.type,
    required this.amount,
    required this.currency,
    required this.method,
    required this.status,
    required this.createdAt,
  });

  factory Payment.fromJson(Map<String, dynamic> json) => Payment(
        id: json['id'],
        type: json['type'],
        amount: (json['amount'] as num).toDouble(),
        currency: json['currency'],
        method: json['method'],
        status: json['status'],
        createdAt: DateTime.parse(json['createdAt']),
      );
}
