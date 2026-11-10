import 'package:flutter/material.dart';
import 'package:mittiandmiles/core/session/app_session_scope.dart';
import 'package:mittiandmiles/core/widgets/ui.dart';
import 'package:mittiandmiles/data/models.dart';
import 'package:mittiandmiles/data/payloads.dart';

class HostExperienceListPage extends StatefulWidget {
  const HostExperienceListPage({super.key});

  @override
  State<HostExperienceListPage> createState() => _HostExperienceListPageState();
}

class _HostExperienceListPageState extends State<HostExperienceListPage> {
  List<OwnExperience> _items = const [];
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
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await AppSessionScope.of(context).api.ownExperiences();
      if (!mounted) {
        return;
      }
      setState(() {
        _items = page.items;
        _loading = false;
      });
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Experiences'),
        actions: [
          IconButton(
            tooltip: 'New experience',
            onPressed: () async {
              await Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const HostExperienceEditor()),
              );
              if (mounted) {
                await _load();
              }
            },
            icon: const Icon(Icons.add),
          ),
        ],
      ),
      body: AsyncBody(
        loading: _loading,
        error: _error,
        empty: _items.isEmpty,
        emptyMessage: 'You have no experiences yet.',
        onRetry: _load,
        child: ListView(
          children: [
            for (final experience in _items)
              ListTile(
                title: Text(experience.title),
                subtitle: Text('${experience.listingStatus} · ${experience.cityName}'),
                onTap: () async {
                  await Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => HostExperienceEditor(experienceId: experience.id),
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

class HostExperienceEditor extends StatefulWidget {
  const HostExperienceEditor({super.key, this.experienceId});

  final String? experienceId;

  @override
  State<HostExperienceEditor> createState() => _HostExperienceEditorState();
}

class _HostExperienceEditorState extends State<HostExperienceEditor> {
  final _cityId = TextEditingController();
  final _category = TextEditingController();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _duration = TextEditingController(text: '120');
  final _price = TextEditingController();
  final _currency = TextEditingController(text: 'INR');
  final _capacity = TextEditingController(text: '6');
  final _inclusions = TextEditingController();
  final _exclusions = TextEditingController();
  final _meeting = TextEditingController();
  final _access = TextEditingController();
  final _safety = TextEditingController();
  final _policy = TextEditingController();
  final _languages = TextEditingController(text: 'en');
  final _slotStart = TextEditingController();
  final _slotEnd = TextEditingController();
  final _slotCapacity = TextEditingController(text: '6');
  final _blackoutStart = TextEditingController();
  final _blackoutEnd = TextEditingController();

  OwnExperience? _existing;
  bool _loading = false;
  bool _busy = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    if (widget.experienceId != null) {
      _loading = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _load();
        }
      });
    }
  }

  @override
  void dispose() {
    for (final controller in [
      _cityId,
      _category,
      _title,
      _description,
      _duration,
      _price,
      _currency,
      _capacity,
      _inclusions,
      _exclusions,
      _meeting,
      _access,
      _safety,
      _policy,
      _languages,
      _slotStart,
      _slotEnd,
      _slotCapacity,
      _blackoutStart,
      _blackoutEnd,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _fill(OwnExperience experience) {
    _cityId.text = experience.cityId;
    _category.text = experience.category;
    _title.text = experience.title;
    _description.text = experience.description;
    _duration.text = experience.durationMinutes.toString();
    _price.text = experience.basePriceMinor.toString();
    _currency.text = experience.currency;
    _capacity.text = experience.capacity.toString();
    _inclusions.text = experience.inclusions;
    _exclusions.text = experience.exclusions;
    _meeting.text = experience.meetingArea;
    _access.text = experience.accessibilityNotes ?? '';
    _safety.text = experience.safetyNotes ?? '';
    _policy.text = experience.cancellationPolicy;
    _languages.text = experience.languageCodes.join(',');
  }

  Future<void> _load() async {
    try {
      final experience = await AppSessionScope.of(context).api.ownExperience(widget.experienceId!);
      if (!mounted) {
        return;
      }
      setState(() {
        _existing = experience;
        _fill(experience);
        _loading = false;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error;
          _loading = false;
        });
      }
    }
  }

  ExperienceDraft? _draft() {
    final duration = int.tryParse(_duration.text.trim());
    final price = int.tryParse(_price.text.trim());
    final capacity = int.tryParse(_capacity.text.trim());
    final languages = _languages.text
        .split(',')
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();
    if (duration == null || price == null || capacity == null || languages.isEmpty) {
      return null;
    }
    return ExperienceDraft(
      cityId: _cityId.text.trim(),
      category: _category.text.trim(),
      title: _title.text.trim(),
      description: _description.text.trim(),
      durationMinutes: duration,
      basePriceMinor: price,
      currency: _currency.text.trim(),
      capacity: capacity,
      inclusions: _inclusions.text,
      exclusions: _exclusions.text,
      meetingArea: _meeting.text.trim(),
      cancellationPolicy: _policy.text.trim(),
      languageCodes: languages,
      accessibilityNotes: _access.text.trim().isEmpty ? null : _access.text.trim(),
      safetyNotes: _safety.text.trim().isEmpty ? null : _safety.text.trim(),
    );
  }

  Future<void> _save() async {
    final draft = _draft();
    if (draft == null) {
      setState(() => _error = 'Check price, duration, capacity, and languages.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final api = AppSessionScope.of(context).api;
    try {
      final saved = _existing == null
          ? await api.createExperience(draft)
          : await api.updateExperience(_existing!.id, draft);
      if (mounted) {
        setState(() => _existing = saved);
      }
    } catch (error) {
      if (mounted) {
        setState(() => _error = error);
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _submit() async {
    final existing = _existing;
    if (existing == null) {
      setState(() => _error = 'Save the experience before submitting it.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final saved = await AppSessionScope.of(context).api.submitExperience(existing.id);
      if (mounted) {
        setState(() => _existing = saved);
      }
    } catch (error) {
      if (mounted) {
        setState(() => _error = error);
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _saveSchedule() async {
    final existing = _existing;
    final capacity = int.tryParse(_slotCapacity.text.trim());
    if (existing == null || capacity == null || !isInstant(_slotStart.text.trim()) || !isInstant(_slotEnd.text.trim())) {
      setState(() {
        _error = 'Save the experience first, then enter slot times as UTC instants.';
      });
      return;
    }
    final slots = [
      ...existing.slots.map(
        (slot) => SlotDraft(startsAt: slot.startsAt, endsAt: slot.endsAt, capacity: slot.capacity),
      ),
      SlotDraft(startsAt: _slotStart.text.trim(), endsAt: _slotEnd.text.trim(), capacity: capacity),
    ];
    final blackouts = <BlackoutDraft>[
      ...existing.blackouts.map(
        (row) => BlackoutDraft(startsAt: row.startsAt, endsAt: row.endsAt),
      ),
    ];
    if (_blackoutStart.text.trim().isNotEmpty || _blackoutEnd.text.trim().isNotEmpty) {
      if (!isInstant(_blackoutStart.text.trim()) || !isInstant(_blackoutEnd.text.trim())) {
        setState(() => _error = 'Blackout times must be UTC instants.');
        return;
      }
      blackouts.add(
        BlackoutDraft(startsAt: _blackoutStart.text.trim(), endsAt: _blackoutEnd.text.trim()),
      );
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final saved = await AppSessionScope.of(context).api.saveAvailability(
            existing.id,
            slots: slots,
            blackouts: blackouts,
          );
      if (mounted) {
        setState(() => _existing = saved);
      }
    } catch (error) {
      if (mounted) {
        setState(() => _error = error);
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final existing = _existing;
    return Scaffold(
      appBar: AppBar(title: Text(existing == null ? 'New experience' : 'Edit experience')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (existing != null) Text('Listing status: ${existing.listingStatus}'),
          if ((existing?.moderationNote ?? '').isNotEmpty)
            Text('Moderation note: ${existing!.moderationNote}'),
          const Text('Price is minor units. Listing status is decided by the server.'),
          const SizedBox(height: 8),
          LabeledField(label: 'City id', controller: _cityId),
          const SizedBox(height: 8),
          LabeledField(label: 'Category slug', controller: _category),
          const SizedBox(height: 8),
          LabeledField(label: 'Title', controller: _title),
          const SizedBox(height: 8),
          LabeledField(label: 'Description', controller: _description, maxLines: 4),
          const SizedBox(height: 8),
          LabeledField(label: 'Duration, minutes', controller: _duration, keyboardType: TextInputType.number),
          const SizedBox(height: 8),
          LabeledField(label: 'Base price, minor units', controller: _price, keyboardType: TextInputType.number),
          const SizedBox(height: 8),
          LabeledField(label: 'Currency', controller: _currency),
          const SizedBox(height: 8),
          LabeledField(label: 'Capacity', controller: _capacity, keyboardType: TextInputType.number),
          const SizedBox(height: 8),
          LabeledField(label: 'Inclusions', controller: _inclusions, maxLines: 3),
          const SizedBox(height: 8),
          LabeledField(label: 'Exclusions', controller: _exclusions, maxLines: 3),
          const SizedBox(height: 8),
          LabeledField(label: 'Meeting area', controller: _meeting),
          const SizedBox(height: 8),
          LabeledField(label: 'Accessibility notes', controller: _access, maxLines: 2),
          const SizedBox(height: 8),
          LabeledField(label: 'Safety notes', controller: _safety, maxLines: 2),
          const SizedBox(height: 8),
          LabeledField(label: 'Cancellation policy', controller: _policy, maxLines: 3),
          const SizedBox(height: 8),
          LabeledField(label: 'Language codes', controller: _languages, helper: 'Comma-separated, for example en,hi.'),
          const SizedBox(height: 12),
          PrimaryButton(label: 'Save experience', busy: _busy, onPressed: _save),
          const SizedBox(height: 8),
          PrimaryButton(label: 'Submit for review', busy: _busy, onPressed: _submit),
          const SizedBox(height: 16),
          const Text('Saving availability replaces the schedule with the current slots plus the new one.'),
          if (existing != null)
            for (final slot in existing.slots)
              Text('${slot.startsAt} · ${slot.remaining} left · ${slot.status}'),
          const SizedBox(height: 8),
          LabeledField(
            label: 'Slot start',
            controller: _slotStart,
            helper: 'Example 2026-12-01T04:30:00.000Z',
          ),
          const SizedBox(height: 8),
          LabeledField(label: 'Slot end', controller: _slotEnd),
          const SizedBox(height: 8),
          LabeledField(label: 'Slot capacity', controller: _slotCapacity, keyboardType: TextInputType.number),
          const SizedBox(height: 8),
          LabeledField(label: 'Blackout start', controller: _blackoutStart),
          const SizedBox(height: 8),
          LabeledField(label: 'Blackout end', controller: _blackoutEnd),
          const SizedBox(height: 8),
          PrimaryButton(label: 'Save availability', busy: _busy, onPressed: _saveSchedule),
          ErrorText(_error),
        ],
      ),
    );
  }
}
