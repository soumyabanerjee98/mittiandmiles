import 'package:flutter/material.dart';
import 'package:mittiandmiles/core/network/api_exception.dart';
import 'package:mittiandmiles/core/session/app_session_scope.dart';
import 'package:mittiandmiles/core/widgets/ui.dart';
import 'package:mittiandmiles/data/models.dart';
import 'package:mittiandmiles/features/account/profile_page.dart';
import 'package:mittiandmiles/features/auth/auth_page.dart';
import 'package:mittiandmiles/features/bookings/booking_list_page.dart';
import 'package:mittiandmiles/features/discovery/experience_page.dart';
import 'package:mittiandmiles/features/requests/trip_request_page.dart';

class DiscoveryPage extends StatefulWidget {
  const DiscoveryPage({super.key});

  @override
  State<DiscoveryPage> createState() => _DiscoveryPageState();
}

class _DiscoveryPageState extends State<DiscoveryPage> {
  final _date = TextEditingController();
  final _minPrice = TextEditingController();
  final _maxPrice = TextEditingController();
  final _minDuration = TextEditingController();
  final _maxDuration = TextEditingController();
  final _partySize = TextEditingController();

  List<City> _cities = const [];
  List<NamedCode> _categories = const [];
  List<NamedCode> _languages = const [];
  List<ExperienceCard> _experiences = const [];
  String? _nextCursor;
  String? _city;
  String? _category;
  String? _language;
  bool _verifiedOnly = false;
  bool _loading = true;
  bool _loadingMore = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _date.text = todayIsoDate();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _load(reset: true);
      }
    });
  }

  @override
  void dispose() {
    _date.dispose();
    _minPrice.dispose();
    _maxPrice.dispose();
    _minDuration.dispose();
    _maxDuration.dispose();
    _partySize.dispose();
    super.dispose();
  }

  DiscoveryQuery _query({String? cursor}) {
    return DiscoveryQuery(
      city: _city,
      date: _date.text.trim().isEmpty ? null : _date.text.trim(),
      category: _category,
      language: _language,
      minPrice: int.tryParse(_minPrice.text.trim()),
      maxPrice: int.tryParse(_maxPrice.text.trim()),
      minDuration: int.tryParse(_minDuration.text.trim()),
      maxDuration: int.tryParse(_maxDuration.text.trim()),
      partySize: int.tryParse(_partySize.text.trim()),
      verifiedHost: _verifiedOnly ? true : null,
      cursor: cursor,
    );
  }

  Future<void> _load({required bool reset}) async {
    final session = AppSessionScope.of(context);
    setState(() {
      _loading = reset;
      _loadingMore = !reset;
      if (reset) {
        _error = null;
      }
    });
    try {
      if (reset) {
        final filters = await Future.wait([
          session.api.listCities(),
          session.api.listCategories(),
          session.api.listLanguages(),
        ]);
        final experiences = await session.api.searchExperiences(_query());
        if (!mounted) {
          return;
        }
        setState(() {
          _cities = (filters[0] as ApiPage<City>).items;
          _categories = (filters[1] as ApiPage<NamedCode>).items;
          _languages = (filters[2] as ApiPage<NamedCode>).items;
          _experiences = experiences.items;
          _nextCursor = experiences.nextCursor;
          _loading = false;
        });
        return;
      }
      final experiences = await session.api.searchExperiences(_query(cursor: _nextCursor));
      if (!mounted) {
        return;
      }
      setState(() {
        _experiences = [..._experiences, ...experiences.items];
        _nextCursor = experiences.nextCursor;
        _loadingMore = false;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      _noteSession(error);
      setState(() {
        _error = error;
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  void _noteSession(Object error) {
    if (error is ApiException && error.sessionExpired) {
      AppSessionScope.of(context).expireLocal();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Discover'),
        actions: [
          IconButton(
            tooltip: 'Custom request',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const TripRequestPage()),
              );
            },
            icon: const Icon(Icons.edit_note),
          ),
          IconButton(
            tooltip: 'Your bookings',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const BookingListPage()),
              );
            },
            icon: const Icon(Icons.event_note_outlined),
          ),
          IconButton(
            tooltip: 'Account',
            onPressed: () async {
              final session = AppSessionScope.of(context);
              final page = session.signedIn ? const ProfilePage() : const AuthPage();
              await Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => page),
              );
              if (mounted) {
                setState(() {});
              }
            },
            icon: const Icon(Icons.person_outline),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? StatusMessage(
                  message: describeError(_error!),
                  actionLabel: 'Try again',
                  onAction: () => _load(reset: true),
                )
              : ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            if (_experiences.isEmpty)
              const Padding(
                padding: EdgeInsets.only(bottom: 16),
                child: Text(
                  'No published experiences match these filters.',
                  textAlign: TextAlign.center,
                ),
              ),
            _Filters(
              cities: _cities,
              categories: _categories,
              languages: _languages,
              city: _city,
              category: _category,
              language: _language,
              verifiedOnly: _verifiedOnly,
              date: _date,
              minPrice: _minPrice,
              maxPrice: _maxPrice,
              minDuration: _minDuration,
              maxDuration: _maxDuration,
              partySize: _partySize,
              onCity: (value) => setState(() => _city = value),
              onCategory: (value) => setState(() => _category = value),
              onLanguage: (value) => setState(() => _language = value),
              onVerified: (value) => setState(() => _verifiedOnly = value),
              onApply: () => _load(reset: true),
            ),
            const SizedBox(height: 12),
            for (final experience in _experiences)
              _ExperienceTile(
                experience: experience,
                onOpen: () {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => ExperiencePage(experienceId: experience.id),
                    ),
                  );
                },
              ),
            if (_nextCursor != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: PrimaryButton(
                  label: _loadingMore ? 'Loading' : 'Load more',
                  busy: _loadingMore,
                  onPressed: () => _load(reset: false),
                ),
              ),
          ],
        ),
    );
  }
}

