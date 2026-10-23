import 'package:flutter/material.dart';
import 'package:mittiandmiles/core/config/api_config.dart';
import 'package:mittiandmiles/core/session/session_capabilities.dart';
import 'package:mittiandmiles/core/theme/app_theme.dart';
import 'package:mittiandmiles/features/shell/app_shell.dart';

class MittiApp extends StatelessWidget {
  const MittiApp({
    super.key,
    required this.apiConfig,
    this.capabilities = SessionCapabilities.unauthorised,
  });

  /// Server-issued capabilities. Defaults to deny. There is no client control
  /// that can grant admin access.
  final SessionCapabilities capabilities;
  final ApiConfig apiConfig;

  @override
  Widget build(BuildContext context) {
    return ApiConfigScope(
      config: apiConfig,
      child: MaterialApp(
        title: 'Mitti and Miles',
        theme: buildAppTheme(),
        home: AppShell(capabilities: capabilities),
      ),
    );
  }
}
