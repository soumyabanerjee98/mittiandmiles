import 'package:flutter/material.dart';
import 'package:mittiandmiles/core/network/api_exception.dart';
import 'package:mittiandmiles/core/session/app_session_scope.dart';
import 'package:mittiandmiles/core/widgets/ui.dart';
import 'package:mittiandmiles/data/models.dart';
import 'package:mittiandmiles/features/auth/auth_page.dart';
import 'package:mittiandmiles/features/bookings/booking_list_page.dart';
import 'package:mittiandmiles/features/host/host_experience_page.dart';
import 'package:mittiandmiles/features/host/host_finance_page.dart';
import 'package:mittiandmiles/features/host/host_offer_page.dart';

class HostDashboard extends StatefulWidget {
  const HostDashboard({super.key});

  @override
  State<HostDashboard> createState() => _HostDashboardState();
}

class _HostDashboardState extends State<HostDashboard> {
  HostVerification? _verification;
  bool _needsProfile = false;
  bool _loading = false;
  bool _requested = false;
  Object? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final host = AppSessionScope.of(context).account?.isHost == true;
    if (!host) {
      _requested = false;
      _verification = null;
      _needsProfile = false;
      return;
    }
    if (_requested || _loading) {
      return;
    }
    _requested = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && AppSessionScope.of(context).account?.isHost == true) {
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
      final verification = await AppSessionScope.of(context).api.verification();
      if (!mounted) {
        return;
      }
      setState(() {
        _verification = verification;
        _needsProfile = false;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _needsProfile = error.code == 'HOST_PROFILE_REQUIRED';
        _verification = null;
        _error = _needsProfile ? null : error;
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
    final session = AppSessionScope.of(context);
    final account = session.account;
    return Scaffold(
      appBar: AppBar(title: const Text('Host')),
      body: account == null
          ? StatusMessage(
              message:
                  'Sign in with a host account. The server assigns the host role; this app cannot grant it.',
              actionLabel: 'Sign in',
              onAction: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => const AuthPage()),
                );
                if (!context.mounted) {
                  return;
                }
                setState(() {
                  _verification = null;
                  _needsProfile = false;
                  _requested = false;
                });
                if (AppSessionScope.of(context).account?.isHost == true) {
                  await _load();
                }
              },
            )
          : !account.isHost
              ? const Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'This account does not have the host role, so host actions stay unavailable.',
                  ),
                )
              : _loading
                  ? const Center(child: CircularProgressIndicator())
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        if (_error != null) ErrorText(_error),
                        if (_verification != null) ...[
                          Text('Verification: ${_verification!.verificationStatus}'),
                          Text('Onboarding: ${_verification!.onboardingStatus}'),
                          Text('Public profile: ${_verification!.publicProfileStatus}'),
                          if ((_verification!.note ?? '').isNotEmpty)
                            Text('Note: ${_verification!.note}'),
                        ],
                        if (_needsProfile)
                          const Text('Create a host profile before the other host tools will load.'),
                        const SizedBox(height: 12),
                        PrimaryButton(
                          label: 'Profile and verification',
                          onPressed: () async {
                            await Navigator.of(context).push(
                              MaterialPageRoute<void>(
                                builder: (_) => const HostAccountPage(),
                              ),
                            );
                            if (mounted) {
                              await _load();
                            }
                          },
                        ),
                        const SizedBox(height: 8),
                        PrimaryButton(
                          label: 'Experiences',
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute<void>(
                                builder: (_) => const HostExperienceListPage(),
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 8),
                        PrimaryButton(
                          label: 'Bookings',
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute<void>(
                                builder: (_) => const BookingListPage(hostView: true),
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 8),
                        PrimaryButton(
                          label: 'Offer on a request',
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute<void>(builder: (_) => const HostOfferPage()),
                            );
                          },
                        ),
                        const SizedBox(height: 8),
                        PrimaryButton(
                          label: 'Earnings and payouts',
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute<void>(builder: (_) => const HostFinancePage()),
                            );
                          },
                        ),
                      ],
                    ),
    );
  }
}

class HostAccountPage extends StatefulWidget {
  const HostAccountPage({super.key});

  @override
  State<HostAccountPage> createState() => _HostAccountPageState();
}

