import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:mittiandmiles/app/mitti_app.dart';
import 'package:mittiandmiles/core/config/api_config.dart';
import 'package:mittiandmiles/core/network/api_client.dart';
import 'package:mittiandmiles/core/network/http_transport.dart';
import 'package:mittiandmiles/core/session/app_session.dart';
import 'package:mittiandmiles/core/session/secure_token_store.dart';
import 'package:mittiandmiles/data/http_marketplace_api.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');
  final config = ApiConfig.fromEnv();
  final tokens = SecureTokenStore();
  final client = ApiClient(
    baseUrl: config.baseUrl,
    tokens: tokens,
    transport: IoHttpTransport(),
  );
  final session = AppSession(
    api: HttpMarketplaceApi(client, tokens: tokens),
    tokens: tokens,
  );
  client.onSessionExpired = session.expireLocal;
  await session.restore();
  runApp(MittiApp(apiConfig: config, session: session));
}
