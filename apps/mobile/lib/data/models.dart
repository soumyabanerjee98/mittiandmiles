class ApiPage<T> {
  const ApiPage(this.items, this.nextCursor);

  final List<T> items;
  final String? nextCursor;

  bool get isEmpty => items.isEmpty;
}

class AuthTokens {
  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.tokenType,
    required this.expiresIn,
  });

  final String accessToken;
  final String refreshToken;
  final String tokenType;
  final int expiresIn;

  factory AuthTokens.fromJson(Map<String, dynamic> json) {
    return AuthTokens(
      accessToken: asString(json['accessToken'], 'accessToken'),
      refreshToken: asString(json['refreshToken'], 'refreshToken'),
      tokenType: asString(json['tokenType'], 'tokenType'),
      expiresIn: asInt(json['expiresIn'], 'expiresIn'),
    );
  }
}

class Account {
  const Account({
    required this.id,
    required this.email,
    required this.accountStatus,
    required this.locale,
    required this.roles,
    required this.adminAccess,
  });

  final String id;
  final String email;
  final String accountStatus;
  final String locale;
  final List<String> roles;

  /// Taken only from the server account payload. Role names are not promoted
  /// to admin access on the client.
  final bool adminAccess;

  bool get isHost => roles.contains('HOST');

  factory Account.fromJson(Map<String, dynamic> json) {
    return Account(
      id: asString(json['id'], 'id'),
      email: asString(json['email'], 'email'),
      accountStatus: asString(json['accountStatus'], 'accountStatus'),
      locale: asString(json['locale'], 'locale'),
      roles: asStringList(json['roles'], 'roles'),
      adminAccess: json['adminAccess'] == true,
    );
  }
}

class City {
  const City({
    required this.id,
    required this.slug,
    required this.name,
    required this.state,
    required this.countryCode,
    required this.timezone,
    required this.status,
  });

  final String id;
  final String slug;
  final String name;
  final String state;
  final String countryCode;
  final String timezone;
  final String status;

  factory City.fromJson(Map<String, dynamic> json) {
    return City(
      id: asString(json['id'], 'id'),
      slug: asString(json['slug'], 'slug'),
      name: asString(json['name'], 'name'),
      state: asString(json['state'], 'state'),
      countryCode: asString(json['countryCode'], 'countryCode'),
      timezone: asString(json['timezone'], 'timezone'),
      status: asString(json['status'], 'status'),
    );
  }
}

class NamedCode {
  const NamedCode({required this.code, required this.name});

  final String code;
  final String name;

  factory NamedCode.language(Map<String, dynamic> json) {
    return NamedCode(
      code: asString(json['code'], 'code'),
      name: asString(json['name'], 'name'),
    );
  }

  factory NamedCode.category(Map<String, dynamic> json) {
    return NamedCode(
      code: asString(json['slug'], 'slug'),
      name: asString(json['name'], 'name'),
    );
  }
}

class ExperienceCard {
  const ExperienceCard({
    required this.id,
    required this.title,
    required this.category,
    required this.durationMinutes,
    required this.basePriceMinor,
    required this.currency,
    required this.capacity,
    required this.languageCodes,
    required this.cityId,
    required this.citySlug,
    required this.cityName,
    required this.hostId,
    required this.hostName,
    required this.hostVerificationStatus,
  });

  final String id;
  final String title;
  final String category;
  final int durationMinutes;
  final int basePriceMinor;
  final String currency;
  final int capacity;
  final List<String> languageCodes;
  final String cityId;
  final String citySlug;
  final String cityName;
  final String hostId;
  final String hostName;
  final String hostVerificationStatus;

  factory ExperienceCard.fromJson(Map<String, dynamic> json) {
    final city = asMap(json['city'], 'city');
    final host = asMap(json['host'], 'host');
    return ExperienceCard(
      id: asString(json['id'], 'id'),
      title: asString(json['title'], 'title'),
      category: asString(json['category'], 'category'),
      durationMinutes: asInt(json['durationMinutes'], 'durationMinutes'),
      basePriceMinor: asInt(json['basePriceMinor'], 'basePriceMinor'),
      currency: asString(json['currency'], 'currency'),
      capacity: asInt(json['capacity'], 'capacity'),
      languageCodes: asStringList(json['languageCodes'], 'languageCodes'),
      cityId: asString(city['id'], 'city.id'),
      citySlug: asString(city['slug'], 'city.slug'),
      cityName: asString(city['name'], 'city.name'),
      hostId: asString(host['id'], 'host.id'),
      hostName: asString(host['publicName'], 'host.publicName'),
      hostVerificationStatus: asString(
        host['verificationStatus'],
        'host.verificationStatus',
      ),
    );
  }
}

