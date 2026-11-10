import 'package:flutter/material.dart';
import 'package:mittiandmiles/core/network/api_exception.dart';

String describeError(Object error) {
  if (error is ApiException) {
    final reference = error.requestId;
    if (reference == null || reference.isEmpty) {
      return error.message;
    }
    return '${error.message} Reference: $reference';
  }
  if (error is FormatException) {
    return 'The server returned an unexpected response.';
  }
  return 'Something went wrong. Try again.';
}

class AsyncBody extends StatelessWidget {
  const AsyncBody({
    super.key,
    required this.loading,
    required this.error,
    required this.empty,
    required this.emptyMessage,
    required this.onRetry,
    required this.child,
  });

  final bool loading;
  final Object? error;
  final bool empty;
  final String emptyMessage;
  final VoidCallback onRetry;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (error != null) {
      return StatusMessage(
        message: describeError(error!),
        actionLabel: 'Try again',
        onAction: onRetry,
      );
    }
    if (empty) {
      return StatusMessage(
        message: emptyMessage,
        actionLabel: 'Refresh',
        onAction: onRetry,
      );
    }
    return child;
  }
}

class StatusMessage extends StatelessWidget {
  const StatusMessage({
    super.key,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            SizedBox(
              height: 48,
              child: OutlinedButton(onPressed: onAction, child: Text(actionLabel)),
            ),
          ],
        ),
      ),
    );
  }
}

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        child: busy
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Text(label),
      ),
    );
  }
}

class LabeledField extends StatelessWidget {
  const LabeledField({
    super.key,
    required this.label,
    required this.controller,
    this.keyboardType,
    this.obscure = false,
    this.maxLines = 1,
    this.helper,
  });

  final String label;
  final TextEditingController controller;
  final TextInputType? keyboardType;
  final bool obscure;
  final int maxLines;
  final String? helper;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscure,
      maxLines: obscure ? 1 : maxLines,
      decoration: InputDecoration(
        labelText: label,
        helperText: helper,
      ),
    );
  }
}

class ErrorText extends StatelessWidget {
  const ErrorText(this.error, {super.key});

  final Object? error;

  @override
  Widget build(BuildContext context) {
    if (error == null) {
      return const SizedBox.shrink();
    }
    final lines = <String>[describeError(error!)];
    if (error is ApiException) {
      for (final detail in (error! as ApiException).details) {
        if (detail.field.isEmpty) {
          lines.add(detail.message);
        } else {
          lines.add('${detail.field}: ${detail.message}');
        }
      }
    }
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Text(
        lines.join('\n'),
        style: TextStyle(color: Theme.of(context).colorScheme.error),
      ),
    );
  }
}

String formatMinor(int minor, String currency) {
  final sign = minor < 0 ? '-' : '';
  final absolute = minor.abs();
  final whole = absolute ~/ 100;
  final fraction = (absolute % 100).toString().padLeft(2, '0');
  return '$sign$currency $whole.$fraction';
}

String todayIsoDate() {
  final now = DateTime.now();
  return formatDay(now);
}

String formatDay(DateTime date) {
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '${date.year}-$month-$day';
}

String addDaysIso(String day, int days) {
  final parts = day.split('-');
  if (parts.length != 3) {
    return day;
  }
  final date = DateTime(int.parse(parts[0]), int.parse(parts[1]), int.parse(parts[2]));
  return formatDay(date.add(Duration(days: days)));
}
