import 'package:flutter/widgets.dart';
import 'package:mittiandmiles/core/session/app_session.dart';

class AppSessionScope extends InheritedNotifier<AppSession> {
  const AppSessionScope({
    super.key,
    required AppSession session,
    required super.child,
  }) : super(notifier: session);

  static AppSession of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppSessionScope>();
    if (scope == null || scope.notifier == null) {
      throw StateError('AppSessionScope is missing.');
    }
    return scope.notifier!;
  }
}
