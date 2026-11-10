import 'package:mittiandmiles/core/network/api_client.dart';
import 'package:mittiandmiles/core/session/token_store.dart';
import 'package:mittiandmiles/data/marketplace_api.dart';
import 'package:mittiandmiles/data/models.dart';
import 'package:mittiandmiles/data/payloads.dart';

class HttpMarketplaceApi implements MarketplaceApi {
  HttpMarketplaceApi(this.client, {required this.tokens});

  final ApiClient client;
  final TokenStore tokens;

  Map<String, dynamic> _object(Map<String, dynamic>? json) {
    if (json == null) {
      throw const FormatException('Missing response.');
    }
    return json;
  }

  @override
  Future<AuthTokens> register({
    required String email,
    required String password,
    String locale = 'en',
  }) async {
    final json = _object(
      await client.send(
        'POST',
        '/auth/register',
        auth: false,
        body: {'email': email, 'password': password, 'locale': locale},
      ),
    );
    return AuthTokens.fromJson(json);
  }

  @override
  Future<AuthTokens> login({
    required String email,
    required String password,
  }) async {
    final json = _object(
      await client.send(
        'POST',
        '/auth/login',
        auth: false,
        body: {'email': email, 'password': password},
      ),
    );
    return AuthTokens.fromJson(json);
  }

  @override
  Future<void> logout() async {
    final stored = await tokens.read();
    if (stored == null) {
      return;
    }
    await client.send(
      'POST',
      '/auth/logout',
      auth: false,
      body: {'refreshToken': stored.refreshToken},
    );
  }

  @override
  Future<Account> me() async {
    return Account.fromJson(_object(await client.get('/me')));
  }

  @override
  Future<Account> updateLocale(String locale) async {
    return Account.fromJson(
      _object(await client.send('PATCH', '/me', body: {'locale': locale})),
    );
  }

  @override
  Future<ApiPage<City>> listCities({String? cursor}) async {
    return parsePage(
      await client.get('/cities', query: _cursor(cursor), auth: false),
      City.fromJson,
    );
  }

  @override
  Future<ApiPage<NamedCode>> listLanguages({String? cursor}) async {
    return parsePage(
      await client.get('/languages', query: _cursor(cursor), auth: false),
      NamedCode.language,
    );
  }

  @override
  Future<ApiPage<NamedCode>> listCategories({String? cursor}) async {
    return parsePage(
      await client.get('/categories', query: _cursor(cursor), auth: false),
      NamedCode.category,
    );
  }

  @override
  Future<ApiPage<ExperienceCard>> searchExperiences(DiscoveryQuery query) async {
    return parsePage(
      await client.get('/experiences', query: query.toQuery(), auth: false),
      ExperienceCard.fromJson,
    );
  }

  @override
  Future<ExperienceDetail> experience(String id) async {
    return ExperienceDetail.fromJson(
      _object(await client.get('/experiences/$id', auth: false)),
    );
  }

  @override
  Future<Availability> availability(
    String id, {
    required String from,
    required String to,
    int? partySize,
  }) async {
    return Availability.fromJson(
      _object(
        await client.get(
          '/experiences/$id/availability',
          auth: false,
          query: {
            'from': from,
            'to': to,
            if (partySize != null) 'partySize': '$partySize',
          },
        ),
      ),
    );
  }

  @override
  Future<PublicHost> host(String id) async {
    return PublicHost.fromJson(_object(await client.get('/hosts/$id', auth: false)));
  }

  @override
  Future<Booking> createBooking({
    required String experienceId,
    required String slotId,
    required int participantCount,
    required String currency,
    required String idempotencyKey,
  }) async {
    return Booking.fromJson(
      _object(
        await client.send(
          'POST',
          '/bookings',
          idempotencyKey: idempotencyKey,
          body: {
            'experienceId': experienceId,
            'slotId': slotId,
            'participantCount': participantCount,
            'currency': currency,
          },
        ),
      ),
    );
  }

