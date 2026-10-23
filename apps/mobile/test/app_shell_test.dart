import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mittiandmiles/app/mitti_app.dart';
import 'package:mittiandmiles/core/config/api_config.dart';
import 'package:mittiandmiles/core/session/session_capabilities.dart';
import 'package:mittiandmiles/features/admin/admin_gate.dart';

const testApiConfig = ApiConfig(baseUrl: 'http://localhost:3000');

void main() {
  testWidgets('default session shows traveller and host and hides admin', (tester) async {
    await tester.pumpWidget(const MittiApp(apiConfig: testApiConfig));

    expect(find.text('Traveller'), findsWidgets);
    expect(find.text('Discover local experiences. Listings are not available in this build.'), findsOneWidget);
    expect(find.text('Host'), findsOneWidget);
    expect(find.text('Admin'), findsNothing);

    await tester.tap(find.text('Host'));
    await tester.pumpAndSettle();

    expect(find.text('Host tools will be added in a later phase.'), findsOneWidget);
  });

  testWidgets('admin gate denies access without server capability', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: AdminGate(capabilities: SessionCapabilities.unauthorised),
      ),
    );

    expect(find.text('You do not have admin access.'), findsOneWidget);
    expect(find.text('Admin tools are not available in this build.'), findsNothing);
  });

  testWidgets('server-granted admin shows a placeholder without workflows', (tester) async {
    await tester.pumpWidget(
      const MittiApp(
        apiConfig: testApiConfig,
        capabilities: SessionCapabilities(adminAccess: true),
      ),
    );

    expect(find.text('Admin'), findsOneWidget);
    await tester.tap(find.text('Admin'));
    await tester.pumpAndSettle();

    expect(find.text('Admin tools are not available in this build.'), findsOneWidget);
    expect(find.text('Host verification'), findsNothing);
  });

  testWidgets('api config exposes the injected base url', (tester) async {
    await tester.pumpWidget(const MittiApp(apiConfig: testApiConfig));
    final context = tester.element(find.text('Traveller').first);
    expect(ApiConfigScope.of(context).baseUrl, testApiConfig.baseUrl);
  });
}
