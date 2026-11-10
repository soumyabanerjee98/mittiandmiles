import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mittiandmiles/core/session/token_store.dart';
import 'package:mittiandmiles/data/models.dart';

/// Stores access and refresh tokens in the platform keystore.
class SecureTokenStore implements TokenStore {
  SecureTokenStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _access = 'mitti.access_token';
  static const _refresh = 'mitti.refresh_token';
  static const _type = 'mitti.token_type';
  static const _expires = 'mitti.expires_in';

  final FlutterSecureStorage _storage;

  @override
  Future<void> clear() async {
    await _storage.delete(key: _access);
    await _storage.delete(key: _refresh);
    await _storage.delete(key: _type);
    await _storage.delete(key: _expires);
  }

  @override
  Future<AuthTokens?> read() async {
    final access = await _storage.read(key: _access);
    final refresh = await _storage.read(key: _refresh);
    final type = await _storage.read(key: _type);
    final expires = int.tryParse(await _storage.read(key: _expires) ?? '');
    if (access == null ||
        access.isEmpty ||
        refresh == null ||
        refresh.isEmpty ||
        type == null ||
        expires == null) {
      return null;
    }
    return AuthTokens(
      accessToken: access,
      refreshToken: refresh,
      tokenType: type,
      expiresIn: expires,
    );
  }

  @override
  Future<void> write(AuthTokens tokens) async {
    await _storage.write(key: _access, value: tokens.accessToken);
    await _storage.write(key: _refresh, value: tokens.refreshToken);
    await _storage.write(key: _type, value: tokens.tokenType);
    await _storage.write(key: _expires, value: tokens.expiresIn.toString());
  }
}
