import 'package:flutter/material.dart';
import 'package:mittiandmiles/features/host/host_dashboard.dart';

class HostHomePage extends StatelessWidget {
  const HostHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Navigator(
      onGenerateRoute: (settings) {
        return MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => const HostDashboard(),
        );
      },
    );
  }
}