class _Filters extends StatelessWidget {
  const _Filters({
    required this.cities,
    required this.categories,
    required this.languages,
    required this.city,
    required this.category,
    required this.language,
    required this.verifiedOnly,
    required this.date,
    required this.minPrice,
    required this.maxPrice,
    required this.minDuration,
    required this.maxDuration,
    required this.partySize,
    required this.onCity,
    required this.onCategory,
    required this.onLanguage,
    required this.onVerified,
    required this.onApply,
  });

  final List<City> cities;
  final List<NamedCode> categories;
  final List<NamedCode> languages;
  final String? city;
  final String? category;
  final String? language;
  final bool verifiedOnly;
  final TextEditingController date;
  final TextEditingController minPrice;
  final TextEditingController maxPrice;
  final TextEditingController minDuration;
  final TextEditingController maxDuration;
  final TextEditingController partySize;
  final ValueChanged<String?> onCity;
  final ValueChanged<String?> onCategory;
  final ValueChanged<String?> onLanguage;
  final ValueChanged<bool> onVerified;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        DropdownButtonFormField<String?>(
          key: ValueKey('city-$city'),
          initialValue: city,
          decoration: const InputDecoration(labelText: 'City'),
          items: [
            const DropdownMenuItem(value: null, child: Text('Any city')),
            for (final item in cities)
              DropdownMenuItem(value: item.slug, child: Text(item.name)),
          ],
          onChanged: onCity,
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String?>(
          key: ValueKey('category-$category'),
          initialValue: category,
          decoration: const InputDecoration(labelText: 'Category'),
          items: [
            const DropdownMenuItem(value: null, child: Text('Any category')),
            for (final item in categories)
              DropdownMenuItem(value: item.code, child: Text(item.name)),
          ],
          onChanged: onCategory,
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String?>(
          key: ValueKey('language-$language'),
          initialValue: language,
          decoration: const InputDecoration(labelText: 'Language'),
          items: [
            const DropdownMenuItem(value: null, child: Text('Any language')),
            for (final item in languages)
              DropdownMenuItem(value: item.code, child: Text(item.name)),
          ],
          onChanged: onLanguage,
        ),
        const SizedBox(height: 8),
        LabeledField(label: 'Date (YYYY-MM-DD)', controller: date),
        const SizedBox(height: 8),
        LabeledField(
          label: 'Minimum price, minor units',
          controller: minPrice,
          keyboardType: TextInputType.number,
          helper: 'Paise for INR. Leave blank for no minimum.',
        ),
        const SizedBox(height: 8),
        LabeledField(
          label: 'Maximum price, minor units',
          controller: maxPrice,
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 8),
        LabeledField(
          label: 'Minimum duration, minutes',
          controller: minDuration,
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 8),
        LabeledField(
          label: 'Maximum duration, minutes',
          controller: maxDuration,
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 8),
        LabeledField(
          label: 'Party size',
          controller: partySize,
          keyboardType: TextInputType.number,
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Verified hosts only'),
          value: verifiedOnly,
          onChanged: onVerified,
        ),
        PrimaryButton(label: 'Apply filters', onPressed: onApply),
      ],
    );
  }
}

class _ExperienceTile extends StatelessWidget {
  const _ExperienceTile({required this.experience, required this.onOpen});

  final ExperienceCard experience;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final price = formatMinor(experience.basePriceMinor, experience.currency);
    return Semantics(
      button: true,
      label: '${experience.title}, ${experience.cityName}, $price',
      child: Card(
        child: ListTile(
          title: Text(experience.title),
          subtitle: Text(
            '${experience.cityName} · ${experience.hostName} · ${experience.durationMinutes} min\n$price · ${experience.hostVerificationStatus}',
          ),
          isThreeLine: true,
          onTap: onOpen,
        ),
      ),
    );
  }
}
