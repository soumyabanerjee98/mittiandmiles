import 'package:flutter/material.dart';
import 'package:mittiandmiles/core/session/session_capabilities.dart';
import 'package:mittiandmiles/features/admin/admin_access_denied_page.dart';
import 'package:mittiandmiles/features/admin/overview/admin_overview_page.dart';

/// Route boundary for the admin area. Hiding navigation is not sufficient;
/// this gate still denies access when admin capability is absent.
class AdminGate extends StatelessWidget {
  const AdminGate({super.key, required this.capabilities});

  final SessionCapabilities capabilities;

  @override
  Widget build(BuildContext context) {
    if (!capabilities.adminAccess) {
      return const AdminAccessDeniedPage();
    }
    return const AdminOverviewPage();
  }
}
