import 'package:flutter/material.dart';
import 'package:mittiandmiles/core/network/api_exception.dart';
import 'package:mittiandmiles/core/session/app_session_scope.dart';
import 'package:mittiandmiles/core/submit_guard.dart';
import 'package:mittiandmiles/core/widgets/ui.dart';
import 'package:mittiandmiles/data/models.dart';
import 'package:mittiandmiles/features/bookings/checkout_page.dart';
import 'package:mittiandmiles/features/support/unavailable_journey_page.dart';

class BookingDetailPage extends StatefulWidget {
  const BookingDetailPage({
    super.key,
    required this.bookingId,
    this.hostView = false,
  });

  final String bookingId;
  final bool hostView;

  @override
  State<BookingDetailPage> createState() => _BookingDetailPageState();
}

class _BookingDetailPageState extends State<BookingDetailPage> {
  final _reason = TextEditingController();
  final _refundCode = TextEditingController();
  final _refundAmount = TextEditingController();
  final _guard = SubmitGuard();
  String _checkInMethod = 'HOST_CODE';

  Booking? _booking;
  bool _loading = true;
  Object? _error;
  String? _notice;

  @override
  void dispose() {
    _reason.dispose();
    _refundCode.dispose();
    _refundAmount.dispose();
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
    try {
      final booking = await AppSessionScope.of(context).api.booking(widget.bookingId);
      if (!mounted) {
        return;
      }
      setState(() {
        _booking = booking;
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

  Future<void> _run(Future<Booking> Function() action, String done) async {
    if (_guard.busy) {
      return;
    }
    _guard.begin();
    setState(() => _error = null);
    try {
      final booking = await action();
      _guard.reset();
      if (!mounted) {
        return;
      }
      setState(() {
        _booking = booking;
        _notice = done;
      });
    } on ApiException catch (error) {
      _guard.finish();
      if (error.sessionExpired) {
        AppSessionScope.of(context).expireLocal();
      }
      if (mounted) {
        setState(() => _error = error);
      }
    } catch (error) {
      _guard.finish();
      if (mounted) {
        setState(() => _error = error);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final booking = _booking;
    final api = AppSessionScope.of(context).api;
    return Scaffold(
      appBar: AppBar(title: const Text('Booking')),
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
                  Text('Status: ${booking.status}'),
                  Text('When: ${booking.startsAt} to ${booking.endsAt}'),
                  Text('People: ${booking.participantCount}'),
                  Text('Total: ${formatMinor(booking.totalMinor, booking.currency)}'),
                  Text('Meeting area: ${booking.meetingArea}'),
                  Text('Cancellation terms: ${booking.cancellationPolicy}'),
                  if (booking.hold != null)
                    Text('Hold: ${booking.hold!.state} until ${booking.hold!.expiresAt}'),
                  if (_notice != null) Text(_notice!),
                  const SizedBox(height: 12),
                  if (!widget.hostView) ...[
                    PrimaryButton(
                      label: 'Payment status',
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => CheckoutPage(bookingId: booking.id),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 12),
                    LabeledField(
                      label: 'Cancellation reason',
                      controller: _reason,
                      helper: 'Optional. At least 3 characters if you include one.',
                    ),
                    const SizedBox(height: 8),
                    PrimaryButton(
                      label: 'Cancel booking',
                      busy: _guard.busy,
                      onPressed: () => _run(
                        () => api.cancelBooking(
                          booking.id,
                          reason: _reason.text.trim().isEmpty ? null : _reason.text.trim(),
                        ),
                        'The server updated the booking.',
                      ),
                    ),
                    const SizedBox(height: 16),
                    LabeledField(
                      label: 'Refund reason code',
                      controller: _refundCode,
                      helper: 'Lowercase words, for example guest_request. The server decides the refund.',
                    ),
                    const SizedBox(height: 8),
                    LabeledField(
                      label: 'Requested amount, minor units',
                      controller: _refundAmount,
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 8),
                    PrimaryButton(
                      label: 'Request refund',
                      busy: _guard.busy,
                      onPressed: () async {
                        final key = _guard.begin();
                        if (key == null) {
                          return;
                        }
                        setState(() => _error = null);
                        try {
                          final refund = await api.requestRefund(
                            booking.id,
                            reasonCode: _refundCode.text.trim(),
                            amountMinor: int.tryParse(_refundAmount.text.trim()),
                            idempotencyKey: key,
                          );
                          _guard.reset();
                          if (mounted) {
                            setState(() {
                              _notice =
                                  'Refund request ${refund.id} is ${refund.status}. This is not a completed refund.';
                            });
                          }
                        } on ApiException catch (error) {
                          _guard.finish();
                          if (!context.mounted) {
                            return;
                          }
                          if (error.sessionExpired) {
                            AppSessionScope.of(context).expireLocal();
                          }
                          setState(() => _error = error);
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    PrimaryButton(
                      label: 'Open a dispute',
                      busy: _guard.busy,
                      onPressed: () => _run(
                        () => api.disputeBooking(booking.id, reason: _reason.text.trim()),
                        'The server recorded the dispute.',
                      ),
                    ),
                  ],
                  if (widget.hostView) ...[
                    DropdownButtonFormField<String>(
                      key: ValueKey(_checkInMethod),
                      initialValue: _checkInMethod,
                      decoration: const InputDecoration(labelText: 'Check-in method'),
                      items: const [
                        DropdownMenuItem(value: 'HOST_CODE', child: Text('Host code')),
                        DropdownMenuItem(value: 'PARTICIPANT_CODE', child: Text('Participant code')),
                        DropdownMenuItem(value: 'MANUAL', child: Text('Manual')),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          setState(() => _checkInMethod = value);
                        }
                      },
                    ),
                    const SizedBox(height: 8),
                    PrimaryButton(
                      label: 'Check in',
                      busy: _guard.busy,
                      onPressed: () => _run(
                        () => api.checkIn(booking.id, method: _checkInMethod),
                        'The server recorded check-in.',
                      ),
                    ),
                    const SizedBox(height: 8),
                    PrimaryButton(
                      label: 'Mark complete',
                      busy: _guard.busy,
                      onPressed: () => _run(
                        () => api.completeBooking(booking.id),
                        'The server updated completion.',
                      ),
                    ),
                    const SizedBox(height: 8),
                    LabeledField(label: 'No-show reason', controller: _reason),
                    const SizedBox(height: 8),
                    PrimaryButton(
                      label: 'Mark no-show',
                      busy: _guard.busy,
                      onPressed: () => _run(
                        () => api.markNoShow(
                          booking.id,
                          reason: _reason.text.trim().isEmpty ? null : _reason.text.trim(),
                        ),
                        'The server recorded the no-show.',
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const UnavailableJourneyPage(),
                        ),
                      );
                    },
                    child: const Text('Reviews and support'),
                  ),
                  ErrorText(_error),
                ],
              ),
      ),
    );
  }
}
