import 'package:flutter/material.dart';
import 'app.dart';
import 'core/config/flavor_config.dart';

void main() {
  FlavorConfig(flavor: AppFlavor.adherent, appName: 'GymCloud Adhérent');
  runApp(const GymCloudApp());
}
