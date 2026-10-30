export const OWNER_EMAIL = 'canyone2@naver.com';
export const ACCESS_ROOT = 'accountAccess';

export function resolveRole(user, grant) {
    if (!user) return 'visitor';
    if (user.email === OWNER_EMAIL) return 'owner';
    if (user.emailVerified && grant?.role === 'treasurer' && grant.email === user.email) return 'treasurer';
    return 'pending';
}

export function canManage(role) {
    return role === 'owner' || role === 'treasurer';
}

export function canRequest(user, request, role) {
    return !!user?.emailVerified && role === 'pending' && (!request || ['rejected', 'revoked'].includes(request.status));
}
