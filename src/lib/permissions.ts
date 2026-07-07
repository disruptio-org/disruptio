/**
 * Disruptio Role-Based Access Control (RBAC)
 *
 * Role hierarchy: superadmin > admin > editor > viewer
 *
 * | Role        | Manage Users | Edit Projects | View Projects | Manage Workspace |
 * |-------------|:---:|:---:|:---:|:---:|
 * | superadmin  | ✅ | ✅ | ✅ | ✅ |
 * | admin       | ✅ | ✅ | ✅ | ✅ |
 * | editor      | ❌ | ✅ | ✅ | ❌ |
 * | viewer      | ❌ | ❌ | ✅ | ❌ |
 */

export const ROLES = ['superadmin', 'admin', 'editor', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

const ROLE_LEVEL: Record<string, number> = {
  superadmin: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

/** Check if a user's role meets a minimum required role */
export function hasMinRole(userRole: string, minimumRole: Role): boolean {
  return (ROLE_LEVEL[userRole] || 0) >= (ROLE_LEVEL[minimumRole] || 0);
}

/** Check if user can manage other users (admin+) */
export function canManageUsers(role: string): boolean {
  return hasMinRole(role, 'admin');
}

/** Check if user can edit projects (editor+) */
export function canEditProject(role: string): boolean {
  return hasMinRole(role, 'editor');
}

/** Check if user can view projects (viewer+) */
export function canViewProject(role: string): boolean {
  return hasMinRole(role, 'viewer');
}

/** Check if user is an admin or superadmin */
export function isAdmin(role: string): boolean {
  return hasMinRole(role, 'admin');
}

/** Check if user is a superadmin */
export function isSuperAdmin(role: string): boolean {
  return role === 'superadmin';
}

/**
 * Server-side helper: require authentication.
 * Returns the session or throws a Response-compatible error.
 */
export function requireAuth(session: any): asserts session is { user: { id: string; role: string; status: string } } {
  if (!session?.user) {
    throw new Error('UNAUTHORIZED');
  }
}

/**
 * Server-side helper: require minimum role.
 * Call after requireAuth.
 */
export function requireRole(session: any, minimumRole: Role): void {
  requireAuth(session);
  if (!hasMinRole(session.user.role, minimumRole)) {
    throw new Error('FORBIDDEN');
  }
}
