import { getUser } from './api.js';

// ADD: president, secretary, treasurer, manager, admin (+superadmin)
export function canAdd() {
  const user = getUser();
  if (!user) return false;
  return ['superadmin', 'admin', 'president', 'secretary', 'treasurer', 'manager'].includes(user.role);
}

// EDIT: admin (+superadmin)
export function canEdit() {
  const user = getUser();
  if (!user) return false;
  return ['superadmin', 'admin'].includes(user.role);
}

// DELETE: superadmin only
export function canDelete() {
  const user = getUser();
  return user?.role === 'superadmin';
}

// Whether to show the "Actions" column at all (edit or delete available)
export function canEditDelete() {
  return canEdit() || canDelete();
}

export function isSuperAdmin() {
  const user = getUser();
  return user?.role === 'superadmin';
}
