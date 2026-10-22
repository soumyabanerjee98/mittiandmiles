import 'package:flutter/widgets.dart';

/// Development API origin. No network client is attached in Phase 1.
class ApiConfig {
  const ApiConfig({this.baseUrl = 'http://localhost:3000'});

  final String baseUrl;
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
