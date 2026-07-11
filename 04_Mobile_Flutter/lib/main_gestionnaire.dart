import 'package:flutter/material.dart';
import 'app.dart';
import 'core/config/flavor_config.dart';

void main() {
  FlavorConfig(flavor: AppFlavor.gestionnaire, appName: 'GymCloud Gestionnaire');
  runApp(const GymCloudApp());
}
