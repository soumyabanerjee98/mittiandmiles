import 'package:flutter/material.dart';

class AdminAccessDeniedPage extends StatelessWidget {
  const AdminAccessDeniedPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('You do not have admin access.'),
        ),
      ),
    );
  }
}
