import 'package:mittiandmiles/data/models.dart';
import 'package:mittiandmiles/data/payloads.dart';

abstract class MarketplaceApi {
  Future<AuthTokens> register({
    required String email,
    required String password,
    String locale = 'en',
  });

  Future<AuthTokens> login({required String email, required String password});

  Future<void> logout();

  Future<Account> me();

  Future<Account> updateLocale(String locale);

  Future<ApiPage<City>> listCities({String? cursor});

  Future<ApiPage<NamedCode>> listLanguages({String? cursor});

  Future<ApiPage<NamedCode>> listCategories({String? cursor});

  Future<ApiPage<ExperienceCard>> searchExperiences(DiscoveryQuery query);

  Future<ExperienceDetail> experience(String id);

  Future<Availability> availability(
    String id, {
    required String from,
    required String to,
    int? partySize,
  });

  Future<PublicHost> host(String id);

  Future<Booking> createBooking({
    required String experienceId,
    required String slotId,
    required int participantCount,
    required String currency,
    required String idempotencyKey,
  });

  Future<Booking> booking(String id);

  Future<ApiPage<Booking>> myBookings({String? cursor});

  Future<Booking> cancelBooking(String id, {String? reason});

  Future<Booking> disputeBooking(String id, {required String reason});

  Future<PaymentIntent> createPaymentIntent(
    String bookingId, {
    required String idempotencyKey,
  });

  Future<PaymentStatusView> paymentStatus(String bookingId);

  Future<RefundView> requestRefund(
    String bookingId, {
    required String reasonCode,
    int? amountMinor,
    required String idempotencyKey,
  });

  Future<TripRequest> createTripRequest(
    TripRequestDraft draft, {
    required String idempotencyKey,
  });

  Future<TripRequest> tripRequest(String id);

  Future<List<Offer>> offers(String requestId);

  Future<Booking> acceptOffer(String offerId);

  Future<HostVerification> onboard({
    required String publicName,
    String? bio,
    required bool submit,
  });

  Future<HostProfile> ownHost();

  Future<HostVerification> verification();

  Future<HostVerification> savePayoutAccount({
    required String accountHolderName,
    required String ifsc,
    required String accountNumber,
  });

  Future<HostDocument> addDocument(String documentType);

  Future<ApiPage<OwnExperience>> ownExperiences({String? cursor});

  Future<OwnExperience> ownExperience(String id);

  Future<OwnExperience> createExperience(ExperienceDraft draft);

  Future<OwnExperience> updateExperience(String id, ExperienceDraft draft);

  Future<OwnExperience> submitExperience(String id);

  Future<OwnExperience> saveAvailability(
    String id, {
    required List<SlotDraft> slots,
    required List<BlackoutDraft> blackouts,
  });

  Future<ApiPage<Booking>> hostBookings({String? cursor});

  Future<Booking> checkIn(String id, {required String method});

  Future<Booking> completeBooking(String id);

  Future<Booking> markNoShow(String id, {String? reason});

  Future<Offer> createOffer(String requestId, OfferDraft draft);

  Future<Offer> withdrawOffer(String offerId);

  Future<Earnings> earnings();

  Future<List<Payout>> payouts();
}
