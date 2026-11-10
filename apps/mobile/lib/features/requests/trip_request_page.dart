import 'package:flutter/material.dart';
import 'package:mittiandmiles/core/session/app_session_scope.dart';
import 'package:mittiandmiles/core/submit_guard.dart';
import 'package:mittiandmiles/core/widgets/ui.dart';
import 'package:mittiandmiles/data/models.dart';
import 'package:mittiandmiles/data/payloads.dart';
import 'package:mittiandmiles/features/auth/auth_page.dart';
import 'package:mittiandmiles/features/bookings/checkout_page.dart';

class TripRequestPage extends StatefulWidget {
  const TripRequestPage({super.key});

  @override
  State<TripRequestPage> createState() => _TripRequestPageState();
}

class _TripRequestPageState extends State<TripRequestPage> {
  final _cityId = TextEditingController();
  final _starts = TextEditingController();
  final _ends = TextEditingController();
  final _party = TextEditingController(text: '2');
  final _currency = TextEditingController(text: 'INR');
  final _budget = TextEditingController();
  final _notes = TextEditingController();
  final _openId = TextEditingController();
  final _guard = SubmitGuard();

  TripRequest? _request;
  List<Offer> _offers = const [];
  Object? _error;
  bool _loadingOffers = false;

  @override
  void initState() {
    super.initState();
    final start = todayIsoDate();
    _starts.text = start;
    _ends.text = addDaysIso(start, 2);
  }

  @override
  void dispose() {
    _cityId.dispose();
    _starts.dispose();
    _ends.dispose();
    _party.dispose();
    _currency.dispose();
    _budget.dispose();
    _notes.dispose();
    _openId.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final session = AppSessionScope.of(context);
    if (!session.signedIn) {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => const AuthPage()),
      );
      return;
    }
    final party = int.tryParse(_party.text.trim());
    if (party == null || !isDay(_starts.text.trim()) || !isDay(_ends.text.trim())) {
      setState(() => _error = 'Check the city id, dates, and party size.');
      return;
    }
    final key = _guard.begin();
    if (key == null) {
      return;
    }
    setState(() => _error = null);
    try {
      final created = await session.api.createTripRequest(
        TripRequestDraft(
          cityId: _cityId.text.trim(),
          startsOn: _starts.text.trim(),
          endsOn: _ends.text.trim(),
          partySize: party,
          currency: _currency.text.trim(),
          budgetMinor: int.tryParse(_budget.text.trim()),
          notes: _notes.text.trim(),
        ),
        idempotencyKey: key,
      );
      _guard.reset();
      session.rememberTripRequest(created.id);
      if (mounted) {
        setState(() => _request = created);
        await _open(created.id);
      }
    } catch (error) {
      _guard.finish();
      if (mounted) {
        setState(() => _error = error);
      }
    }
  }

  Future<void> _open(String id) async {
    setState(() {
      _loadingOffers = true;
      _error = null;
    });
    final api = AppSessionScope.of(context).api;
    try {
      final request = await api.tripRequest(id);
      final offers = await api.offers(id);
      if (!mounted) {
        return;
      }
      setState(() {
        _request = request;
        _offers = offers;
        _loadingOffers = false;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error;
          _loadingOffers = false;
        });
      }
    }
  }

  Future<void> _accept(Offer offer) async {
    if (_guard.busy) {
      return;
    }
    _guard.begin();
    setState(() => _error = null);
    try {
      final booking = await AppSessionScope.of(context).api.acceptOffer(offer.id);
      _guard.reset();
      if (!mounted) {
        return;
      }
      await Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => CheckoutPage(bookingId: booking.id)),
      );
    } catch (error) {
      _guard.finish();
      if (mounted) {
        setState(() => _error = error);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = AppSessionScope.of(context);
    final request = _request;
    return Scaffold(
      appBar: AppBar(title: const Text('Custom request')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'The API has no list of your requests. Keep the id below, or open a request by id.',
          ),
          const SizedBox(height: 12),
          LabeledField(label: 'City id', controller: _cityId),
          const SizedBox(height: 8),
          LabeledField(label: 'Starts on', controller: _starts),
          const SizedBox(height: 8),
          LabeledField(label: 'Ends on', controller: _ends),
          const SizedBox(height: 8),
          LabeledField(label: 'Party size', controller: _party, keyboardType: TextInputType.number),
          const SizedBox(height: 8),
          LabeledField(label: 'Currency', controller: _currency),
          const SizedBox(height: 8),
          LabeledField(
            label: 'Budget, minor units',
            controller: _budget,
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 8),
          LabeledField(label: 'Notes', controller: _notes, maxLines: 3),
          const SizedBox(height: 12),
          PrimaryButton(label: 'Send request', busy: _guard.busy, onPressed: _create),
          const SizedBox(height: 16),
          LabeledField(label: 'Open request id', controller: _openId),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => _open(_openId.text.trim()),
            child: const Text('Open request'),
          ),
          for (final id in session.recentTripRequestIds)
            ListTile(
              title: Text(id),
              onTap: () => _open(id),
            ),
          if (_loadingOffers) const LinearProgressIndicator(),
          if (request != null) ...[
            const SizedBox(height: 12),
            Text('Request ${request.id}'),
            Text('Status: ${request.status}'),
            Text('${request.startsOn} to ${request.endsOn} · ${request.partySize} people'),
            if (_offers.isEmpty) const Text('No offers yet.'),
            for (final offer in _offers)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${formatMinor(offer.priceMinor, offer.currency)} · ${offer.status}'),
                      Text('${offer.proposedStartsAt} to ${offer.proposedEndsAt}'),
                      Text('Included: ${offer.inclusions}'),
                      Text('Not included: ${offer.exclusions}'),
                      Text('Cancellation: ${offer.cancellationPolicy}'),
                      Text('Expires: ${offer.expiresAt}'),
                      const SizedBox(height: 8),
                      PrimaryButton(
                        label: 'Accept offer',
                        busy: _guard.busy,
                        onPressed: offer.status == 'OPEN' ? () => _accept(offer) : null,
                      ),
                    ],
                  ),
                ),
              ),
          ],
          ErrorText(_error),
        ],
      ),
    );
  }
}