class ExperienceDetail extends ExperienceCard {
  ExperienceDetail({
    required super.id,
    required super.title,
    required super.category,
    required super.durationMinutes,
    required super.basePriceMinor,
    required super.currency,
    required super.capacity,
    required super.languageCodes,
    required super.cityId,
    required super.citySlug,
    required super.cityName,
    required super.hostId,
    required super.hostName,
    required super.hostVerificationStatus,
    required this.description,
    required this.inclusions,
    required this.exclusions,
    required this.meetingArea,
    required this.accessibilityNotes,
    required this.safetyNotes,
    required this.cancellationPolicy,
    required this.cityState,
    required this.cityCountryCode,
    required this.cityTimezone,
  });

  final String description;
  final String inclusions;
  final String exclusions;
  final String meetingArea;
  final String? accessibilityNotes;
  final String? safetyNotes;
  final String cancellationPolicy;
  final String cityState;
  final String cityCountryCode;
  final String cityTimezone;

  factory ExperienceDetail.fromJson(Map<String, dynamic> json) {
    final card = ExperienceCard.fromJson(json);
    final city = asMap(json['city'], 'city');
    return ExperienceDetail(
      id: card.id,
      title: card.title,
      category: card.category,
      durationMinutes: card.durationMinutes,
      basePriceMinor: card.basePriceMinor,
      currency: card.currency,
      capacity: card.capacity,
      languageCodes: card.languageCodes,
      cityId: card.cityId,
      citySlug: card.citySlug,
      cityName: card.cityName,
      hostId: card.hostId,
      hostName: card.hostName,
      hostVerificationStatus: card.hostVerificationStatus,
      description: asString(json['description'], 'description'),
      inclusions: asString(json['inclusions'], 'inclusions'),
      exclusions: asString(json['exclusions'], 'exclusions'),
      meetingArea: asString(json['meetingArea'], 'meetingArea'),
      accessibilityNotes: json['accessibilityNotes'] as String?,
      safetyNotes: json['safetyNotes'] as String?,
      cancellationPolicy: asString(json['cancellationPolicy'], 'cancellationPolicy'),
      cityState: asString(city['state'], 'city.state'),
      cityCountryCode: asString(city['countryCode'], 'city.countryCode'),
      cityTimezone: asString(city['timezone'], 'city.timezone'),
    );
  }
}

class Slot {
  const Slot({
    required this.id,
    required this.startsAt,
    required this.endsAt,
    required this.capacity,
    required this.remaining,
    required this.status,
  });

  final String id;
  final String startsAt;
  final String endsAt;
  final int capacity;
  final int remaining;
  final String status;

  factory Slot.fromJson(Map<String, dynamic> json) {
    return Slot(
      id: asString(json['id'], 'id'),
      startsAt: asString(json['startsAt'], 'startsAt'),
      endsAt: asString(json['endsAt'], 'endsAt'),
      capacity: asInt(json['capacity'], 'capacity'),
      remaining: asInt(json['remaining'], 'remaining'),
      status: asString(json['status'], 'status'),
    );
  }
}

class Availability {
  const Availability({required this.timezone, required this.slots});

  final String timezone;
  final List<Slot> slots;

  factory Availability.fromJson(Map<String, dynamic> json) {
    return Availability(
      timezone: asString(json['timezone'], 'timezone'),
      slots: asMapList(json['slots'], 'slots').map(Slot.fromJson).toList(),
    );
  }
}

class PublicHost {
  const PublicHost({
    required this.id,
    required this.publicName,
    required this.bio,
    required this.verificationStatus,
  });

  final String id;
  final String publicName;
  final String? bio;
  final String verificationStatus;

