import 'package:flutter/material.dart';

/// Charcoal, leaf, and blue tokens from the product design direction.
/// Primary green is darkened so white button text keeps readable contrast.
ThemeData buildAppTheme() {
  const ink = Color(0xFF090F0A);
  const action = Color(0xFF3E6212);
  const scheme = ColorScheme(
    brightness: Brightness.light,
    primary: action,
    onPrimary: Colors.white,
    secondary: Color(0xFF3664A1),
    onSecondary: Colors.white,
    error: Color(0xFFB33B35),
    onError: Colors.white,
    surface: Colors.white,
    onSurface: ink,
    primaryContainer: Color(0xFFE7F0D4),
    onPrimaryContainer: action,
  );
  final text = Typography.material2021().black.apply(
        bodyColor: ink,
        displayColor: ink,
      );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: const Color(0xFFF6F7F4),
    textTheme: text,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: ink,
      elevation: 0,
      centerTitle: false,
    ),
    navigationBarTheme: const NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: Color(0xFFE7F0D4),
    ),
    inputDecorationTheme: const InputDecorationTheme(
      border: OutlineInputBorder(),
      filled: true,
      fillColor: Colors.white,
    ),
  );
}
