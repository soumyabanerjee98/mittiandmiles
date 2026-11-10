import 'package:flutter/material.dart';
import 'package:mittiandmiles/core/network/api_exception.dart';
import 'package:mittiandmiles/core/session/app_session_scope.dart';
import 'package:mittiandmiles/core/widgets/ui.dart';
import 'package:mittiandmiles/data/models.dart';
import 'package:mittiandmiles/features/auth/auth_page.dart';
import 'package:mittiandmiles/features/bookings/booking_detail_page.dart';

class BookingListPage extends StatefulWidget {
  const BookingListPage({super.key, this.hostView = false});

  final bool hostView;

  @override
  State<BookingListPage> createState() => _BookingListPageState();
}

class _BookingListPageState extends State<BookingListPage> {
  List<Booking> _items = const [];
  bool _loading = true;
  Object? _error;

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
    final session = AppSessionScope.of(context);
    if (!session.signedIn) {
      setState(() {
        _loading = false;
        _error = null;
        _items = const [];
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = widget.hostView
          ? await session.api.hostBookings()
          : await session.api.myBookings();
      if (!mounted) {
        return;
      }
      setState(() {
        _items = page.items;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (error.sessionExpired) {
        session.expireLocal();
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

  @override
  Widget build(BuildContext context) {
    final signedIn = AppSessionScope.of(context).signedIn;
    return Scaffold(
      appBar: AppBar(title: Text(widget.hostView ? 'Host bookings' : 'Your bookings')),
      body: !signedIn
          ? StatusMessage(
              message: 'Sign in to see bookings.',
              actionLabel: 'Sign in',
              onAction: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => const AuthPage()),
                );
                if (mounted) {
                  await _load();
                }
              },
            )
          : AsyncBody(
              loading: _loading,
              error: _error,
              empty: _items.isEmpty,
              emptyMessage: 'No bookings yet.',
              onRetry: _load,
              child: ListView(
                children: [
                  for (final booking in _items)
                    ListTile(
                      title: Text(booking.title),
                      subtitle: Text(
                        '${booking.status} · ${formatMinor(booking.totalMinor, booking.currency)}',
                      ),
                      onTap: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => BookingDetailPage(
                              bookingId: booking.id,
                              hostView: widget.hostView,
                            ),
                          ),
                        );
                        if (mounted) {
                          await _load();
                        }
                      },
                    ),
                ],
              ),
            ),
    );
  }
}
