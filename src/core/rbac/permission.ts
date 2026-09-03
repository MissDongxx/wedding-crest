import { redirect } from '@/core/i18n/navigation';
import { getSignUser } from '@/shared/models/user';
import {
  hasAllPermissions,
  hasAnyPermission,
  hasAnyRole,
  hasPermission,
  hasRole,
} from '@/shared/services/rbac';

// Permission constants
export const PERMISSIONS = {
  // Admin access
  ADMIN_ACCESS: 'admin.access',

  // Users
  USERS_READ: 'admin.users.read',
  USERS_WRITE: 'admin.users.write',
  USERS_DELETE: 'admin.users.delete',

  // Posts
  POSTS_READ: 'admin.posts.read',
  POSTS_WRITE: 'admin.posts.write',
  POSTS_DELETE: 'admin.posts.delete',

  // Categories
  CATEGORIES_READ: 'admin.categories.read',
  CATEGORIES_WRITE: 'admin.categories.write',
  CATEGORIES_DELETE: 'admin.categories.delete',

  // Payments
  PAYMENTS_READ: 'admin.payments.read',

  // Subscriptions
  SUBSCRIPTIONS_READ: 'admin.subscriptions.read',

  // Credits
  CREDITS_READ: 'admin.credits.read',
  CREDITS_WRITE: 'admin.credits.write',

  // API Keys
  APIKEYS_READ: 'admin.apikeys.read',
  APIKEYS_WRITE: 'admin.apikeys.write',
  APIKEYS_DELETE: 'admin.apikeys.delete',

  // Settings
  SETTINGS_READ: 'admin.settings.read',
  SETTINGS_WRITE: 'admin.settings.write',

  // Roles & Permissions
  ROLES_READ: 'admin.roles.read',
  ROLES_WRITE: 'admin.roles.write',
  ROLES_DELETE: 'admin.roles.delete',

  PERMISSIONS_READ: 'admin.permissions.read',
  PERMISSIONS_WRITE: 'admin.permissions.write',
  PERMISSIONS_DELETE: 'admin.permissions.delete',

  // AI Tasks
  AITASKS_READ: 'admin.ai-tasks.read',
  AITASKS_WRITE: 'admin.ai-tasks.write',
  AITASKS_DELETE: 'admin.ai-tasks.delete',

  // Wedding Crest Studio admin
  WEDDING_FRAMES_READ: 'admin.wedding.frames.read',
  WEDDING_FRAMES_WRITE: 'admin.wedding.frames.write',
  WEDDING_FRAMES_DELETE: 'admin.wedding.frames.delete',
  WEDDING_EXAMPLES_READ: 'admin.wedding.examples.read',
  WEDDING_EXAMPLES_WRITE: 'admin.wedding.examples.write',
  WEDDING_EXAMPLES_DELETE: 'admin.wedding.examples.delete',
} as const;

/**
 * Permission guard error
 */
