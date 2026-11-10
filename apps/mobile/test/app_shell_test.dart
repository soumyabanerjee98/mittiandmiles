import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mittiandmiles/app/mitti_app.dart';
import 'package:mittiandmiles/core/config/api_config.dart';
import 'package:mittiandmiles/core/session/app_session.dart';
import 'package:mittiandmiles/core/session/session_capabilities.dart';
import 'package:mittiandmiles/core/session/token_store.dart';
import 'package:mittiandmiles/data/models.dart';
import 'package:mittiandmiles/features/admin/admin_gate.dart';

import 'support/scripted_api.dart';

const testApiConfig = ApiConfig(baseUrl: 'http://localhost:3000');

void main() {
  testWidgets('default session shows traveller and host and hides admin', (tester) async {
    final api = ScriptedApi();
    await tester.pumpWidget(
      MittiApp(
        apiConfig: testApiConfig,
        session: AppSession(api: api, tokens: MemoryTokenStore()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Traveller'), findsWidgets);
    expect(find.text('Discover'), findsOneWidget);
    expect(find.text('No published experiences match these filters.'), findsOneWidget);
    expect(find.text('Host'), findsOneWidget);
    expect(find.text('Admin'), findsNothing);

    await tester.tap(find.text('Host'));
    await tester.pumpAndSettle();

    expect(
      find.text(
        'Sign in with a host account. The server assigns the host role; this app cannot grant it.',
      ),
      findsOneWidget,
    );
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
    final api = ScriptedApi();
    await tester.pumpWidget(
      MittiApp(
        apiConfig: testApiConfig,
        session: AppSession(
          api: api,
          tokens: MemoryTokenStore(),
          initialAccount: const Account(
            id: '11111111-1111-4111-8111-111111111111',
            email: 'ada@example.com',
            accountStatus: 'ACTIVE',
            locale: 'en',
            roles: ['OPERATIONS'],
            adminAccess: true,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Admin'), findsOneWidget);
    await tester.tap(find.text('Admin'));
    await tester.pumpAndSettle();

    expect(find.text('Admin tools are not available in this build.'), findsOneWidget);
    expect(find.text('Host verification'), findsNothing);
  });

  testWidgets('api config exposes the injected base url', (tester) async {
    final api = ScriptedApi();
    await tester.pumpWidget(
      MittiApp(
        apiConfig: testApiConfig,
        session: AppSession(api: api, tokens: MemoryTokenStore()),
      ),
    );
    await tester.pump();
    final context = tester.element(find.text('Traveller').first);
    expect(ApiConfigScope.of(context).baseUrl, testApiConfig.baseUrl);
  });
}
