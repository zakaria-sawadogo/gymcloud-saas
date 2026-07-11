class CoachAvailability {
  final String id;
  final int dayOfWeek; // 0 = dimanche ... 6 = samedi
  final String startTime; // "08:00"
  final String endTime;

  CoachAvailability({
    required this.id,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
  });

  factory CoachAvailability.fromJson(Map<String, dynamic> json) => CoachAvailability(
        id: json['id'],
        dayOfWeek: json['dayOfWeek'],
        startTime: json['startTime'],
        endTime: json['endTime'],
      );

  static const List<String> dayNames = [
    'Dimanche',
    'Lundi',
    'Mardi',
    'Mercredi',
    'Jeudi',
    'Vendredi',
    'Samedi',
  ];

  String get dayName => dayNames[dayOfWeek];
}