  factory PublicHost.fromJson(Map<String, dynamic> json) {
    return PublicHost(
      id: asString(json['id'], 'id'),
      publicName: asString(json['publicName'], 'publicName'),
      bio: json['bio'] as String?,
      verificationStatus: asString(json['verificationStatus'], 'verificationStatus'),
    );
  }
}

class BookingHold {
  const BookingHold({
    required this.slotId,
    required this.quantity,
    required this.state,
    required this.expiresAt,
  });

  final String slotId;
  final int quantity;
  final String state;
  final String expiresAt;
}

class Booking {
  const Booking({
    required this.id,
    required this.status,
    required this.travellerId,
    required this.hostId,
    required this.experienceId,
    required this.offerId,
    required this.startsAt,
    required this.endsAt,
    required this.participantCount,
    required this.currency,
    required this.subtotalMinor,
    required this.discountMinor,
    required this.taxMinor,
    required this.totalMinor,
    required this.commissionMinor,
    required this.hostGrossMinor,
    required this.title,
    required this.inclusions,
    required this.exclusions,
    required this.meetingArea,
    required this.cancellationPolicy,
    required this.createdAt,
    required this.hold,
  });

  final String id;
  final String status;
  final String travellerId;
  final String hostId;
  final String? experienceId;
  final String? offerId;
  final String startsAt;
  final String endsAt;
  final int participantCount;
  final String currency;
  final int subtotalMinor;
  final int discountMinor;
  final int taxMinor;
  final int totalMinor;
  final int commissionMinor;
  final int hostGrossMinor;
  final String title;
  final String inclusions;
  final String exclusions;
  final String meetingArea;
  final String cancellationPolicy;
  final String createdAt;
  final BookingHold? hold;

  factory Booking.fromJson(Map<String, dynamic> json) {
    final hold = json['hold'];
    return Booking(
      id: asString(json['id'], 'id'),
      status: asString(json['status'], 'status'),
      travellerId: asString(json['travellerId'], 'travellerId'),
      hostId: asString(json['hostId'], 'hostId'),
      experienceId: json['experienceId'] as String?,
      offerId: json['offerId'] as String?,
      startsAt: asString(json['startsAt'], 'startsAt'),
      endsAt: asString(json['endsAt'], 'endsAt'),
      participantCount: asInt(json['participantCount'], 'participantCount'),
      currency: asString(json['currency'], 'currency'),
      subtotalMinor: asInt(json['subtotalMinor'], 'subtotalMinor'),
      discountMinor: asInt(json['discountMinor'], 'discountMinor'),
      taxMinor: asInt(json['taxMinor'], 'taxMinor'),
      totalMinor: asInt(json['totalMinor'], 'totalMinor'),
      commissionMinor: asInt(json['commissionMinor'], 'commissionMinor'),
      hostGrossMinor: asInt(json['hostGrossMinor'], 'hostGrossMinor'),
      title: asString(json['title'], 'title'),
      inclusions: asString(json['inclusions'], 'inclusions'),
      exclusions: asString(json['exclusions'], 'exclusions'),
      meetingArea: asString(json['meetingArea'], 'meetingArea'),
      cancellationPolicy: asString(json['cancellationPolicy'], 'cancellationPolicy'),
      createdAt: asString(json['createdAt'], 'createdAt'),
      hold: hold is Map
          ? BookingHold(
              slotId: asString(hold['slotId'], 'hold.slotId'),
              quantity: asInt(hold['quantity'], 'hold.quantity'),
              state: asString(hold['state'], 'hold.state'),
              expiresAt: asString(hold['expiresAt'], 'hold.expiresAt'),
            )
          : null,
    );
  }
}

class TripRequest {
  const TripRequest({
    required this.id,
    required this.cityId,
    required this.startsOn,
    required this.endsOn,
    required this.partySize,
    required this.currency,
    required this.status,
    required this.expiresAt,
    required this.budgetMinor,
  });

  final String id;
  final String cityId;
  final String startsOn;
  final String endsOn;
  final int partySize;
  final String currency;
  final String status;
  final String expiresAt;
  final int? budgetMinor;

