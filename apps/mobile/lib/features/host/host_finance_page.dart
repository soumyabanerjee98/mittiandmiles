import 'package:flutter/material.dart';
import 'package:mittiandmiles/core/session/app_session_scope.dart';
import 'package:mittiandmiles/core/widgets/ui.dart';
import 'package:mittiandmiles/data/models.dart';

class HostFinancePage extends StatefulWidget {
  const HostFinancePage({super.key});

  @override
  State<HostFinancePage> createState() => _HostFinancePageState();
}

class _HostFinancePageState extends State<HostFinancePage> {
  Earnings? _earnings;
  List<Payout> _payouts = const [];
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
    final api = AppSessionScope.of(context).api;
    try {
      final earnings = await api.earnings();
      final payouts = await api.payouts();
      if (!mounted) {
        return;
      }
      setState(() {
        _earnings = earnings;
        _payouts = payouts;
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
    final earnings = _earnings;
    return Scaffold(
      appBar: AppBar(title: const Text('Earnings')),
      body: AsyncBody(
        loading: _loading,
        error: _error,
        empty: false,
        emptyMessage: '',
        onRetry: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Settlement is ${earnings?.settlement ?? 'unconfirmed'}. These figures come from the server. This screen cannot mark a payout settled.',
            ),
            const SizedBox(height: 12),
            if (earnings != null && earnings.items.isEmpty)
              const Text('No earnings records yet.'),
            if (earnings != null)
              for (final item in earnings.items)
                Text(
                  '${item.currency}: payable ${formatMinor(item.hostPayableMinor, item.currency)}, allocated ${formatMinor(item.allocatedMinor, item.currency)}, available ${formatMinor(item.availableMinor, item.currency)}',
                ),
            const SizedBox(height: 16),
            const Text('Payouts'),
            if (_payouts.isEmpty) const Text('No payout records yet.'),
            for (final payout in _payouts)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('${formatMinor(payout.amountMinor, payout.currency)} · ${payout.status}'),
                subtitle: Text(payout.allocations.map((row) => row.bookingId).join(', ')),
              ),
          ],
        ),
      ),
    );
  }
}
