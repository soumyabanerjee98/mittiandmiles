import 'package:flutter/material.dart';

class HostHomePage extends StatelessWidget {
  const HostHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Host', style: TextStyle(fontSize: 28)),
              SizedBox(height: 12),
              Text('Host tools will be added in a later phase.'),
            ],
          ),
        ),
      ),
    );
  }
}
