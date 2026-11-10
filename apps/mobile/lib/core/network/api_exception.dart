class ApiFieldError {
  const ApiFieldError({required this.field, required this.message});

  final String field;
  final String message;
}

/// Error envelope from `/api/v1`, or a local network failure.
class ApiException implements Exception {
  const ApiException({
    required this.statusCode,
    required this.code,
    required this.message,
    this.requestId,
    this.details = const [],
    this.sessionExpired = false,
  });

  final int statusCode;
  final String code;
  final String message;
  final String? requestId;
  final List<ApiFieldError> details;
  final bool sessionExpired;

  bool get offline => code == 'OFFLINE';

  static const session = ApiException(
    statusCode: 401,
    code: 'UNAUTHENTICATED',
    message: 'Your session has expired. Sign in again.',
    sessionExpired: true,
  );

  static const offlineError = ApiException(
    statusCode: 0,
    code: 'OFFLINE',
    message: 'The network is unavailable. Check your connection and try again.',
  );

  factory ApiException.fromBody(int statusCode, Object? decoded) {
    if (decoded is Map) {
      final envelope = decoded['error'];
      if (envelope is Map) {
        final details = <ApiFieldError>[];
        final rawDetails = envelope['details'];
        if (rawDetails is List) {
          for (final item in rawDetails) {
            if (item is Map) {
              details.add(
                ApiFieldError(
                  field: item['field']?.toString() ?? '',
                  message: item['message']?.toString() ?? 'Invalid value.',
                ),
              );
            }
          }
        }
        final requestId = envelope['requestId'];
        return ApiException(
          statusCode: statusCode,
          code: envelope['code']?.toString() ?? 'REQUEST_FAILED',
          message: envelope['message']?.toString() ?? 'The request failed.',
          requestId: requestId is String ? requestId : null,
          details: details,
        );
      }
    }
    return ApiException(
      statusCode: statusCode,
      code: 'REQUEST_FAILED',
      message: 'The server returned an unexpected response.',
    );
  }

  @override
  String toString() => message;
}
