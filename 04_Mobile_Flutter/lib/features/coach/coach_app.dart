import 'package:flutter/material.dart';
import 'screens/planning_screen.dart';
import 'screens/availability_screen.dart';

class CoachApp extends StatefulWidget {
  const CoachApp({super.key});

  @override
  State<CoachApp> createState() => _CoachAppState();
}

class _CoachAppState extends State<CoachApp> {
  int _currentIndex = 0;

  final _screens = const [PlanningScreen(), AvailabilityScreen()];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _screens),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.event_outlined), activeIcon: Icon(Icons.event), label: 'Planning'),
          BottomNavigationBarItem(icon: Icon(Icons.schedule_outlined), activeIcon: Icon(Icons.schedule), label: 'Disponibilités'),
        ],
      ),
    );
  }
}
