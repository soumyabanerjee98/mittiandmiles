import 'package:flutter/material.dart';

/// Placeholder only. Verification, moderation, finance, and audit screens
/// belong to later phases.
class AdminOverviewPage extends StatelessWidget {
  const AdminOverviewPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Admin', style: TextStyle(fontSize: 28)),
              SizedBox(height: 12),
              Text('Admin tools are not available in this build.'),
            ],
          ),
        ),
      ),
    );
  }
}