  factory TripRequest.fromJson(Map<String, dynamic> json) {
    return TripRequest(
      id: asString(json['id'], 'id'),
      cityId: asString(json['cityId'], 'cityId'),
      startsOn: asString(json['startsOn'], 'startsOn'),
      endsOn: asString(json['endsOn'], 'endsOn'),
      partySize: asInt(json['partySize'], 'partySize'),
      currency: asString(json['currency'], 'currency'),
      status: asString(json['status'], 'status'),
      expiresAt: asString(json['expiresAt'], 'expiresAt'),
      budgetMinor: json['budgetMinor'] == null ? null : asInt(json['budgetMinor'], 'budgetMinor'),
    );
  }
}

class Offer {
  const Offer({
    required this.id,
    required this.requestId,
    required this.hostId,
    required this.proposedStartsAt,
    required this.proposedEndsAt,
    required this.priceMinor,
    required this.currency,
    required this.inclusions,
    required this.exclusions,
    required this.cancellationPolicy,
    required this.expiresAt,
    required this.status,
  });

  final String id;
  final String requestId;
  final String hostId;
  final String proposedStartsAt;
  final String proposedEndsAt;
  final int priceMinor;
  final String currency;
  final String inclusions;
  final String exclusions;
  final String cancellationPolicy;
  final String expiresAt;
  final String status;

  factory Offer.fromJson(Map<String, dynamic> json) {
    return Offer(
      id: asString(json['id'], 'id'),
      requestId: asString(json['requestId'], 'requestId'),
      hostId: asString(json['hostId'], 'hostId'),
      proposedStartsAt: asString(json['proposedStartsAt'], 'proposedStartsAt'),
      proposedEndsAt: asString(json['proposedEndsAt'], 'proposedEndsAt'),
      priceMinor: asInt(json['priceMinor'], 'priceMinor'),
      currency: asString(json['currency'], 'currency'),
      inclusions: asString(json['inclusions'], 'inclusions'),
      exclusions: asString(json['exclusions'], 'exclusions'),
      cancellationPolicy: asString(json['cancellationPolicy'], 'cancellationPolicy'),
      expiresAt: asString(json['expiresAt'], 'expiresAt'),
      status: asString(json['status'], 'status'),
    );
  }
}

class PaymentAttemptView {
  const PaymentAttemptView({
    required this.attemptId,
    required this.status,
    required this.amountMinor,
    required this.currency,
    required this.provider,
  });

  final String attemptId;
  final String status;
  final int amountMinor;
  final String currency;
  final String provider;

  factory PaymentAttemptView.fromJson(Map<String, dynamic> json) {
    return PaymentAttemptView(
      attemptId: asString(json['attemptId'], 'attemptId'),
      status: asString(json['status'], 'status'),
      amountMinor: asInt(json['amountMinor'], 'amountMinor'),
      currency: asString(json['currency'], 'currency'),
      provider: asString(json['provider'], 'provider'),
    );
  }
}

class PaymentIntent {
  const PaymentIntent({
    required this.attemptId,
    required this.bookingId,
    required this.status,
    required this.amountMinor,
    required this.currency,
    required this.provider,
    required this.settlement,
    required this.providerOrderRef,
    required this.keyId,
  });

  final String attemptId;
  final String bookingId;
  final String status;
  final int amountMinor;
  final String currency;
  final String provider;
  final String settlement;
  final String providerOrderRef;
  final String keyId;

  factory PaymentIntent.fromJson(Map<String, dynamic> json) {
    final checkout = asMap(json['checkout'], 'checkout');
    return PaymentIntent(
      attemptId: asString(json['attemptId'], 'attemptId'),
      bookingId: asString(json['bookingId'], 'bookingId'),
      status: asString(json['status'], 'status'),
      amountMinor: asInt(json['amountMinor'], 'amountMinor'),
      currency: asString(json['currency'], 'currency'),
      provider: asString(json['provider'], 'provider'),
      settlement: asString(json['settlement'], 'settlement'),
      providerOrderRef: asString(checkout['providerOrderRef'], 'checkout.providerOrderRef'),
      keyId: asString(checkout['keyId'], 'checkout.keyId'),
    );
  }
}

