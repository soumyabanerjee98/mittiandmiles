import 'package:flutter/material.dart';
import 'package:mittiandmiles/core/network/api_exception.dart';
import 'package:mittiandmiles/core/session/app_session_scope.dart';
import 'package:mittiandmiles/core/submit_guard.dart';
import 'package:mittiandmiles/core/widgets/ui.dart';
import 'package:mittiandmiles/data/models.dart';
import 'package:mittiandmiles/data/payloads.dart';
import 'package:mittiandmiles/features/auth/auth_page.dart';
import 'package:mittiandmiles/features/bookings/checkout_page.dart';

class ExperiencePage extends StatefulWidget {
  const ExperiencePage({super.key, required this.experienceId});

  final String experienceId;

  @override
  State<ExperiencePage> createState() => _ExperiencePageState();
}

class _ExperiencePageState extends State<ExperiencePage> {
  final _from = TextEditingController();
  final _to = TextEditingController();
  final _party = TextEditingController(text: '1');
  final _currency = TextEditingController(text: 'INR');
  final _guard = SubmitGuard();

  ExperienceDetail? _experience;
  PublicHost? _host;
  List<Slot> _slots = const [];
  String? _slotId;
  bool _loading = true;
  Object? _error;
  Object? _actionError;

  @override
  void initState() {
    super.initState();
    final start = todayIsoDate();
    _from.text = start;
    _to.text = addDaysIso(start, 14);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _load();
      }
    });
  }

  @override
  void dispose() {
    _from.dispose();
    _to.dispose();
    _party.dispose();
    _currency.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = AppSessionScope.of(context).api;
    try {
      final experience = await api.experience(widget.experienceId);
      final host = await api.host(experience.hostId);
      if (!mounted) {
        return;
      }
      setState(() {
        _experience = experience;
        _host = host;
        _currency.text = experience.currency;
        _loading = false;
      });
      await _loadSlots();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  Future<void> _loadSlots() async {
    if (!isDay(_from.text.trim()) || !isDay(_to.text.trim())) {
      setState(() => _actionError = 'Use calendar dates as YYYY-MM-DD.');
      return;
    }
    setState(() => _actionError = null);
    try {
      final availability = await AppSessionScope.of(context).api.availability(
            widget.experienceId,
            from: _from.text.trim(),
            to: _to.text.trim(),
            partySize: int.tryParse(_party.text.trim()),
          );
      if (!mounted) {
        return;
      }
      setState(() {
        _slots = availability.slots;
        _slotId = null;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _actionError = error);
    }
  }

  Future<void> _book() async {
    final session = AppSessionScope.of(context);
    if (!session.signedIn) {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => const AuthPage()),
      );
      return;
    }
    final slotId = _slotId;
    final participants = int.tryParse(_party.text.trim());
    if (slotId == null || participants == null || !isCurrency(_currency.text.trim())) {
      setState(() {
        _actionError = 'Choose a slot, party size, and a 3-letter currency code.';
      });
      return;
    }
    final key = _guard.begin();
    if (key == null) {
      return;
    }
    setState(() => _actionError = null);
    try {
      final booking = await session.api.createBooking(
        experienceId: widget.experienceId,
        slotId: slotId,
        participantCount: participants,
        currency: _currency.text.trim(),
        idempotencyKey: key,
      );
      _guard.reset();
      if (!mounted) {
        return;
      }
      await Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => CheckoutPage(bookingId: booking.id)),
      );
    } on ApiException catch (error) {
      _guard.finish();
      if (error.sessionExpired) {
        session.expireLocal();
      }
      if (mounted) {
        setState(() => _actionError = error);
      }
    } catch (error) {
      _guard.finish();
      if (mounted) {
        setState(() => _actionError = error);
      }
    } finally {
      if (mounted) {
        setState(() {});
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final experience = _experience;
    return Scaffold(
      appBar: AppBar(title: Text(experience?.title ?? 'Experience')),
      body: AsyncBody(
        loading: _loading,
        error: _error,
        empty: false,
        emptyMessage: '',
        onRetry: _load,
        child: experience == null
            ? const SizedBox.shrink()
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(experience.title, style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 8),
                  Text(
                    '${experience.cityName}, ${experience.cityState} · ${experience.durationMinutes} minutes',
                  ),
                  Text(
                    'From ${formatMinor(experience.basePriceMinor, experience.currency)}. The server calculates the booking total.',
                  ),
                  const SizedBox(height: 12),
                  Text('Host ${_host?.publicName ?? experience.hostName}'),
                  Text('Verification: ${experience.hostVerificationStatus}'),
                  if ((_host?.bio ?? '').isNotEmpty) Text(_host!.bio!),
                  const SizedBox(height: 12),
                  Text(experience.description),
                  const SizedBox(height: 12),
                  Text('Included\n${experience.inclusions}'),
                  const SizedBox(height: 8),
                  Text('Not included\n${experience.exclusions}'),
                  const SizedBox(height: 8),
                  Text('Meeting area\n${experience.meetingArea}'),
                  const SizedBox(height: 8),
                  Text('Cancellation\n${experience.cancellationPolicy}'),
                  if ((experience.safetyNotes ?? '').isNotEmpty)
                    Text('Safety\n${experience.safetyNotes}'),
                  const SizedBox(height: 16),
                  const Text('Availability'),
                  const SizedBox(height: 8),
                  LabeledField(label: 'From', controller: _from),
                  const SizedBox(height: 8),
                  LabeledField(label: 'To', controller: _to),
                  const SizedBox(height: 8),
                  LabeledField(
                    label: 'Party size',
                    controller: _party,
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 8),
                  LabeledField(label: 'Currency', controller: _currency),
                  const SizedBox(height: 8),
                  OutlinedButton(onPressed: _loadSlots, child: const Text('Show open slots')),
                  if (_slots.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 12),
                      child: Text('No open slots in these dates.'),
                    ),
                  RadioGroup<String>(
                    groupValue: _slotId,
                    onChanged: (value) => setState(() => _slotId = value),
                    child: Column(
                      children: [
                        for (final slot in _slots)
                          RadioListTile<String>(
                            key: ValueKey('slot-${slot.id}'),
                            value: slot.id,
                            title: Text('${slot.startsAt} to ${slot.endsAt}'),
                            subtitle: Text('${slot.remaining} places left · ${slot.status}'),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  PrimaryButton(
                    key: const Key('request-booking'),
                    label: 'Request booking',
                    busy: _guard.busy,
                    onPressed: _book,
                  ),
                  ErrorText(_actionError),
                ],
              ),
      ),
    );
  }
}
