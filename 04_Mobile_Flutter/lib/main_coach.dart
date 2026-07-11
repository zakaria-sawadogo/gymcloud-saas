import 'package:flutter/material.dart';
import 'app.dart';
import 'core/config/flavor_config.dart';

void main() {
  FlavorConfig(flavor: AppFlavor.coach, appName: 'GymCloud Coach');
  runApp(const GymCloudApp());
}
