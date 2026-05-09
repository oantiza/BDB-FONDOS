/**
 * AdminGuard — Conditional renderer that shows children only to admin users.
 *
 * ⚠️ SECURITY INVARIANT:
 * This component is a UX convenience. It hides UI from non-admin users,
 * but does NOT provide real security. Backend endpoints and Firestore rules
 * MUST independently enforce authorization on every request.
 *
 * @example
 * ```tsx
 * <AdminGuard>
 *   <AdminDashboard />
 * </AdminGuard>
 *
 * <AdminGuard fallback={<p>No tienes acceso</p>}>
 *   <RetrocessionManager />
 * </AdminGuard>
 * ```
 */

import React from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

export interface AdminGuardProps {
  /** Content to render when the user IS an admin. */
  children: React.ReactNode;
  /** Optional content to render when the user is NOT an admin. Defaults to a short message. */
  fallback?: React.ReactNode;
  /** If true (default), require admin role. Set false to require only authentication. */
  requireAdmin?: boolean;
}

const DEFAULT_FALLBACK = (
  <div className="flex items-center justify-center p-8 text-slate-500 text-sm">
    <span className="mr-2">🔒</span>
    Acceso restringido. Se requieren privilegios de administrador.
  </div>
);

export default function AdminGuard({
  children,
  fallback,
  requireAdmin = true,
}: AdminGuardProps) {
  const { isAdmin, isAuthenticated } = useAdminAuth();

  // Not authenticated at all
  if (!isAuthenticated) {
    return <>{fallback ?? DEFAULT_FALLBACK}</>;
  }

  // Authenticated but not admin (when admin is required)
  if (requireAdmin && !isAdmin) {
    return <>{fallback ?? DEFAULT_FALLBACK}</>;
  }

  return <>{children}</>;
}