class _HostAccountPageState extends State<HostAccountPage> {
  final _name = TextEditingController();
  final _bio = TextEditingController();
  final _holder = TextEditingController();
  final _ifsc = TextEditingController();
  final _account = TextEditingController();
  String _documentType = 'IDENTITY';
  HostVerification? _verification;
  bool _busy = false;
  Object? _error;
  String? _notice;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _refresh();
      }
    });
  }

  @override
  void dispose() {
    _name.dispose();
    _bio.dispose();
    _holder.dispose();
    _ifsc.dispose();
    _account.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final verification = await AppSessionScope.of(context).api.verification();
      if (mounted) {
        setState(() => _verification = verification);
      }
    } on ApiException catch (error) {
      if (mounted && error.code != 'HOST_PROFILE_REQUIRED') {
        setState(() => _error = error);
      }
    }
  }

  Future<void> _onboard(bool submit) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final verification = await AppSessionScope.of(context).api.onboard(
            publicName: _name.text.trim(),
            bio: _bio.text.trim().isEmpty ? null : _bio.text.trim(),
            submit: submit,
          );
      if (mounted) {
        setState(() {
          _verification = verification;
          _notice = 'Server verification status: ${verification.verificationStatus}.';
        });
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

  Future<void> _saveAccount() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final verification = await AppSessionScope.of(context).api.savePayoutAccount(
            accountHolderName: _holder.text,
            ifsc: _ifsc.text,
            accountNumber: _account.text,
          );
      _account.clear();
      if (mounted) {
        setState(() {
          _verification = verification;
          _notice = 'The server stored a masked payout account. The full number is not kept in the app.';
        });
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

  Future<void> _addDocument() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final document = await AppSessionScope.of(context).api.addDocument(_documentType);
      await _refresh();
      if (mounted) {
        final upload = document.uploadStatus ?? 'unknown';
        setState(() {
          _notice = upload == 'unavailable'
              ? 'The server recorded the document type. File upload is unavailable, so no file was sent.'
              : 'Document ${document.id} is ${document.verificationState}.';
        });
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
    final verification = _verification;
    final masked = verification?.payoutAccount;
    return Scaffold(
      appBar: AppBar(title: const Text('Host profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Verification status is read-only. Saving a bank account does not approve you or settle a payout.',
          ),
          if (verification != null) ...[
            const SizedBox(height: 8),
            Text('Verification: ${verification.verificationStatus}'),
            Text('Onboarding: ${verification.onboardingStatus}'),
            for (final document in verification.documents)
              Text('${document.documentType}: ${document.verificationState}'),
            if (masked != null)
              Text(
                'Payout account: ${masked.accountHolderName}, ${masked.ifsc}, ending ${masked.accountLast4}',
              ),
          ],
          const SizedBox(height: 12),
          LabeledField(label: 'Public name', controller: _name),
          const SizedBox(height: 8),
          LabeledField(label: 'Bio', controller: _bio, maxLines: 4),
          const SizedBox(height: 8),
          PrimaryButton(label: 'Save profile', busy: _busy, onPressed: () => _onboard(false)),
          const SizedBox(height: 8),
          PrimaryButton(
            label: 'Submit for verification',
            busy: _busy,
            onPressed: () => _onboard(true),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            key: ValueKey(_documentType),
            initialValue: _documentType,
            decoration: const InputDecoration(labelText: 'Document type'),
            items: const [
              DropdownMenuItem(value: 'IDENTITY', child: Text('Identity')),
              DropdownMenuItem(value: 'ADDRESS', child: Text('Address')),
              DropdownMenuItem(value: 'CREDENTIAL', child: Text('Credential')),
              DropdownMenuItem(value: 'OTHER', child: Text('Other')),
            ],
            onChanged: (value) {
              if (value != null) {
                setState(() => _documentType = value);
              }
            },
          ),
          const SizedBox(height: 8),
          PrimaryButton(label: 'Register document type', busy: _busy, onPressed: _addDocument),
          const SizedBox(height: 16),
          LabeledField(label: 'Account holder name', controller: _holder),
          const SizedBox(height: 8),
          LabeledField(label: 'IFSC', controller: _ifsc),
          const SizedBox(height: 8),
          LabeledField(
            label: 'Account number',
            controller: _account,
            keyboardType: TextInputType.number,
            helper: 'Sent once. The response returns only the last four digits.',
          ),
          const SizedBox(height: 8),
          PrimaryButton(
            key: const Key('save-payout-account'),
            label: 'Save payout account',
            busy: _busy,
            onPressed: _saveAccount,
          ),
          if (_notice != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_notice!)),
          ErrorText(_error),
        ],
      ),
    );
  }
}
