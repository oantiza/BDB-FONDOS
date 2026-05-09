/**
 * useAdminAuth — Reusable frontend admin authorization pattern.
 *
 * ⚠️ SECURITY INVARIANT:
 * This frontend guard is UX-ONLY convenience. It hides UI elements from
 * non-admin users, but provides NO real security. The backend (Cloud Functions)
 * and Firestore Security Rules MUST independently enforce authorization.
 * Never rely solely on this guard for access control.
 *
 * @see docs/BDB_ADMIN_CONSOLE_DESIGN_0.md — Section 4: Principios de Seguridad
 */

import { auth } from '../firebase';

// ---------------------------------------------------------------------------
// Admin allowlist — single source of truth for frontend admin email checks.
// The canonical allowlist lives in the backend (endpoints_admin.py) and
// Firestore rules (firestore.rules → isAdmin()). This is a convenience mirror.
// ---------------------------------------------------------------------------
export const ADMIN_EMAILS: ReadonlyArray<string> = [
  'oantiza@gmail.com',
];

// ---------------------------------------------------------------------------
// Pure helper functions (testable without React / Firebase mocks)
// ---------------------------------------------------------------------------

/** Normalize an email for comparison: lowercase + trim. */
export function normalizeEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/** Check whether an email belongs to the admin allowlist. */
export function isAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return ADMIN_EMAILS.some((admin) => normalizeEmail(admin) === normalized);
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface AdminAuthState {
  /** The Firebase User object, or null. */
  user: typeof auth.currentUser;
  /** The user's email, or null. */
  email: string | null;
  /** Whether the current user is authenticated (any valid login). */
  isAuthenticated: boolean;
  /** Whether the current user is an admin (email in ADMIN_EMAILS). */
  isAdmin: boolean;
}

/**
 * Returns the current user's admin authorization state.
 *
 * Usage:
 * ```tsx
 * const { isAdmin } = useAdminAuth();
 * if (isAdmin) { ... }
 * ```
 */
export function useAdminAuth(): AdminAuthState {
  const user = auth.currentUser;
  const email = user?.email ?? null;
  return {
    user,
    email,
    isAuthenticated: !!user,
    isAdmin: isAdminEmail(email),
  };
}
