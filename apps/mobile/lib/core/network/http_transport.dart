import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:mittiandmiles/core/network/api_exception.dart';

class TransportRequest {
  const TransportRequest({
    required this.method,
    required this.uri,
    required this.headers,
    this.body,
  });

  final String method;
  final Uri uri;
  final Map<String, String> headers;
  final String? body;
}

class TransportResponse {
  const TransportResponse(this.statusCode, this.body);

  final int statusCode;
  final String body;
}

abstract class HttpTransport {
  Future<TransportResponse> send(TransportRequest request);
}

class IoHttpTransport implements HttpTransport {
  @override
  Future<TransportResponse> send(TransportRequest request) async {
    final client = HttpClient();
    try {
      final ioRequest = await client
          .openUrl(request.method, request.uri)
          .timeout(const Duration(seconds: 20));
      request.headers.forEach(ioRequest.headers.set);
      if (request.body != null) {
        ioRequest.headers.contentType = ContentType.json;
        ioRequest.add(utf8.encode(request.body!));
      }
      final response = await ioRequest.close().timeout(const Duration(seconds: 20));
      final text = await utf8.decodeStream(response);
      return TransportResponse(response.statusCode, text);
    } on SocketException {
      throw ApiException.offlineError;
    } on TimeoutException {
      throw ApiException.offlineError;
    } finally {
      client.close(force: true);
    }
  }
}
