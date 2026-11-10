import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

/// Result of the native sheet. It is not a payment confirmation.
enum RazorpayCheckoutKind { completed, failed, externalWallet }

class RazorpayCheckoutEvent {
  const RazorpayCheckoutEvent(this.kind, {this.message});

  final RazorpayCheckoutKind kind;
  final String? message;
}

class RazorpayCheckoutOptions {
  const RazorpayCheckoutOptions({
    required this.keyId,
    required this.amountMinor,
    required this.currency,
    required this.orderId,
    required this.description,
    this.email,
  });

  final String keyId;
  final int amountMinor;
  final String currency;
  final String orderId;
  final String description;
  final String? email;

  Map<String, dynamic> toOptions() {
    return {
      'key': keyId,
      'amount': amountMinor,
      'currency': currency,
      'order_id': orderId,
      'name': 'Mitti and Miles',
      'description': description,
      'theme': {'color': '#3E6212'},
      if (email != null && email!.isNotEmpty) 'prefill': {'email': email},
    };
  }
}

typedef RazorpayCheckoutHandler = void Function(RazorpayCheckoutEvent event);

abstract class RazorpayCheckout {
  void open(RazorpayCheckoutOptions options);

  void dispose();
}

bool get razorpayCheckoutSupported {
  if (kIsWeb) {
    return false;
  }
  return defaultTargetPlatform == TargetPlatform.android ||
      defaultTargetPlatform == TargetPlatform.iOS;
}

/// Opens the official Razorpay sheet. Success, failure, and wallet events
/// are reported back without treating them as a captured payment.
class PluginRazorpayCheckout implements RazorpayCheckout {
  PluginRazorpayCheckout(this._onReturn) {
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _completed);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _failed);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _wallet);
  }

  final RazorpayCheckoutHandler _onReturn;
  late final Razorpay _razorpay;

  /// The native success payload is intentionally unused. Capture is confirmed
  /// by the signed webhook, then read from payment status.
  void _completed(PaymentSuccessResponse _) {
    _onReturn(const RazorpayCheckoutEvent(RazorpayCheckoutKind.completed));
  }

  void _failed(PaymentFailureResponse response) {
    final message = response.message;
    _onReturn(
      RazorpayCheckoutEvent(
        RazorpayCheckoutKind.failed,
        message: message == null || message.isEmpty
            ? 'Razorpay checkout did not finish.'
            : message,
      ),
    );
  }

  void _wallet(ExternalWalletResponse response) {
    final name = response.walletName;
    _onReturn(
      RazorpayCheckoutEvent(
        RazorpayCheckoutKind.externalWallet,
        message: name == null || name.isEmpty
            ? 'An external wallet was selected.'
            : 'External wallet selected: $name.',
      ),
    );
  }

  @override
  void open(RazorpayCheckoutOptions options) {
    try {
      _razorpay.open(options.toOptions());
    } on MissingPluginException {
      _onReturn(
        const RazorpayCheckoutEvent(
          RazorpayCheckoutKind.failed,
          message: 'Razorpay checkout is available in the Android and iOS apps.',
        ),
      );
    } on PlatformException catch (error) {
      _onReturn(
        RazorpayCheckoutEvent(
          RazorpayCheckoutKind.failed,
          message: error.message ?? 'Razorpay checkout could not open.',
        ),
      );
    }
  }

  @override
  void dispose() {
    _razorpay.clear();
  }
}

RazorpayCheckout pluginRazorpayCheckout(RazorpayCheckoutHandler onReturn) {
  return PluginRazorpayCheckout(onReturn);
}
