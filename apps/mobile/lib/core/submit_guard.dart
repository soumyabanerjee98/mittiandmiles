import 'dart:convert';
import 'dart:math';

final _keyPattern = RegExp(r'^[A-Za-z0-9_-]{8,128}$');

String newIdempotencyKey() {
  final bytes = List<int>.generate(16, (_) => Random.secure().nextInt(256));
  final key = base64Url.encode(bytes).replaceAll('=', '');
  if (!_keyPattern.hasMatch(key)) {
    throw StateError('Generated an invalid idempotency key.');
  }
  return key;
}

/// Keeps one idempotency key for retries and ignores overlapping taps.
class SubmitGuard {
  SubmitGuard({String Function()? newKey}) : _newKey = newKey ?? newIdempotencyKey;

  final String Function() _newKey;
  String? _key;
  bool _busy = false;

  bool get busy => _busy;

  String? get key => _key;

  /// Returns null when a submission is already in flight.
  String? begin() {
    if (_busy) {
      return null;
    }
    _busy = true;
    _key ??= _newKey();
    return _key;
  }

  void finish() {
    _busy = false;
  }

  void reset() {
    _busy = false;
    _key = null;
  }
}
