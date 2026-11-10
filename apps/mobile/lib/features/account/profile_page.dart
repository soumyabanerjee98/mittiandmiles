import 'package:flutter/material.dart';
import 'package:mittiandmiles/core/session/app_session_scope.dart';
import 'package:mittiandmiles/core/widgets/ui.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final _locale = TextEditingController();
  bool _busy = false;
  Object? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final account = AppSessionScope.of(context).account;
    if (_locale.text.isEmpty && account != null) {
      _locale.text = account.locale;
    }
  }

  @override
  void dispose() {
    _locale.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppSessionScope.of(context).updateLocale(_locale.text.trim());
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
    final session = AppSessionScope.of(context);
    final account = session.account;
    if (account == null) {
      return const Scaffold(body: Center(child: Text('Sign in to see your profile.')));
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(account.email, style: Theme.of(context).textTheme.titleLarge),
          Text('Status: ${account.accountStatus}'),
          Text('Roles: ${account.roles.isEmpty ? 'None' : account.roles.join(', ')}'),
          const SizedBox(height: 8),
          const Text('Locale is the only profile field this API accepts.'),
          const SizedBox(height: 8),
          LabeledField(label: 'Locale', controller: _locale),
          const SizedBox(height: 12),
          PrimaryButton(label: 'Save locale', busy: _busy, onPressed: _save),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () async {
              await session.signOut();
              if (context.mounted) {
                Navigator.of(context).pop();
              }
            },
            child: const Text('Sign out'),
          ),
          ErrorText(_error),
        ],
      ),
    );
  }
}
