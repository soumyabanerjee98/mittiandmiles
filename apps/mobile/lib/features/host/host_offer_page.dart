import 'package:flutter/material.dart';
import 'package:mittiandmiles/core/session/app_session_scope.dart';
import 'package:mittiandmiles/core/widgets/ui.dart';
import 'package:mittiandmiles/data/models.dart';
import 'package:mittiandmiles/data/payloads.dart';

class HostOfferPage extends StatefulWidget {
  const HostOfferPage({super.key});

  @override
  State<HostOfferPage> createState() => _HostOfferPageState();
}

class _HostOfferPageState extends State<HostOfferPage> {
  final _requestId = TextEditingController();
  final _starts = TextEditingController();
  final _ends = TextEditingController();
  final _price = TextEditingController();
  final _currency = TextEditingController(text: 'INR');
  final _inclusions = TextEditingController();
  final _exclusions = TextEditingController();
  final _policy = TextEditingController();
  final _expires = TextEditingController();
  final _withdrawId = TextEditingController();
  bool _busy = false;
  Object? _error;
  Offer? _offer;

  @override
  void dispose() {
    for (final controller in [
      _requestId,
      _starts,
      _ends,
      _price,
      _currency,
      _inclusions,
      _exclusions,
      _policy,
      _expires,
      _withdrawId,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _send() async {
    final price = int.tryParse(_price.text.trim());
    if (price == null ||
        !isInstant(_starts.text.trim()) ||
        !isInstant(_ends.text.trim()) ||
        !isInstant(_expires.text.trim())) {
      setState(() => _error = 'Enter a request id, price, and UTC instants.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final offer = await AppSessionScope.of(context).api.createOffer(
            _requestId.text.trim(),
            OfferDraft(
              proposedStartsAt: _starts.text.trim(),
              proposedEndsAt: _ends.text.trim(),
              priceMinor: price,
              currency: _currency.text.trim(),
              inclusions: _inclusions.text.trim(),
              exclusions: _exclusions.text.trim(),
              cancellationPolicy: _policy.text.trim(),
              expiresAt: _expires.text.trim(),
            ),
          );
      if (mounted) {
        setState(() => _offer = offer);
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

  Future<void> _withdraw() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final offer = await AppSessionScope.of(context).api.withdrawOffer(_withdrawId.text.trim());
      if (mounted) {
        setState(() => _offer = offer);
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
      appBar: AppBar(title: const Text('Offer')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'There is no host inbox of open requests. Offer on a request id shared with you. The price you send is a proposal; accepting it does not mark payment successful.',
          ),
          const SizedBox(height: 12),
          LabeledField(label: 'Request id', controller: _requestId),
          const SizedBox(height: 8),
          LabeledField(label: 'Starts', controller: _starts, helper: 'UTC instant'),
          const SizedBox(height: 8),
          LabeledField(label: 'Ends', controller: _ends),
          const SizedBox(height: 8),
          LabeledField(label: 'Price, minor units', controller: _price, keyboardType: TextInputType.number),
          const SizedBox(height: 8),
          LabeledField(label: 'Currency', controller: _currency),
          const SizedBox(height: 8),
          LabeledField(label: 'Inclusions', controller: _inclusions, maxLines: 3),
          const SizedBox(height: 8),
          LabeledField(label: 'Exclusions', controller: _exclusions, maxLines: 3),
          const SizedBox(height: 8),
          LabeledField(label: 'Cancellation policy', controller: _policy, maxLines: 3),
          const SizedBox(height: 8),
          LabeledField(label: 'Offer expires', controller: _expires),
          const SizedBox(height: 12),
          PrimaryButton(label: 'Send offer', busy: _busy, onPressed: _send),
          const SizedBox(height: 16),
          LabeledField(label: 'Offer id to withdraw', controller: _withdrawId),
          const SizedBox(height: 8),
          PrimaryButton(label: 'Withdraw offer', busy: _busy, onPressed: _withdraw),
          if (_offer != null) ...[
            const SizedBox(height: 12),
            Text('Offer ${_offer!.id} is ${_offer!.status}.'),
          ],
          ErrorText(_error),
        ],
      ),
    );
  }
}
