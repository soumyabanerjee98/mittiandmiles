import 'package:flutter/material.dart';

/// Reviews, reports, and support tickets have no traveller or host API yet.
class UnavailableJourneyPage extends StatelessWidget {
  const UnavailableJourneyPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reviews and support')),
      body: const Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'Reviews, reports, and support requests are not available from the API yet.',
        ),
      ),
    );
  }
}
