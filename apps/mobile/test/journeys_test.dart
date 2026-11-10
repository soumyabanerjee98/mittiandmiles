import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mittiandmiles/core/network/api_exception.dart';
import 'package:mittiandmiles/core/session/app_session.dart';
import 'package:mittiandmiles/core/session/app_session_scope.dart';
import 'package:mittiandmiles/core/session/token_store.dart';
import 'package:mittiandmiles/core/theme/app_theme.dart';
import 'package:mittiandmiles/data/models.dart';
import 'package:mittiandmiles/features/discovery/discovery_page.dart';
import 'package:mittiandmiles/features/discovery/experience_page.dart';
import 'package:mittiandmiles/features/bookings/checkout_page.dart';
import 'package:mittiandmiles/features/bookings/razorpay_checkout.dart';
import 'package:mittiandmiles/features/host/host_dashboard.dart';
import 'package:mittiandmiles/features/support/unavailable_journey_page.dart';

import 'support/scripted_api.dart';

void main() {
  testWidgets('discovery shows an error and retries', (tester) async {
    final api = ScriptedApi()
      ..searchError = const ApiException(
        statusCode: 503,
        code: 'CATALOGUE_UNAVAILABLE',
        message: 'Catalogue unavailable.',
        requestId: 'req-1',
      );
    await tester.pumpWidget(_app(api));
    await tester.pumpAndSettle();

    expect(find.textContaining('Catalogue unavailable.'), findsOneWidget);
    expect(find.textContaining('req-1'), findsOneWidget);

    api.searchError = null;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();

    expect(find.text('No published experiences match these filters.'), findsOneWidget);
    expect(api.searchCalls, 2);
  });

  testWidgets('discovery stays loading until the catalogue responds', (tester) async {
    final pending = Completer<ApiPage<ExperienceCard>>();
    final api = ScriptedApi()..pendingSearch = pending.future;
    await tester.pumpWidget(_app(api));
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    pending.complete(const ApiPage([], null));
    await tester.pumpAndSettle();
    expect(find.text('No published experiences match these filters.'), findsOneWidget);
  });

  testWidgets('a second booking tap does not send another request', (tester) async {
    final pending = Completer<Booking>();
    final api = ScriptedApi()
      ..experienceDetail = _experience()
      ..publicHost = const PublicHost(
        id: '22222222-2222-4222-8222-222222222222',
        publicName: 'Meera',
        bio: 'Walks in the old city.',
        verificationStatus: 'VERIFIED',
      )
      ..availabilityResult = const Availability(
        timezone: 'Asia/Kolkata',
        slots: [
          Slot(
            id: '33333333-3333-4333-8333-333333333333',
            startsAt: '2026-12-01T04:30:00.000Z',
            endsAt: '2026-12-01T06:30:00.000Z',
            capacity: 6,
            remaining: 4,
            status: 'OPEN',
          ),
        ],
      )
      ..pendingBooking = pending;
    await tester.pumpWidget(
      _app(
        api,
        home: ExperiencePage(experienceId: _experience().id),
        account: _account(),
      ),
    );
    await tester.pumpAndSettle();
    final slot = find.byKey(
      const ValueKey('slot-33333333-3333-4333-8333-333333333333'),
    );
    await _reveal(tester, slot);
    await tester.tap(slot);
    await tester.pump();
    final book = find.byKey(const Key('request-booking'));
    await _reveal(tester, book);
    await tester.tap(book);
    await tester.pump();
    await tester.tap(book);
    await tester.pump();

    expect(api.bookingCalls, 1);
    pending.complete(_booking());
    await tester.pumpAndSettle();
  });

  testWidgets('checkout does not treat a created intent as payment success', (tester) async {
    final api = ScriptedApi()
      ..bookingResult = _booking()
      ..paymentStatusResult = const PaymentStatusView(
        bookingId: '44444444-4444-4444-8444-444444444444',
        bookingStatus: 'HOLD',
        settlement: 'unconfirmed',
        payment: null,
      )
      ..intentResult = const PaymentIntent(
        attemptId: '55555555-5555-4555-8555-555555555555',
        bookingId: '44444444-4444-4444-8444-444444444444',
        status: 'CREATED',
        amountMinor: 150000,
        currency: 'INR',
        provider: 'sandbox',
        settlement: 'unconfirmed',
        providerOrderRef: 'order_test',
        keyId: 'key_test',
      );
    await tester.pumpWidget(
      _app(
        api,
        home: const CheckoutPage(bookingId: '44444444-4444-4444-8444-444444444444'),
        account: _account(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Payment successful'), findsNothing);
    expect(find.textContaining('does not mark this booking paid'), findsOneWidget);
    expect(find.textContaining('has not confirmed payment'), findsOneWidget);

    await tester.tap(find.text('Continue to payment'));
    await tester.pumpAndSettle();

    expect(find.text('Payment successful'), findsNothing);
    expect(find.textContaining('Attempt status: CREATED'), findsOneWidget);
    expect(find.textContaining('does not confirm payment'), findsOneWidget);
  });

  testWidgets('Razorpay checkout uses the server order and does not confirm payment', (tester) async {
    final api = ScriptedApi()
      ..bookingResult = _booking()
      ..paymentStatusResult = const PaymentStatusView(
        bookingId: '44444444-4444-4444-8444-444444444444',
        bookingStatus: 'HOLD',
        settlement: 'unconfirmed',
        payment: PaymentAttemptView(
          attemptId: '55555555-5555-4555-8555-555555555555',
          status: 'CREATED',
          amountMinor: 150000,
          currency: 'INR',
          provider: 'razorpay',
        ),
      )
      ..intentResult = const PaymentIntent(
        attemptId: '55555555-5555-4555-8555-555555555555',
        bookingId: '44444444-4444-4444-8444-444444444444',
        status: 'CREATED',
        amountMinor: 150000,
        currency: 'INR',
        provider: 'razorpay',
        settlement: 'unconfirmed',
        providerOrderRef: 'order_test',
        keyId: 'rzp_test_key',
      );
    late _RecordingCheckout checkout;
    await tester.pumpWidget(
      _app(
        api,
        account: _account(),
        home: CheckoutPage(
          bookingId: '44444444-4444-4444-8444-444444444444',
          checkoutFactory: (onReturn) {
            checkout = _RecordingCheckout(onReturn);
            return checkout;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue to payment'));
    await tester.pump();

    expect(checkout.opened?.keyId, 'rzp_test_key');
    expect(checkout.opened?.orderId, 'order_test');
    expect(checkout.opened?.amountMinor, 150000);
    expect(checkout.opened?.currency, 'INR');
    expect(checkout.opened?.toOptions().containsKey('contact'), isFalse);

    checkout.onReturn(const RazorpayCheckoutEvent(RazorpayCheckoutKind.completed));
    await tester.pumpAndSettle();

    expect(find.text('Payment successful'), findsNothing);
    expect(find.textContaining('does not confirm payment'), findsWidgets);
    expect(find.textContaining('CREATED'), findsWidgets);
  });

  testWidgets('host payout form sends only bank fields', (tester) async {
    final api = ScriptedApi()
      ..payoutResult = const HostVerification(
        verificationStatus: 'VERIFIED',
        onboardingStatus: 'APPROVED',
        publicProfileStatus: 'VISIBLE',
        note: null,
        payoutAccount: PayoutAccount(
          accountHolderName: 'Ada Lovelace',
          ifsc: 'HDFC0001234',
          accountLast4: '9012',
        ),
        documents: [],
      );
    await tester.pumpWidget(
      _app(api, home: const HostAccountPage(), account: _account(host: true)),
    );
    await tester.pumpAndSettle();

    await _reveal(tester, find.byKey(const Key('save-payout-account')));
    await tester.enterText(find.widgetWithText(TextField, 'Account holder name'), 'Ada Lovelace');
    await tester.enterText(find.widgetWithText(TextField, 'IFSC'), 'hdfc0001234');
    await tester.enterText(find.widgetWithText(TextField, 'Account number'), '123456789012');
    await tester.tap(find.text('Save payout account'));
    await tester.pumpAndSettle();

    expect(api.lastPayoutBody?.keys.toList(), [
      'accountHolderName',
      'ifsc',
      'accountNumber',
    ]);
    expect(api.lastPayoutBody?['ifsc'], 'HDFC0001234');
    expect(api.lastPayoutBody?.containsKey('verificationStatus'), isFalse);
    expect(find.textContaining('masked payout account'), findsOneWidget);
  });

  testWidgets('reviews and support do not submit a fake review', (tester) async {
    await tester.pumpWidget(_app(ScriptedApi(), home: const UnavailableJourneyPage()));
    expect(
      find.text(
        'Reviews, reports, and support requests are not available from the API yet.',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('submitted'), findsNothing);
  });
}

class _RecordingCheckout implements RazorpayCheckout {
  _RecordingCheckout(this.onReturn);

  final RazorpayCheckoutHandler onReturn;
  RazorpayCheckoutOptions? opened;

  @override
  void dispose() {}

  @override
  void open(RazorpayCheckoutOptions options) {
    opened = options;
  }
}

Future<void> _reveal(WidgetTester tester, Finder target) async {
  final scrollable = find.byType(Scrollable).first;
  for (var attempt = 0; attempt < 8; attempt++) {
    if (target.hitTestable().evaluate().isNotEmpty) {
      return;
    }
    await tester.drag(scrollable, const Offset(0, -500));
    await tester.pumpAndSettle();
  }
}

Widget _app(ScriptedApi api, {Widget? home, Account? account}) {
  final session = AppSession(
    api: api,
    tokens: MemoryTokenStore(),
    initialAccount: account,
  );
  return AppSessionScope(
    session: session,
    child: MaterialApp(
      theme: buildAppTheme(),
      home: home ?? const DiscoveryPage(),
    ),
  );
}

Account _account({bool host = false}) {
  return Account(
    id: '11111111-1111-4111-8111-111111111111',
    email: 'ada@example.com',
    accountStatus: 'ACTIVE',
    locale: 'en',
    roles: host ? const ['TRAVELLER', 'HOST'] : const ['TRAVELLER'],
    adminAccess: false,
  );
}

ExperienceDetail _experience() {
  return ExperienceDetail(
    id: '66666666-6666-4666-8666-666666666666',
    title: 'Dawn bakery walk',
    category: 'food',
    durationMinutes: 120,
    basePriceMinor: 150000,
    currency: 'INR',
    capacity: 6,
    languageCodes: const ['en'],
    cityId: '77777777-7777-4777-8777-777777777777',
    citySlug: 'jaipur',
    cityName: 'Jaipur',
    hostId: '22222222-2222-4222-8222-222222222222',
    hostName: 'Meera',
    hostVerificationStatus: 'VERIFIED',
    description: 'A walk through neighbourhood bakeries.',
    inclusions: 'Tastings',
    exclusions: 'Transport',
    meetingArea: 'Near the old gate',
    accessibilityNotes: null,
    safetyNotes: null,
    cancellationPolicy: 'Cancel a day ahead.',
    cityState: 'Rajasthan',
    cityCountryCode: 'IN',
    cityTimezone: 'Asia/Kolkata',
  );
}

Booking _booking() {
  return const Booking(
    id: '44444444-4444-4444-8444-444444444444',
    status: 'HOLD',
    travellerId: '11111111-1111-4111-8111-111111111111',
    hostId: '22222222-2222-4222-8222-222222222222',
    experienceId: '66666666-6666-4666-8666-666666666666',
    offerId: null,
    startsAt: '2026-12-01T04:30:00.000Z',
    endsAt: '2026-12-01T06:30:00.000Z',
    participantCount: 1,
    currency: 'INR',
    subtotalMinor: 150000,
    discountMinor: 0,
    taxMinor: 0,
    totalMinor: 150000,
    commissionMinor: 15000,
    hostGrossMinor: 135000,
    title: 'Dawn bakery walk',
    inclusions: 'Tastings',
    exclusions: 'Transport',
    meetingArea: 'Near the old gate',
    cancellationPolicy: 'Cancel a day ahead.',
    createdAt: '2026-11-10T00:00:00.000Z',
    hold: null,
  );
}
