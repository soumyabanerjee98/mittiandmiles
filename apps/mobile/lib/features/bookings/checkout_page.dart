import 'package:flutter/material.dart';
import 'package:mittiandmiles/core/network/api_exception.dart';
import 'package:mittiandmiles/core/session/app_session_scope.dart';
import 'package:mittiandmiles/core/submit_guard.dart';
import 'package:mittiandmiles/core/widgets/ui.dart';
import 'package:mittiandmiles/data/models.dart';
import 'package:mittiandmiles/features/bookings/razorpay_checkout.dart';

/// Provider checkout. Payment is shown only from the server status endpoint.
class CheckoutPage extends StatefulWidget {
  const CheckoutPage({
    super.key,
    required this.bookingId,
    this.checkoutFactory,
  });

  final String bookingId;

  /// Test seam. Production uses the native Razorpay sheet.
  final RazorpayCheckout Function(RazorpayCheckoutHandler onReturn)? checkoutFactory;

  @override
  State<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends State<CheckoutPage> {
  final _guard = SubmitGuard();
  Booking? _booking;
  PaymentStatusView? _status;
  PaymentIntent? _intent;
  RazorpayCheckout? _checkout;
  String? _checkoutNote;
  bool _loading = true;
  Object? _error;

  @override
  void dispose() {
    _checkout?.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _load();
      }
    });
  }

  Future<void> _load() async {
    setState(() {
      _loading = _booking == null;
      _error = null;
    });
    final api = AppSessionScope.of(context).api;
    try {
      final booking = await api.booking(widget.bookingId);
      final status = await api.paymentStatus(widget.bookingId);
      if (!mounted) {
        return;
      }
      setState(() {
        _booking = booking;
        _status = status;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (error.sessionExpired) {
        AppSessionScope.of(context).expireLocal();
      }
      if (mounted) {
        setState(() {
          _error = error;
          _loading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error;
          _loading = false;
        });
      }
    }
  }

  Future<void> _startCheckout() async {
    final key = _guard.begin();
    if (key == null) {
      return;
    }
    setState(() => _error = null);
    try {
      final intent = await AppSessionScope.of(context).api.createPaymentIntent(
            widget.bookingId,
            idempotencyKey: key,
          );
      if (!mounted) {
        _guard.finish();
        return;
      }
      setState(() => _intent = intent);
      if (intent.provider == 'razorpay') {
        _openRazorpay(intent);
        return;
      }
      _guard.reset();
      await _load();
    } on ApiException catch (error) {
      _guard.finish();
      if (!mounted) {
        return;
      }
      if (error.sessionExpired) {
        AppSessionScope.of(context).expireLocal();
      }
      setState(() => _error = error);
    } catch (error) {
      _guard.finish();
      if (mounted) {
        setState(() => _error = error);
      }
    }
  }

  void _openRazorpay(PaymentIntent intent) {
    if (!razorpayCheckoutSupported) {
      _guard.reset();
      setState(() {
        _checkoutNote =
            'Razorpay checkout opens in the Android and iOS app. Payment is still confirmed only by the server.';
      });
      _load();
      return;
    }
    final email = AppSessionScope.of(context).account?.email;
    final checkout = _checkout ??= (widget.checkoutFactory ?? pluginRazorpayCheckout)(
      _onCheckoutReturn,
    );
    checkout.open(
      RazorpayCheckoutOptions(
        keyId: intent.keyId,
        amountMinor: intent.amountMinor,
        currency: intent.currency,
        orderId: intent.providerOrderRef,
        description: _booking?.title ?? 'Experience booking',
        email: email,
      ),
    );
  }

  void _onCheckoutReturn(RazorpayCheckoutEvent event) {
    if (!mounted) {
      return;
    }
    _guard.reset();
    final note = switch (event.kind) {
      RazorpayCheckoutKind.completed =>
        'Razorpay closed after checkout. This does not confirm payment.',
      RazorpayCheckoutKind.externalWallet =>
        '${event.message ?? 'An external wallet was selected.'} This does not confirm payment.',
      RazorpayCheckoutKind.failed =>
        event.message ?? 'Razorpay checkout did not finish.',
    };
    setState(() => _checkoutNote = note);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final booking = _booking;
    final status = _status;
    final attempt = status?.payment;
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: AsyncBody(
        loading: _loading,
        error: _error != null && booking == null ? _error : null,
        empty: false,
        emptyMessage: '',
        onRetry: _load,
        child: booking == null
            ? const SizedBox.shrink()
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(booking.title, style: Theme.of(context).textTheme.titleLarge),
                  Text('Booking status: ${booking.status}'),
                  Text('Server total: ${formatMinor(booking.totalMinor, booking.currency)}'),
                  Text('Meeting area: ${booking.meetingArea}'),
                  const SizedBox(height: 12),
                  const Text(
                    'Starting checkout does not mark this booking paid. Only the payment status returned by the server is shown here.',
                  ),
                  const SizedBox(height: 12),
                  Text(
                    attempt == null
                        ? 'The server has not confirmed payment. No payment attempt is recorded.'
                        : 'Server reports payment status ${attempt.status}.',
                    key: const Key('checkout-status'),
                  ),
                  if (status != null) Text('Settlement: ${status.settlement}'),
                  if (_intent != null) ...[
                    const SizedBox(height: 8),
                    Text('Provider: ${_intent!.provider}'),
                    Text('Attempt status: ${_intent!.status}'),
                    Text('Order reference: ${_intent!.providerOrderRef}'),
                    if (_intent!.provider != 'razorpay')
                      const Text(
                        'Finish payment with the provider using this order reference. Returning to the app does not confirm payment.',
                      ),
                  ],
                  if (_checkoutNote != null) ...[
                    const SizedBox(height: 8),
                    Text(_checkoutNote!),
                  ],
                  const SizedBox(height: 16),
                  PrimaryButton(
                    label: 'Continue to payment',
                    busy: _guard.busy,
                    onPressed: _startCheckout,
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 48,
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: _load,
                      child: const Text('Check payment status'),
                    ),
                  ),
                  ErrorText(_error),
                ],
              ),
      ),
    );
  }
}
