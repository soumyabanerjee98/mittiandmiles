import 'package:flutter/material.dart';
import 'package:mittiandmiles/core/config/api_config.dart';
import 'package:mittiandmiles/core/session/app_session.dart';
import 'package:mittiandmiles/core/session/app_session_scope.dart';
import 'package:mittiandmiles/core/theme/app_theme.dart';
import 'package:mittiandmiles/features/shell/app_shell.dart';

class MittiApp extends StatelessWidget {
  const MittiApp({
    super.key,
    required this.apiConfig,
    required this.session,
  });

  final ApiConfig apiConfig;
  final AppSession session;

  @override
  Widget build(BuildContext context) {
    return ApiConfigScope(
      config: apiConfig,
      child: AppSessionScope(
        session: session,
        child: MaterialApp(
          title: 'Mitti and Miles',
          theme: buildAppTheme(),
          home: const AppShell(),
        ),
      ),
    );
  }
}