export class PermissionDeniedError extends Error {
  constructor(message = 'Permission denied') {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

const ADMIN_PERMISSION_TIMEOUT_MS = 10000;

/**
 * Check if user can access admin area
 */
export async function canAccessAdmin(userId: string): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      hasPermission(userId, PERMISSIONS.ADMIN_ACCESS),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), ADMIN_PERMISSION_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Check if current user has permission, throw error if not
 */
export async function requirePermission({
  code,
  redirectUrl,
  locale,
}: {
  code: string;
  redirectUrl?: string;
  locale?: string;
}): Promise<void> {
  const user = await getSignUser();

  if (!user) {
    if (redirectUrl) {
      redirect({ href: redirectUrl, locale: locale || '' });
    }
    throw new PermissionDeniedError('User not authenticated');
  }

  const allowed = await hasPermission(user.id, code);

  if (!allowed) {
    if (redirectUrl) {
      redirect({ href: redirectUrl, locale: locale || '' });
    }
    throw new PermissionDeniedError(`Permission required: ${code}`);
  }
}

/**
 * Check if current user has any of the permissions, throw error if not
 */
export async function requireAnyPermission({
  codes,
  redirectUrl,
  locale,
}: {
  codes: string[];
  redirectUrl?: string;
  locale?: string;
}): Promise<void> {
  const user = await getSignUser();

  if (!user) {
    if (redirectUrl) {
      redirect({ href: redirectUrl, locale: locale || '' });
    }
    throw new PermissionDeniedError('User not authenticated');
  }

  const allowed = await hasAnyPermission(user.id, codes);

  if (!allowed) {
    if (redirectUrl) {
      redirect({ href: redirectUrl, locale: locale || '' });
    }
    throw new PermissionDeniedError(
      `Any of these permissions required: ${codes.join(', ')}`
    );
  }
}

/**
 * Check if current user has all of the permissions, throw error if not
 */
export async function requireAllPermissions({
  codes,
  redirectUrl,
  locale,
}: {
  codes: string[];
  redirectUrl?: string;
  locale?: string;
}): Promise<void> {
  const user = await getSignUser();

  if (!user) {
    if (redirectUrl) {
      redirect({ href: redirectUrl, locale: locale || '' });
    }
    throw new PermissionDeniedError('User not authenticated');
  }

  const allowed = await hasAllPermissions(user.id, codes);

  if (!allowed) {
    if (redirectUrl) {
      redirect({ href: redirectUrl, locale: locale || '' });
    }
    throw new PermissionDeniedError(
      `All of these permissions required: ${codes.join(', ')}`
    );
  }
}

/**
 * Check if current user has role, throw error if not
 */
export async function requireRole({
  roleName,
  redirectUrl,
  locale,
}: {
  roleName: string;
  redirectUrl?: string;
  locale?: string;
}): Promise<void> {
  const user = await getSignUser();

  if (!user) {
    if (redirectUrl) {
      redirect({ href: redirectUrl, locale: locale || '' });
    }
    throw new PermissionDeniedError('User not authenticated');
  }

  const allowed = await hasRole(user.id, roleName);

  if (!allowed) {
    if (redirectUrl) {
      redirect({ href: redirectUrl, locale: locale || '' });
    }
    throw new PermissionDeniedError(`Role required: ${roleName}`);
  }
}

/**
 * Check if current user has any of the roles, throw error if not
 */
export async function requireAnyRole({
  roleNames,
  redirectUrl,
  locale,
}: {
  roleNames: string[];
  redirectUrl?: string;
  locale?: string;
}): Promise<void> {
  const user = await getSignUser();

  if (!user) {
    if (redirectUrl) {
      redirect({ href: redirectUrl, locale: locale || '' });
    }
    throw new PermissionDeniedError('User not authenticated');
  }

  const allowed = await hasAnyRole(user.id, roleNames);

  if (!allowed) {
    if (redirectUrl) {
      redirect({ href: redirectUrl, locale: locale || '' });
    }
    throw new PermissionDeniedError(
      `Any of these roles required: ${roleNames.join(', ')}`
    );
  }
}

/**
 * Check if current user can access admin area
 */
export async function requireAdminAccess({
  redirectUrl,
  locale,
}: {
  redirectUrl?: string;
  locale?: string;
}): Promise<void> {
  const user = await getSignUser();

  if (!user) {
    redirect({ href: '/sign-in', locale: locale || '' });
  }

  const allowed = await canAccessAdmin(user!.id);

  if (!allowed) {
    redirect({ href: redirectUrl || '', locale: locale || '' });
  }
}

/**
 * Get current user with permission check
 * Returns null if user doesn't have permission
 */
export async function getCurrentUserWithPermission({
  code,
  locale,
}: {
  code: string;
  locale?: string;
}): Promise<{ id: string; email: string; name: string } | null> {
  const user = await getSignUser();
  if (!user) return null;

  const allowed = await hasPermission(user.id, code);
  if (!allowed) return null;

  return user;
}

/**
 * Check page access permissions
 * Returns true if user has access, false otherwise
 */
export async function checkPageAccess({
  codes,
  locale,
}: {
  codes: string[];
  locale?: string;
}): Promise<boolean> {
  const user = await getSignUser();
  if (!user) return false;

  return await hasAnyPermission(user.id, codes);
}

/**
 * Higher-order function for API routes with permission check
 */
export function withPermission<T extends (...args: any[]) => any>(
  handler: T,
  {
    code,
    locale,
  }: {
    code: string;
    locale?: string;
  }
): T {
  return (async (...args: Parameters<T>) => {
    await requirePermission({ code, locale });
    return handler(...args);
  }) as T;
}

/**
 * Higher-order function for API routes with role check
 */
export function withRole<T extends (...args: any[]) => any>(
  handler: T,
  {
    roleName,
    locale,
  }: {
    roleName: string;
    locale?: string;
  }
): T {
  return (async (...args: Parameters<T>) => {
    await requireRole({ roleName, locale });
    return handler(...args);
  }) as T;
}
