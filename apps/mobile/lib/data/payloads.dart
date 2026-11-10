final _instant = RegExp(
  r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$',
);
final _day = RegExp(r'^\d{4}-\d{2}-\d{2}$');
final _currency = RegExp(r'^[A-Z]{3}$');

class ExperienceDraft {
  const ExperienceDraft({
    required this.cityId,
    required this.category,
    required this.title,
    required this.description,
    required this.durationMinutes,
    required this.basePriceMinor,
    required this.currency,
    required this.capacity,
    required this.inclusions,
    required this.exclusions,
    required this.meetingArea,
    required this.cancellationPolicy,
    required this.languageCodes,
    this.accessibilityNotes,
    this.safetyNotes,
  });

  final String cityId;
  final String category;
  final String title;
  final String description;
  final int durationMinutes;
  final int basePriceMinor;
  final String currency;
  final int capacity;
  final String inclusions;
  final String exclusions;
  final String meetingArea;
  final String cancellationPolicy;
  final List<String> languageCodes;
  final String? accessibilityNotes;
  final String? safetyNotes;

  Map<String, Object> toJson() {
    final body = <String, Object>{
      'cityId': cityId,
      'category': category,
      'title': title,
      'description': description,
      'durationMinutes': durationMinutes,
      'basePriceMinor': basePriceMinor,
      'currency': currency,
      'capacity': capacity,
      'inclusions': inclusions,
      'exclusions': exclusions,
      'meetingArea': meetingArea,
      'cancellationPolicy': cancellationPolicy,
      'languageCodes': languageCodes,
    };
    if (accessibilityNotes != null) {
      body['accessibilityNotes'] = accessibilityNotes!;
    }
    if (safetyNotes != null) {
      body['safetyNotes'] = safetyNotes!;
    }
    return body;
  }
}

class SlotDraft {
  const SlotDraft({
    required this.startsAt,
    required this.endsAt,
    required this.capacity,
  });

  final String startsAt;
  final String endsAt;
  final int capacity;

  Map<String, Object> toJson() => {
        'startsAt': startsAt,
        'endsAt': endsAt,
        'capacity': capacity,
      };
}

class BlackoutDraft {
  const BlackoutDraft({required this.startsAt, required this.endsAt});

  final String startsAt;
  final String endsAt;

  Map<String, Object> toJson() => {'startsAt': startsAt, 'endsAt': endsAt};
}

class OfferDraft {
  const OfferDraft({
    required this.proposedStartsAt,
    required this.proposedEndsAt,
    required this.priceMinor,
    required this.currency,
    required this.inclusions,
    required this.exclusions,
    required this.cancellationPolicy,
    required this.expiresAt,
  });

  final String proposedStartsAt;
  final String proposedEndsAt;
  final int priceMinor;
  final String currency;
  final String inclusions;
  final String exclusions;
  final String cancellationPolicy;
  final String expiresAt;

  Map<String, Object> toJson() => {
        'proposedStartsAt': proposedStartsAt,
        'proposedEndsAt': proposedEndsAt,
        'priceMinor': priceMinor,
        'currency': currency,
        'inclusions': inclusions,
        'exclusions': exclusions,
        'cancellationPolicy': cancellationPolicy,
        'expiresAt': expiresAt,
      };
}

class TripRequestDraft {
  const TripRequestDraft({
    required this.cityId,
    required this.startsOn,
    required this.endsOn,
    required this.partySize,
    required this.currency,
    this.budgetMinor,
    this.notes,
  });

  final String cityId;
  final String startsOn;
  final String endsOn;
  final int partySize;
  final String currency;
  final int? budgetMinor;
  final String? notes;

  Map<String, Object> toJson() {
    final body = <String, Object>{
      'cityId': cityId,
      'startsOn': startsOn,
      'endsOn': endsOn,
      'partySize': partySize,
      'currency': currency,
    };
    if (budgetMinor != null) {
      body['budgetMinor'] = budgetMinor!;
    }
    if (notes != null && notes!.isNotEmpty) {
      body['preferences'] = {'notes': notes!};
    }
    return body;
  }
}

/// Bank details a host may save. Verification and payout settlement are absent.
Map<String, Object> payoutAccountBody({
  required String accountHolderName,
  required String ifsc,
  required String accountNumber,
}) {
  return {
    'accountHolderName': accountHolderName.trim(),
    'ifsc': ifsc.trim().toUpperCase(),
    'accountNumber': accountNumber.trim(),
  };
}

bool isInstant(String value) => _instant.hasMatch(value);

bool isDay(String value) => _day.hasMatch(value);

bool isCurrency(String value) => _currency.hasMatch(value);
