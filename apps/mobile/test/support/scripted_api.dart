import 'dart:async';

import 'package:mittiandmiles/data/marketplace_api.dart';
import 'package:mittiandmiles/data/models.dart';
import 'package:mittiandmiles/data/payloads.dart';

class ScriptedApi implements MarketplaceApi {
  ApiPage<City> cities = const ApiPage([], null);
  ApiPage<NamedCode> languages = const ApiPage([], null);
  ApiPage<NamedCode> categories = const ApiPage([], null);
  ApiPage<ExperienceCard> experiences = const ApiPage([], null);
  Object? searchError;
  Future<ApiPage<ExperienceCard>>? pendingSearch;
  int searchCalls = 0;

  ExperienceDetail? experienceDetail;
  PublicHost? publicHost;
  Availability availabilityResult = const Availability(timezone: 'Asia/Kolkata', slots: []);
  Booking? bookingResult;
  PaymentStatusView? paymentStatusResult;
  PaymentIntent? intentResult;
  final List<String> bookingKeys = [];
  Completer<Booking>? pendingBooking;
  int bookingCalls = 0;

  Map<String, Object>? lastPayoutBody;
  HostVerification? payoutResult;

  @override
  Future<Booking> acceptOffer(String offerId) => _missing();

  @override
  Future<HostDocument> addDocument(String documentType) => _missing();

  @override
  Future<Availability> availability(
    String id, {
    required String from,
    required String to,
    int? partySize,
  }) async {
    return availabilityResult;
  }

  @override
  Future<Booking> booking(String id) async {
    final value = bookingResult;
    if (value == null) {
      throw StateError('No booking scripted.');
    }
    return value;
  }

  @override
  Future<Booking> cancelBooking(String id, {String? reason}) => _missing();

  @override
  Future<Booking> checkIn(String id, {required String method}) => _missing();

  @override
  Future<Booking> completeBooking(String id) => _missing();

  @override
  Future<Booking> createBooking({
    required String experienceId,
    required String slotId,
    required int participantCount,
    required String currency,
    required String idempotencyKey,
  }) {
    bookingCalls += 1;
    bookingKeys.add(idempotencyKey);
    final pending = pendingBooking;
    if (pending != null) {
      return pending.future;
    }
    final value = bookingResult;
    if (value == null) {
      throw StateError('No booking scripted.');
    }
    return Future.value(value);
  }

  @override
  Future<OwnExperience> createExperience(ExperienceDraft draft) => _missing();

  @override
  Future<Offer> createOffer(String requestId, OfferDraft draft) => _missing();

  @override
  Future<PaymentIntent> createPaymentIntent(
    String bookingId, {
    required String idempotencyKey,
  }) async {
    final value = intentResult;
    if (value == null) {
      throw StateError('No intent scripted.');
    }
    return value;
  }

  @override
  Future<TripRequest> createTripRequest(
    TripRequestDraft draft, {
    required String idempotencyKey,
  }) =>
      _missing();

  @override
  Future<Booking> disputeBooking(String id, {required String reason}) => _missing();

  @override
  Future<Earnings> earnings() => _missing();

  @override
  Future<ExperienceDetail> experience(String id) async {
    final value = experienceDetail;
    if (value == null) {
      throw StateError('No experience scripted.');
    }
    return value;
  }

  @override
  Future<PublicHost> host(String id) async {
    final value = publicHost;
    if (value == null) {
      throw StateError('No host scripted.');
    }
    return value;
  }

  @override
  Future<ApiPage<Booking>> hostBookings({String? cursor}) async {
    return const ApiPage([], null);
  }

  @override
  Future<ApiPage<NamedCode>> listCategories({String? cursor}) async => categories;

  @override
  Future<ApiPage<City>> listCities({String? cursor}) async => cities;

  @override
  Future<ApiPage<NamedCode>> listLanguages({String? cursor}) async => languages;

  @override
  Future<AuthTokens> login({required String email, required String password}) => _missing();

  @override
  Future<void> logout() async {}

  @override
  Future<Booking> markNoShow(String id, {String? reason}) => _missing();

  @override
  Future<Account> me() => _missing();

  @override
  Future<ApiPage<Booking>> myBookings({String? cursor}) async => const ApiPage([], null);

  @override
  Future<List<Offer>> offers(String requestId) => _missing();

  @override
  Future<HostVerification> onboard({
    required String publicName,
    String? bio,
    required bool submit,
  }) =>
      _missing();

  @override
  Future<OwnExperience> ownExperience(String id) => _missing();

  @override
  Future<HostProfile> ownHost() => _missing();

  @override
  Future<ApiPage<OwnExperience>> ownExperiences({String? cursor}) async {
    return const ApiPage([], null);
  }

  @override
  Future<PaymentStatusView> paymentStatus(String bookingId) async {
    final value = paymentStatusResult;
    if (value == null) {
      throw StateError('No payment status scripted.');
    }
    return value;
  }

  @override
  Future<List<Payout>> payouts() => _missing();

  @override
  Future<AuthTokens> register({
    required String email,
    required String password,
    String locale = 'en',
  }) =>
      _missing();

  @override
  Future<RefundView> requestRefund(
    String bookingId, {
    required String reasonCode,
    int? amountMinor,
    required String idempotencyKey,
  }) =>
      _missing();

  @override
  Future<OwnExperience> saveAvailability(
    String id, {
    required List<SlotDraft> slots,
    required List<BlackoutDraft> blackouts,
  }) =>
      _missing();

  @override
  Future<HostVerification> savePayoutAccount({
    required String accountHolderName,
    required String ifsc,
    required String accountNumber,
  }) async {
    lastPayoutBody = payoutAccountBody(
      accountHolderName: accountHolderName,
      ifsc: ifsc,
      accountNumber: accountNumber,
    );
    final value = payoutResult;
    if (value == null) {
      throw StateError('No payout result scripted.');
    }
    return value;
  }

  @override
  Future<ApiPage<ExperienceCard>> searchExperiences(DiscoveryQuery query) {
    searchCalls += 1;
    final error = searchError;
    if (error != null) {
      return Future.error(error);
    }
    final pending = pendingSearch;
    if (pending != null) {
      return pending;
    }
    return Future.value(experiences);
  }

  @override
  Future<OwnExperience> submitExperience(String id) => _missing();

  @override
  Future<TripRequest> tripRequest(String id) => _missing();

  @override
  Future<Account> updateLocale(String locale) => _missing();

  @override
  Future<OwnExperience> updateExperience(String id, ExperienceDraft draft) => _missing();

  @override
  Future<HostVerification> verification() async {
    return payoutResult ??
        const HostVerification(
          verificationStatus: 'NOT_STARTED',
          onboardingStatus: 'DRAFT',
          publicProfileStatus: 'HIDDEN',
          note: null,
          payoutAccount: null,
          documents: [],
        );
  }

  @override
  Future<Offer> withdrawOffer(String offerId) => _missing();

  Future<T> _missing<T>() {
    return Future.error(UnimplementedError('Not scripted.'));
  }
}
