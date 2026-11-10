import 'package:flutter_test/flutter_test.dart';
import 'package:mittiandmiles/core/network/api_client.dart';
import 'package:mittiandmiles/core/network/api_exception.dart';
import 'package:mittiandmiles/core/network/http_transport.dart';
import 'package:mittiandmiles/core/session/token_store.dart';
import 'package:mittiandmiles/core/submit_guard.dart';
import 'package:mittiandmiles/data/models.dart';
import 'package:mittiandmiles/data/payloads.dart';

void main() {
  test('idempotency key is reused until the submission is reset', () {
    final guard = SubmitGuard(newKey: () => 'repeat-key');
    expect(guard.begin(), 'repeat-key');
    expect(guard.begin(), isNull);
    guard.finish();
    expect(guard.begin(), 'repeat-key');
    guard.reset();
    expect(guard.begin(), 'repeat-key');
  });

  test('generated idempotency keys match the API pattern', () {
    expect(RegExp(r'^[A-Za-z0-9_-]{8,128}$').hasMatch(newIdempotencyKey()), isTrue);
  });

  test('payout body cannot carry verification or settlement fields', () {
    final body = payoutAccountBody(
      accountHolderName: ' Ada Lovelace ',
      ifsc: 'hdfc0001234',
      accountNumber: '123456789012',
    );
    expect(body.keys, ['accountHolderName', 'ifsc', 'accountNumber']);
    expect(body['ifsc'], 'HDFC0001234');
    expect(body.containsKey('verificationStatus'), isFalse);
    expect(body.containsKey('status'), isFalse);
  });

  test('experience draft omits listing and payment fields', () {
    const draft = ExperienceDraft(
      cityId: 'city',
      category: 'food',
      title: 'Walk',
      description: 'A walk',
      durationMinutes: 90,
      basePriceMinor: 10000,
      currency: 'INR',
      capacity: 4,
      inclusions: 'Tea',
      exclusions: 'Transport',
      meetingArea: 'Gate',
      cancellationPolicy: 'One day',
      languageCodes: ['en'],
    );
    expect(draft.toJson().containsKey('listingStatus'), isFalse);
    expect(draft.toJson().containsKey('paymentStatus'), isFalse);
  });

  test('expired access token refreshes once and retries', () async {
    final tokens = MemoryTokenStore();
    await tokens.write(
      const AuthTokens(
        accessToken: 'old-access',
        refreshToken: 'refresh-token-value',
        tokenType: 'Bearer',
        expiresIn: 60,
      ),
    );
    final transport = _QueueTransport([
      const TransportResponse(401, '{"error":{"code":"UNAUTHENTICATED","message":"Authentication required."}}'),
      const TransportResponse(
        200,
        '{"accessToken":"new-access","refreshToken":"next-refresh-token","tokenType":"Bearer","expiresIn":60}',
      ),
      const TransportResponse(
        200,
        '{"id":"11111111-1111-4111-8111-111111111111","email":"ada@example.com","accountStatus":"ACTIVE","locale":"en","roles":["TRAVELLER"],"adminAccess":false}',
      ),
    ]);
    final client = ApiClient(
      baseUrl: 'http://localhost:3000',
      tokens: tokens,
      transport: transport,
    );

    final me = await client.get('/me');
    expect(me?['email'], 'ada@example.com');
    expect((await tokens.read())?.accessToken, 'new-access');
    expect(transport.uris.map((uri) => uri.path).toList(), [
      '/api/v1/me',
      '/api/v1/auth/refresh',
      '/api/v1/me',
    ]);
  });

  test('failed refresh clears the session', () async {
    final tokens = MemoryTokenStore();
    await tokens.write(
      const AuthTokens(
        accessToken: 'old-access',
        refreshToken: 'refresh-token-value',
        tokenType: 'Bearer',
        expiresIn: 60,
      ),
    );
    var expired = false;
    final client = ApiClient(
      baseUrl: 'http://localhost:3000',
      tokens: tokens,
      transport: _QueueTransport([
        const TransportResponse(401, '{"error":{"code":"UNAUTHENTICATED","message":"Authentication required."}}'),
        const TransportResponse(401, '{"error":{"code":"UNAUTHENTICATED","message":"Authentication required."}}'),
      ]),
      onSessionExpired: () => expired = true,
    );

    await expectLater(
      client.get('/me'),
      throwsA(
        isA<ApiException>().having((error) => error.sessionExpired, 'sessionExpired', isTrue),
      ),
    );
    expect(expired, isTrue);
    expect(await tokens.read(), isNull);
  });

  test('offline transport becomes an offline error', () async {
    final client = ApiClient(
      baseUrl: 'http://localhost:3000',
      tokens: MemoryTokenStore(),
      transport: _ThrowingTransport(ApiException.offlineError),
    );
    await expectLater(
      client.send(
        'POST',
        '/auth/login',
        auth: false,
        body: {'email': 'a@b.co', 'password': 'secret'},
      ),
      throwsA(isA<ApiException>().having((error) => error.offline, 'offline', isTrue)),
    );
  });
}

class _QueueTransport implements HttpTransport {
  _QueueTransport(this.responses);

  final List<TransportResponse> responses;
  final uris = <Uri>[];

  @override
  Future<TransportResponse> send(TransportRequest request) async {
    uris.add(request.uri);
    return responses.removeAt(0);
  }
}

class _ThrowingTransport implements HttpTransport {
  _ThrowingTransport(this.error);

  final ApiException error;

  @override
  Future<TransportResponse> send(TransportRequest request) async {
    throw error;
  }
}
