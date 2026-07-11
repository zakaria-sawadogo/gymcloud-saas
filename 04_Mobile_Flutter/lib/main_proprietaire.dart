import 'package:flutter/material.dart';
import 'app.dart';
import 'core/config/flavor_config.dart';

void main() {
  FlavorConfig(flavor: AppFlavor.proprietaire, appName: 'GymCloud Propriétaire');
  runApp(const GymCloudApp());
}
