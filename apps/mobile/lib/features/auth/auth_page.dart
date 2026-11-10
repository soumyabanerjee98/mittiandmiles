import 'package:flutter/material.dart';
import 'package:mittiandmiles/core/network/api_exception.dart';
import 'package:mittiandmiles/core/session/app_session_scope.dart';
import 'package:mittiandmiles/core/widgets/ui.dart';

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _locale = TextEditingController(text: 'en');
  bool _register = false;
  bool _busy = false;
  Object? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _locale.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final session = AppSessionScope.of(context);
    try {
      if (_register) {
        await session.register(
          email: _email.text.trim(),
          password: _password.text,
          locale: _locale.text.trim().isEmpty ? 'en' : _locale.text.trim(),
        );
      } else {
        await session.signIn(email: _email.text.trim(), password: _password.text);
      }
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _error = error);
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
    return Scaffold(
      appBar: AppBar(title: Text(_register ? 'Create account' : 'Sign in')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Passwords for a new account need at least 12 characters. The server decides your roles.',
          ),
          const SizedBox(height: 12),
          LabeledField(
            label: 'Email',
            controller: _email,
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 8),
          LabeledField(label: 'Password', controller: _password, obscure: true),
          if (_register) ...[
            const SizedBox(height: 8),
            LabeledField(label: 'Locale', controller: _locale, helper: 'For example en or en-IN.'),
          ],
          const SizedBox(height: 16),
          PrimaryButton(
            label: _register ? 'Create account' : 'Sign in',
            busy: _busy,
            onPressed: _submit,
          ),
          TextButton(
            onPressed: _busy ? null : () => setState(() => _register = !_register),
            child: Text(_register ? 'I already have an account' : 'Create an account'),
          ),
          ErrorText(_error),
        ],
      ),
    );
  }
}
