/// Capabilities that a future server session may grant.
///
/// Phase 1 has no authentication. [adminAccess] must be set only from a
/// server-verified session. User input must never construct this as true.
class SessionCapabilities {
  const SessionCapabilities({this.adminAccess = false});

  final bool adminAccess;

  static const unauthorised = SessionCapabilities();
}