  @override
  Future<Booking> booking(String id) async {
    return Booking.fromJson(_object(await client.get('/bookings/$id')));
  }

  @override
  Future<ApiPage<Booking>> myBookings({String? cursor}) async {
    return parsePage(
      await client.get('/me/bookings', query: _cursor(cursor)),
      Booking.fromJson,
    );
  }

  @override
  Future<Booking> cancelBooking(String id, {String? reason}) async {
    return Booking.fromJson(
      _object(
        await client.send(
          'POST',
          '/bookings/$id/cancel',
          body: {if (reason != null && reason.isNotEmpty) 'reason': reason},
        ),
      ),
    );
  }

  @override
  Future<Booking> disputeBooking(String id, {required String reason}) async {
    return Booking.fromJson(
      _object(
        await client.send(
          'POST',
          '/bookings/$id/disputes',
          body: {'reason': reason},
        ),
      ),
    );
  }

  @override
  Future<PaymentIntent> createPaymentIntent(
    String bookingId, {
    required String idempotencyKey,
  }) async {
    return PaymentIntent.fromJson(
      _object(
        await client.send(
          'POST',
          '/bookings/$bookingId/payment-intent',
          idempotencyKey: idempotencyKey,
          body: const <String, Object>{},
        ),
      ),
    );
  }

  @override
  Future<PaymentStatusView> paymentStatus(String bookingId) async {
    return PaymentStatusView.fromJson(
      _object(await client.get('/bookings/$bookingId/payment-status')),
    );
  }

  @override
  Future<RefundView> requestRefund(
    String bookingId, {
    required String reasonCode,
    int? amountMinor,
    required String idempotencyKey,
  }) async {
    return RefundView.fromJson(
      _object(
        await client.send(
          'POST',
          '/bookings/$bookingId/refund-requests',
          idempotencyKey: idempotencyKey,
          body: {
            'reasonCode': reasonCode,
            if (amountMinor != null) 'amountMinor': amountMinor,
          },
        ),
      ),
    );
  }

  @override
  Future<TripRequest> createTripRequest(
    TripRequestDraft draft, {
    required String idempotencyKey,
  }) async {
    return TripRequest.fromJson(
      _object(
        await client.send(
          'POST',
          '/trip-requests',
          idempotencyKey: idempotencyKey,
          body: draft.toJson(),
        ),
      ),
    );
  }

  @override
  Future<TripRequest> tripRequest(String id) async {
    return TripRequest.fromJson(_object(await client.get('/trip-requests/$id')));
  }

  @override
  Future<List<Offer>> offers(String requestId) async {
    return parseItems(
      await client.get('/trip-requests/$requestId/offers'),
      Offer.fromJson,
    );
  }

  @override
  Future<Booking> acceptOffer(String offerId) async {
    return Booking.fromJson(_object(await client.send('POST', '/offers/$offerId/accept')));
  }

  @override
  Future<HostVerification> onboard({
    required String publicName,
    String? bio,
    required bool submit,
  }) async {
    return HostVerification.fromJson(
      _object(
        await client.send(
          'POST',
          '/hosts/onboarding',
          body: {
            'publicName': publicName,
            'submit': submit,
            if (bio != null) 'bio': bio,
          },
        ),
      ),
    );
  }

  @override
  Future<HostProfile> ownHost() async {
    return HostProfile.fromJson(_object(await client.get('/hosts/me')));
  }

  @override
  Future<HostVerification> verification() async {
    return HostVerification.fromJson(_object(await client.get('/hosts/me/verification')));
  }

  @override
  Future<HostVerification> savePayoutAccount({
    required String accountHolderName,
    required String ifsc,
    required String accountNumber,
  }) async {
    return HostVerification.fromJson(
      _object(
        await client.send(
          'PUT',
          '/hosts/me/payout-account',
          body: payoutAccountBody(
            accountHolderName: accountHolderName,
            ifsc: ifsc,
            accountNumber: accountNumber,
          ),
        ),
      ),
    );
  }

