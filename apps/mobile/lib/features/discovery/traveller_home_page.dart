import 'package:flutter/material.dart';
import 'package:mittiandmiles/features/discovery/discovery_page.dart';

class TravellerHomePage extends StatelessWidget {
  const TravellerHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Navigator(
      onGenerateRoute: (settings) {
        return MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => const DiscoveryPage(),
        );
      },
    );
  }
}