class PaymentStatusView {
  const PaymentStatusView({
    required this.bookingId,
    required this.bookingStatus,
    required this.settlement,
    required this.payment,
  });

  final String bookingId;
  final String bookingStatus;
  final String settlement;
  final PaymentAttemptView? payment;

  factory PaymentStatusView.fromJson(Map<String, dynamic> json) {
    final payment = json['payment'];
    return PaymentStatusView(
      bookingId: asString(json['bookingId'], 'bookingId'),
      bookingStatus: asString(json['bookingStatus'], 'bookingStatus'),
      settlement: asString(json['settlement'], 'settlement'),
      payment: payment is Map
          ? PaymentAttemptView.fromJson(Map<String, dynamic>.from(payment))
          : null,
    );
  }
}

class RefundView {
  const RefundView({
    required this.id,
    required this.bookingId,
    required this.amountMinor,
    required this.currency,
    required this.reasonCode,
    required this.status,
  });

  final String id;
  final String bookingId;
  final int amountMinor;
  final String currency;
  final String reasonCode;
  final String status;

  factory RefundView.fromJson(Map<String, dynamic> json) {
    return RefundView(
      id: asString(json['id'], 'id'),
      bookingId: asString(json['bookingId'], 'bookingId'),
      amountMinor: asInt(json['amountMinor'], 'amountMinor'),
      currency: asString(json['currency'], 'currency'),
      reasonCode: asString(json['reasonCode'], 'reasonCode'),
      status: asString(json['status'], 'status'),
    );
  }
}

class PayoutAccount {
  const PayoutAccount({
    required this.accountHolderName,
    required this.ifsc,
    required this.accountLast4,
  });

  final String accountHolderName;
  final String ifsc;
  final String accountLast4;

  factory PayoutAccount.fromJson(Map<String, dynamic> json) {
    return PayoutAccount(
      accountHolderName: asString(json['accountHolderName'], 'accountHolderName'),
      ifsc: asString(json['ifsc'], 'ifsc'),
      accountLast4: asString(json['accountLast4'], 'accountLast4'),
    );
  }
}

class HostDocument {
  const HostDocument({
    required this.id,
    required this.documentType,
    required this.verificationState,
    required this.uploadStatus,
  });

  final String id;
  final String documentType;
  final String verificationState;
  final String? uploadStatus;

  factory HostDocument.fromJson(Map<String, dynamic> json) {
    final upload = json['upload'];
    return HostDocument(
      id: asString(json['id'], 'id'),
      documentType: asString(json['documentType'], 'documentType'),
      verificationState: asString(json['verificationState'], 'verificationState'),
      uploadStatus: upload is Map ? upload['status'] as String? : null,
    );
  }
}

class HostVerification {
  const HostVerification({
    required this.verificationStatus,
    required this.onboardingStatus,
    required this.publicProfileStatus,
    required this.note,
    required this.payoutAccount,
    required this.documents,
  });

  final String verificationStatus;
  final String onboardingStatus;
  final String publicProfileStatus;
  final String? note;
  final PayoutAccount? payoutAccount;
  final List<HostDocument> documents;

  factory HostVerification.fromJson(Map<String, dynamic> json) {
    final payout = json['payoutAccount'];
    return HostVerification(
      verificationStatus: asString(json['verificationStatus'], 'verificationStatus'),
      onboardingStatus: asString(json['onboardingStatus'], 'onboardingStatus'),
      publicProfileStatus: asString(json['publicProfileStatus'], 'publicProfileStatus'),
      note: json['note'] as String?,
      payoutAccount: payout is Map
          ? PayoutAccount.fromJson(Map<String, dynamic>.from(payout))
          : null,
      documents: asMapList(json['documents'], 'documents').map(HostDocument.fromJson).toList(),
    );
  }
}

class HostProfile {
  const HostProfile({
    required this.id,
    required this.publicName,
    required this.bio,
    required this.verificationStatus,
    required this.onboardingStatus,
    required this.publicProfileStatus,
    required this.payoutAccount,
  });

  final String id;
  final String publicName;
  final String? bio;
  final String verificationStatus;
  final String onboardingStatus;
  final String publicProfileStatus;
  final PayoutAccount? payoutAccount;

