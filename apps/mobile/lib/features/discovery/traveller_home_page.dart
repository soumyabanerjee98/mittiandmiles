import 'package:flutter/material.dart';

class TravellerHomePage extends StatelessWidget {
  const TravellerHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Traveller', style: TextStyle(fontSize: 28)),
              SizedBox(height: 12),
              Text('Discover local experiences. Listings are not available in this build.'),
            ],
          ),
        ),
      ),
    );
  }
}
