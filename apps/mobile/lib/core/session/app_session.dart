import 'package:flutter/foundation.dart';
import 'package:mittiandmiles/core/network/api_exception.dart';
import 'package:mittiandmiles/core/session/session_capabilities.dart';
import 'package:mittiandmiles/core/session/token_store.dart';
import 'package:mittiandmiles/data/marketplace_api.dart';
import 'package:mittiandmiles/data/models.dart';

class AppSession extends ChangeNotifier {
  AppSession({
    required this.api,
    required this.tokens,
    Account? initialAccount,
  }) : account = initialAccount;

  final MarketplaceApi api;
  final TokenStore tokens;

  Account? account;
  String? startupError;
  final List<String> recentTripRequestIds = [];

  bool get signedIn => account != null;

  SessionCapabilities get capabilities =>
      SessionCapabilities(adminAccess: account?.adminAccess ?? false);

  Future<void> restore() async {
    final stored = await tokens.read();
    if (stored == null) {
      notifyListeners();
      return;
    }
    try {
      account = await api.me();
      startupError = null;
    } on ApiException catch (error) {
      account = null;
      if (!error.sessionExpired) {
        startupError = error.message;
      }
    }
    notifyListeners();
  }

  Future<void> signIn({required String email, required String password}) async {
    final issued = await api.login(email: email, password: password);
    await _adopt(issued);
  }

  Future<void> register({
    required String email,
    required String password,
    String locale = 'en',
  }) async {
    final issued = await api.register(
      email: email,
      password: password,
      locale: locale,
    );
    await _adopt(issued);
  }

  Future<void> _adopt(AuthTokens issued) async {
    await tokens.write(issued);
    try {
      account = await api.me();
      startupError = null;
    } catch (error) {
      await tokens.clear();
      account = null;
      rethrow;
    }
    notifyListeners();
  }

  Future<void> refreshAccount() async {
    account = await api.me();
    startupError = null;
    notifyListeners();
  }

  Future<void> updateLocale(String locale) async {
    account = await api.updateLocale(locale);
    notifyListeners();
  }

  Future<void> signOut() async {
    try {
      await api.logout();
    } catch (_) {
      // Local sign-out still proceeds so a revoked token cannot stay on device.
    }
    await tokens.clear();
    account = null;
    recentTripRequestIds.clear();
    startupError = null;
    notifyListeners();
  }

  void expireLocal() {
    account = null;
    startupError = null;
    recentTripRequestIds.clear();
    notifyListeners();
  }

  void rememberTripRequest(String id) {
    recentTripRequestIds.remove(id);
    recentTripRequestIds.insert(0, id);
    notifyListeners();
  }
}