  factory HostProfile.fromJson(Map<String, dynamic> json) {
    final payout = json['payoutAccount'];
    return HostProfile(
      id: asString(json['id'], 'id'),
      publicName: asString(json['publicName'], 'publicName'),
      bio: json['bio'] as String?,
      verificationStatus: asString(json['verificationStatus'], 'verificationStatus'),
      onboardingStatus: asString(json['onboardingStatus'], 'onboardingStatus'),
      publicProfileStatus: asString(json['publicProfileStatus'], 'publicProfileStatus'),
      payoutAccount: payout is Map
          ? PayoutAccount.fromJson(Map<String, dynamic>.from(payout))
          : null,
    );
  }
}

class OwnExperience extends ExperienceDetail {
  OwnExperience({
    required super.id,
    required super.title,
    required super.category,
    required super.durationMinutes,
    required super.basePriceMinor,
    required super.currency,
    required super.capacity,
    required super.languageCodes,
    required super.cityId,
    required super.citySlug,
    required super.cityName,
    required super.hostId,
    required super.hostName,
    required super.hostVerificationStatus,
    required super.description,
    required super.inclusions,
    required super.exclusions,
    required super.meetingArea,
    required super.accessibilityNotes,
    required super.safetyNotes,
    required super.cancellationPolicy,
    required super.cityState,
    required super.cityCountryCode,
    required super.cityTimezone,
    required this.listingStatus,
    required this.moderationNote,
    required this.slots,
    required this.blackouts,
  });

  final String listingStatus;
  final String? moderationNote;
  final List<Slot> slots;
  final List<Blackout> blackouts;

  factory OwnExperience.fromJson(Map<String, dynamic> json) {
    final detail = ExperienceDetail.fromJson(json);
    return OwnExperience(
      id: detail.id,
      title: detail.title,
      category: detail.category,
      durationMinutes: detail.durationMinutes,
      basePriceMinor: detail.basePriceMinor,
      currency: detail.currency,
      capacity: detail.capacity,
      languageCodes: detail.languageCodes,
      cityId: detail.cityId,
      citySlug: detail.citySlug,
      cityName: detail.cityName,
      hostId: detail.hostId,
      hostName: detail.hostName,
      hostVerificationStatus: detail.hostVerificationStatus,
      description: detail.description,
      inclusions: detail.inclusions,
      exclusions: detail.exclusions,
      meetingArea: detail.meetingArea,
      accessibilityNotes: detail.accessibilityNotes,
      safetyNotes: detail.safetyNotes,
      cancellationPolicy: detail.cancellationPolicy,
      cityState: detail.cityState,
      cityCountryCode: detail.cityCountryCode,
      cityTimezone: detail.cityTimezone,
      listingStatus: asString(json['listingStatus'], 'listingStatus'),
      moderationNote: json['moderationNote'] as String?,
      slots: asMapList(json['slots'], 'slots').map(Slot.fromJson).toList(),
      blackouts: asMapList(json['blackouts'], 'blackouts').map(Blackout.fromJson).toList(),
    );
  }
}

class Blackout {
  const Blackout({required this.id, required this.startsAt, required this.endsAt});

  final String id;
  final String startsAt;
  final String endsAt;

  factory Blackout.fromJson(Map<String, dynamic> json) {
    return Blackout(
      id: asString(json['id'], 'id'),
      startsAt: asString(json['startsAt'], 'startsAt'),
      endsAt: asString(json['endsAt'], 'endsAt'),
    );
  }
}

class Earnings {
  const Earnings({required this.settlement, required this.items});

  final String settlement;
  final List<EarningsItem> items;

  factory Earnings.fromJson(Map<String, dynamic> json) {
    return Earnings(
      settlement: asString(json['settlement'], 'settlement'),
      items: asMapList(json['items'], 'items').map(EarningsItem.fromJson).toList(),
    );
  }
}

class EarningsItem {
  const EarningsItem({
    required this.currency,
    required this.hostPayableMinor,
    required this.allocatedMinor,
    required this.availableMinor,
  });

  final String currency;
  final int hostPayableMinor;
  final int allocatedMinor;
  final int availableMinor;

