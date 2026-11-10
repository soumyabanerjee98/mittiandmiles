import 'dart:convert';

import 'package:mittiandmiles/core/network/api_exception.dart';
import 'package:mittiandmiles/core/network/http_transport.dart';
import 'package:mittiandmiles/core/session/token_store.dart';
import 'package:mittiandmiles/data/models.dart';

class ApiClient {
  ApiClient({
    required this.baseUrl,
    required this.tokens,
    required this.transport,
    this.onSessionExpired,
  });

  final String baseUrl;
  final TokenStore tokens;
  final HttpTransport transport;
  void Function()? onSessionExpired;

  Future<bool>? _refreshInFlight;

  Future<Map<String, dynamic>?> get(
    String path, {
    Map<String, String>? query,
    bool auth = true,
  }) {
    return _send('GET', path, query: query, auth: auth);
  }

  Future<Map<String, dynamic>?> send(
    String method,
    String path, {
    Map<String, String>? query,
    Object? body,
    bool auth = true,
    String? idempotencyKey,
  }) {
    return _send(
      method,
      path,
      query: query,
      body: body,
      auth: auth,
      idempotencyKey: idempotencyKey,
    );
  }

  Future<Map<String, dynamic>?> _send(
    String method,
    String path, {
    Map<String, String>? query,
    Object? body,
    required bool auth,
    String? idempotencyKey,
    bool retried = false,
  }) async {
    final response = await _dispatch(
      method,
      path,
      query: query,
      body: body,
      auth: auth,
      idempotencyKey: idempotencyKey,
    );
    if (response.statusCode == 401 && auth) {
      if (!retried && await _refresh()) {
        return _send(
          method,
          path,
          query: query,
          body: body,
          auth: auth,
          idempotencyKey: idempotencyKey,
          retried: true,
        );
      }
      await tokens.clear();
      onSessionExpired?.call();
      throw ApiException.session;
    }
    return _decode(response);
  }

  Future<TransportResponse> _dispatch(
    String method,
    String path, {
    Map<String, String>? query,
    Object? body,
    required bool auth,
    String? idempotencyKey,
  }) async {
    final headers = <String, String>{'Accept': 'application/json'};
    if (auth) {
      final stored = await tokens.read();
      if (stored == null) {
        await tokens.clear();
        onSessionExpired?.call();
        throw ApiException.session;
      }
      headers['Authorization'] = 'Bearer ${stored.accessToken}';
    }
    if (idempotencyKey != null) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    return transport.send(
      TransportRequest(
        method: method,
        uri: _uri(path, query),
        headers: headers,
        body: body == null ? null : jsonEncode(body),
      ),
    );
  }

  Future<bool> _refresh() {
    final existing = _refreshInFlight;
    if (existing != null) {
      return existing;
    }
    final future = _refreshOnce();
    _refreshInFlight = future;
    return future.whenComplete(() {
      if (identical(_refreshInFlight, future)) {
        _refreshInFlight = null;
      }
    });
  }

  Future<bool> _refreshOnce() async {
    final stored = await tokens.read();
    if (stored == null) {
      return false;
    }
    try {
      final response = await transport.send(
        TransportRequest(
          method: 'POST',
          uri: _uri('/auth/refresh', null),
          headers: const {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({'refreshToken': stored.refreshToken}),
        ),
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return false;
      }
      final decoded = jsonDecode(response.body);
      if (decoded is! Map) {
        return false;
      }
      await tokens.write(AuthTokens.fromJson(Map<String, dynamic>.from(decoded)));
      return true;
    } on ApiException {
      return false;
    } on FormatException {
      return false;
    }
  }

  Map<String, dynamic>? _decode(TransportResponse response) {
    if (response.statusCode == 204 || response.body.isEmpty) {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return null;
      }
    }
    Object? decoded;
    if (response.body.isNotEmpty) {
      try {
        decoded = jsonDecode(response.body);
      } on FormatException {
        decoded = null;
      }
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException.fromBody(response.statusCode, decoded);
    }
    if (decoded == null) {
      return null;
    }
    if (decoded is! Map) {
      throw const ApiException(
        statusCode: 200,
        code: 'INVALID_RESPONSE',
        message: 'The server returned an unexpected response.',
      );
    }
    return Map<String, dynamic>.from(decoded);
  }

  Uri _uri(String path, Map<String, String>? query) {
    final origin = Uri.parse(baseUrl);
    return origin.replace(
      path: '/api/v1$path',
      queryParameters: query == null || query.isEmpty ? null : query,
    );
  }
}
