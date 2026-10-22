/**
 * Action permissions. Deny by default: a role grants only the permissions
 * listed here, and only when its scope is empty (global). City or other
 * scopes are stored and not interpreted until that rule is confirmed.
 * Role assignment is not exposed on a public route.
 */
export const Role = {
  TRAVELLER: "TRAVELLER",
  HOST: "HOST",
  OPERATIONS: "OPERATIONS",
  SUPPORT: "SUPPORT",
  VERIFICATION: "VERIFICATION",
  FINANCE: "FINANCE",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const Permission = {
  PROFILE_READ_SELF: "profile.read.self",
  PROFILE_UPDATE_SELF: "profile.update.self",
  BOOKING_READ_OWN: "booking.read.own",
  BOOKING_CREATE_OWN: "booking.create.own",
  REQUEST_WRITE_OWN: "request.write.own",
  EXPERIENCE_WRITE_OWN: "experience.write.own",
  AVAILABILITY_WRITE_OWN: "availability.write.own",
  OFFER_WRITE_OWN: "offer.write.own",
  PAYOUT_READ_OWN: "payout.read.own",
  USER_READ: "user.read",
  HOST_VERIFY: "host.verify",
  DOCUMENT_READ: "document.read",
  EXPERIENCE_MODERATE: "experience.moderate",
  CITY_ACTIVATE: "city.activate",
  DISPUTE_REVIEW: "dispute.review",
  TICKET_MANAGE: "ticket.manage",
  REPORT_REVIEW: "report.review",
  REFUND_REVIEW: "refund.review",
  PAYOUT_REVIEW: "payout.review",
  LEDGER_READ: "ledger.read",
  COMMISSION_MANAGE: "commission.manage",
  RECONCILIATION_READ: "reconciliation.read",
  AUDIT_READ: "audit.read",
  ROLE_ASSIGN: "role.assign",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export type RoleGrant = {
  role: Role;
  scope: string;
};

const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission);

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  TRAVELLER: [
    Permission.PROFILE_READ_SELF,
    Permission.PROFILE_UPDATE_SELF,
    Permission.BOOKING_READ_OWN,
    Permission.BOOKING_CREATE_OWN,
    Permission.REQUEST_WRITE_OWN,
  ],
  HOST: [
    Permission.PROFILE_READ_SELF,
    Permission.PROFILE_UPDATE_SELF,
    Permission.EXPERIENCE_WRITE_OWN,
    Permission.AVAILABILITY_WRITE_OWN,
    Permission.OFFER_WRITE_OWN,
    Permission.BOOKING_READ_OWN,
    Permission.PAYOUT_READ_OWN,
  ],
  OPERATIONS: [
    Permission.USER_READ,
    Permission.EXPERIENCE_MODERATE,
    Permission.CITY_ACTIVATE,
    Permission.DISPUTE_REVIEW,
    Permission.REPORT_REVIEW,
    Permission.AUDIT_READ,
  ],
  SUPPORT: [
    Permission.USER_READ,
    Permission.TICKET_MANAGE,
    Permission.REPORT_REVIEW,
  ],
  VERIFICATION: [
    Permission.USER_READ,
    Permission.HOST_VERIFY,
    Permission.DOCUMENT_READ,
  ],
  FINANCE: [
    Permission.USER_READ,
    Permission.REFUND_REVIEW,
    Permission.PAYOUT_REVIEW,
    Permission.LEDGER_READ,
    Permission.COMMISSION_MANAGE,
    Permission.RECONCILIATION_READ,
    Permission.AUDIT_READ,
  ],
  SUPER_ADMIN: ALL_PERMISSIONS,
};

const SELF_SERVICE: ReadonlySet<Permission> = new Set([
  Permission.PROFILE_READ_SELF,
  Permission.PROFILE_UPDATE_SELF,
  Permission.BOOKING_READ_OWN,
  Permission.BOOKING_CREATE_OWN,
  Permission.REQUEST_WRITE_OWN,
  Permission.EXPERIENCE_WRITE_OWN,
  Permission.AVAILABILITY_WRITE_OWN,
  Permission.OFFER_WRITE_OWN,
  Permission.PAYOUT_READ_OWN,
]);

export function isRole(value: string): value is Role {
  return Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, value);
}

export function permissionsFor(
  grants: readonly RoleGrant[],
): ReadonlySet<Permission> {
  const permissions = new Set<Permission>();
  for (const grant of grants) {
    if (grant.scope !== "") {
      continue;
    }
    const granted = ROLE_PERMISSIONS[grant.role];
    for (const permission of granted) {
      permissions.add(permission);
    }
  }
  return permissions;
}

export function hasPermission(
  grants: readonly RoleGrant[],
  permission: Permission,
): boolean {
  return permissionsFor(grants).has(permission);
}

export function hasAdminAccess(grants: readonly RoleGrant[]): boolean {
  for (const permission of permissionsFor(grants)) {
    if (!SELF_SERVICE.has(permission)) {
      return true;
    }
  }
  return false;
}