  factory EarningsItem.fromJson(Map<String, dynamic> json) {
    return EarningsItem(
      currency: asString(json['currency'], 'currency'),
      hostPayableMinor: asInt(json['hostPayableMinor'], 'hostPayableMinor'),
      allocatedMinor: asInt(json['allocatedMinor'], 'allocatedMinor'),
      availableMinor: asInt(json['availableMinor'], 'availableMinor'),
    );
  }
}

class PayoutAllocation {
  const PayoutAllocation({required this.bookingId, required this.amountMinor});

  final String bookingId;
  final int amountMinor;
}

class Payout {
  const Payout({
    required this.id,
    required this.amountMinor,
    required this.currency,
    required this.status,
    required this.settlement,
    required this.allocations,
  });

  final String id;
  final int amountMinor;
  final String currency;
  final String status;
  final String settlement;
  final List<PayoutAllocation> allocations;

  factory Payout.fromJson(Map<String, dynamic> json) {
    return Payout(
      id: asString(json['id'], 'id'),
      amountMinor: asInt(json['amountMinor'], 'amountMinor'),
      currency: asString(json['currency'], 'currency'),
      status: asString(json['status'], 'status'),
      settlement: asString(json['settlement'], 'settlement'),
      allocations: asMapList(json['allocations'], 'allocations')
          .map(
            (row) => PayoutAllocation(
              bookingId: asString(row['bookingId'], 'bookingId'),
              amountMinor: asInt(row['amountMinor'], 'amountMinor'),
            ),
          )
          .toList(),
    );
  }
}

class DiscoveryQuery {
  const DiscoveryQuery({
    this.city,
    this.date,
    this.category,
    this.language,
    this.minPrice,
    this.maxPrice,
    this.minDuration,
    this.maxDuration,
    this.partySize,
    this.verifiedHost,
    this.cursor,
  });

  final String? city;
  final String? date;
  final String? category;
  final String? language;
  final int? minPrice;
  final int? maxPrice;
  final int? minDuration;
  final int? maxDuration;
  final int? partySize;
  final bool? verifiedHost;
  final String? cursor;

  Map<String, String> toQuery() {
    final query = <String, String>{};
    void put(String key, Object? value) {
      if (value == null) {
        return;
      }
      final text = value.toString();
      if (text.isEmpty) {
        return;
      }
      query[key] = text;
    }

    put('city', city);
    put('date', date);
    put('category', category);
    put('language', language);
    put('minPrice', minPrice);
    put('maxPrice', maxPrice);
    put('minDuration', minDuration);
    put('maxDuration', maxDuration);
    put('partySize', partySize);
    if (verifiedHost != null) {
      query['verifiedHost'] = verifiedHost! ? 'true' : 'false';
    }
    put('cursor', cursor);
    return query;
  }
}

String asString(Object? value, String field) {
  if (value is String) {
    return value;
  }
  throw FormatException('Missing $field.');
}

int asInt(Object? value, String field) {
  if (value is int) {
    return value;
  }
  throw FormatException('Missing $field.');
}

List<String> asStringList(Object? value, String field) {
  if (value is! List) {
    throw FormatException('Missing $field.');
  }
  return value.map((item) => asString(item, field)).toList();
}

Map<String, dynamic> asMap(Object? value, String field) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return value.map((key, item) => MapEntry(key.toString(), item));
  }
  throw FormatException('Missing $field.');
}

List<Map<String, dynamic>> asMapList(Object? value, String field) {
  if (value is! List) {
    throw FormatException('Missing $field.');
  }
  return value.map((item) => asMap(item, field)).toList();
}

ApiPage<T> parsePage<T>(
  Map<String, dynamic>? json,
  T Function(Map<String, dynamic> json) parse,
) {
  if (json == null) {
    throw const FormatException('Missing page.');
  }
  final cursor = json['nextCursor'];
  return ApiPage(
    asMapList(json['items'], 'items').map(parse).toList(),
    cursor is String && cursor.isNotEmpty ? cursor : null,
  );
}

List<T> parseItems<T>(
  Map<String, dynamic>? json,
  T Function(Map<String, dynamic> json) parse,
) {
  if (json == null) {
    throw const FormatException('Missing items.');
  }
  return asMapList(json['items'], 'items').map(parse).toList();
}
