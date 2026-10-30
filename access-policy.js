export const OWNER_EMAIL = 'canyone2@naver.com';
export const ACCESS_ROOT = 'accountAccess';
export const STAFF_ROLES = ['treasurer', 'director'];

export function resolveRole(user, grant) {
    if (!user) return 'visitor';
    if (user.email === OWNER_EMAIL) return 'owner';
    if (STAFF_ROLES.includes(grant?.role) && grant.email === user.email) return grant.role;
    return 'pending';
}

export function canManage(role) {
    return role === 'owner' || role === 'treasurer';
}

export function canManageMatch(role) {
    return role === 'owner' || role === 'director';
}
