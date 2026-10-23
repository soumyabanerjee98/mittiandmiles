import 'package:flutter/widgets.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

const apiBaseUrlKey = 'API_BASE_URL';

/// API origin loaded from `.env` (`API_BASE_URL`). No network client in Phase 1.
class ApiConfig {
  const ApiConfig({required this.baseUrl});

  final String baseUrl;

  static ApiConfig fromEnv() {
    final baseUrl = dotenv.env[apiBaseUrlKey]?.trim();
    if (baseUrl == null || baseUrl.isEmpty) {
      throw StateError(
        '$apiBaseUrlKey is missing or empty. Copy .env.example to .env.',
      );
    }
    return ApiConfig(baseUrl: baseUrl);
  }
}

class ApiConfigScope extends InheritedWidget {
  const ApiConfigScope({
    super.key,
    required this.config,
    required super.child,
  });

  final ApiConfig config;

  static ApiConfig of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<ApiConfigScope>();
    if (scope == null) {
      throw StateError('ApiConfigScope is missing.');
    }
    return scope.config;
  }

  @override
  bool updateShouldNotify(ApiConfigScope oldWidget) {
    return oldWidget.config.baseUrl != config.baseUrl;
  }
}