  @override
  Future<HostDocument> addDocument(String documentType) async {
    return HostDocument.fromJson(
      _object(
        await client.send(
          'POST',
          '/hosts/me/documents',
          body: {'documentType': documentType},
        ),
      ),
    );
  }

  @override
  Future<ApiPage<OwnExperience>> ownExperiences({String? cursor}) async {
    return parsePage(
      await client.get('/hosts/me/experiences', query: _cursor(cursor)),
      OwnExperience.fromJson,
    );
  }

  @override
  Future<OwnExperience> ownExperience(String id) async {
    return OwnExperience.fromJson(
      _object(await client.get('/hosts/me/experiences/$id')),
    );
  }

  @override
  Future<OwnExperience> createExperience(ExperienceDraft draft) async {
    return OwnExperience.fromJson(
      _object(await client.send('POST', '/hosts/me/experiences', body: draft.toJson())),
    );
  }

  @override
  Future<OwnExperience> updateExperience(String id, ExperienceDraft draft) async {
    return OwnExperience.fromJson(
      _object(
        await client.send('PATCH', '/hosts/me/experiences/$id', body: draft.toJson()),
      ),
    );
  }

  @override
  Future<OwnExperience> submitExperience(String id) async {
    return OwnExperience.fromJson(
      _object(await client.send('POST', '/hosts/me/experiences/$id/submit')),
    );
  }

  @override
  Future<OwnExperience> saveAvailability(
    String id, {
    required List<SlotDraft> slots,
    required List<BlackoutDraft> blackouts,
  }) async {
    return OwnExperience.fromJson(
      _object(
        await client.send(
          'PUT',
          '/hosts/me/experiences/$id/availability',
          body: {
            'slots': slots.map((slot) => slot.toJson()).toList(),
            'blackouts': blackouts.map((row) => row.toJson()).toList(),
          },
        ),
      ),
    );
  }

  @override
  Future<ApiPage<Booking>> hostBookings({String? cursor}) async {
    return parsePage(
      await client.get('/hosts/me/bookings', query: _cursor(cursor)),
      Booking.fromJson,
    );
  }

  @override
  Future<Booking> checkIn(String id, {required String method}) async {
    return Booking.fromJson(
      _object(
        await client.send(
          'POST',
          '/bookings/$id/check-in',
          body: {'method': method},
        ),
      ),
    );
  }

  @override
  Future<Booking> completeBooking(String id) async {
    return Booking.fromJson(_object(await client.send('POST', '/bookings/$id/complete')));
  }

  @override
  Future<Booking> markNoShow(String id, {String? reason}) async {
    return Booking.fromJson(
      _object(
        await client.send(
          'POST',
          '/bookings/$id/no-show',
          body: {if (reason != null && reason.isNotEmpty) 'reason': reason},
        ),
      ),
    );
  }

  @override
  Future<Offer> createOffer(String requestId, OfferDraft draft) async {
    return Offer.fromJson(
      _object(
        await client.send(
          'POST',
          '/trip-requests/$requestId/offers',
          body: draft.toJson(),
        ),
      ),
    );
  }

  @override
  Future<Offer> withdrawOffer(String offerId) async {
    return Offer.fromJson(_object(await client.send('POST', '/offers/$offerId/withdraw')));
  }

  @override
  Future<Earnings> earnings() async {
    return Earnings.fromJson(_object(await client.get('/hosts/me/earnings')));
  }

  @override
  Future<List<Payout>> payouts() async {
    return parseItems(await client.get('/hosts/me/payouts'), Payout.fromJson);
  }

  Map<String, String>? _cursor(String? cursor) {
    if (cursor == null || cursor.isEmpty) {
      return null;
    }
    return {'cursor': cursor};
  }
}
