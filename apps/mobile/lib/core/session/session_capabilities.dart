/// Navigation hints from the authenticated account payload.
///
/// [adminAccess] is copied from `GET /me`. It is not inferred from role
/// names, and nothing in the UI can set it.
class SessionCapabilities {
  const SessionCapabilities({this.adminAccess = false});

  final bool adminAccess;

  static const unauthorised = SessionCapabilities();
}
