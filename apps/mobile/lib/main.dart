import 'package:flutter/material.dart';
import 'package:mittiandmiles/app/mitti_app.dart';
import 'package:mittiandmiles/core/session/session_capabilities.dart';

void main() {
  runApp(const MittiApp(capabilities: SessionCapabilities.unauthorised));
}
