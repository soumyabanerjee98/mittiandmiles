import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:mittiandmiles/app/mitti_app.dart';
import 'package:mittiandmiles/core/config/api_config.dart';
import 'package:mittiandmiles/core/session/session_capabilities.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');
  runApp(
    MittiApp(
      apiConfig: ApiConfig.fromEnv(),
      capabilities: SessionCapabilities.unauthorised,
    ),
  );
}
