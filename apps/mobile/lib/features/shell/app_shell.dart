import 'package:flutter/material.dart';
import 'package:mittiandmiles/core/session/session_capabilities.dart';
import 'package:mittiandmiles/features/admin/admin_gate.dart';
import 'package:mittiandmiles/features/discovery/traveller_home_page.dart';
import 'package:mittiandmiles/features/host/host_home_page.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.capabilities});

  final SessionCapabilities capabilities;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      const TravellerHomePage(),
      const HostHomePage(),
      if (widget.capabilities.adminAccess)
        AdminGate(capabilities: widget.capabilities),
    ];
    final destinations = <NavigationDestination>[
      const NavigationDestination(
        icon: Icon(Icons.explore_outlined),
        selectedIcon: Icon(Icons.explore),
        label: 'Traveller',
      ),
      const NavigationDestination(
        icon: Icon(Icons.home_outlined),
        selectedIcon: Icon(Icons.home),
        label: 'Host',
      ),
      if (widget.capabilities.adminAccess)
        const NavigationDestination(
          icon: Icon(Icons.admin_panel_settings_outlined),
          selectedIcon: Icon(Icons.admin_panel_settings),
          label: 'Admin',
        ),
    ];

    final selected = _index.clamp(0, pages.length - 1);

    return Scaffold(
      body: pages[selected],
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected,
        destinations: destinations,
        onDestinationSelected: (index) {
          setState(() {
            _index = index;
          });
        },
      ),
    );
  }
}
