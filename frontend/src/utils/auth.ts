import type { AppUser, RoleName, SessionUser } from '../types/auth';

const ROLE_NAMES: RoleName[] = ['Admin', 'Trainer', 'Trainee'];

type TokenPayload = {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
  primaryRole?: string;
  exp?: number;
};

export const decodeJwt = (token: string): TokenPayload | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((character) => `%${(`00${character.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(''),
    );

    return JSON.parse(jsonPayload) as TokenPayload;
  } catch {
    return null;
  }
};

export const isKnownRole = (role: string | undefined): role is RoleName => {
  return Boolean(role && ROLE_NAMES.includes(role as RoleName));
};

export const normalizeRole = (role: string | undefined): RoleName => {
  return isKnownRole(role) ? role : 'Trainee';
};

export const getRoleName = (role: AppUser['primaryRole']): RoleName => {
  if (typeof role === 'string') {
    return normalizeRole(role);
  }

  return normalizeRole(role?.name);
};

export const normalizeUser = (user: AppUser): SessionUser => {
  const roles = user.roles?.map((role) => normalizeRole(role.name)) ?? [];
  const primaryRole = getRoleName(user.primaryRole);
  const uniqueRoles = Array.from(new Set([primaryRole, ...roles]));

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: uniqueRoles,
    primaryRole,
    status: user.status,
  };
};

export const userFromToken = (token: string): SessionUser | null => {
  const decoded = decodeJwt(token);

  if (!decoded || !decoded.id || !decoded.email) {
    return null;
  }

  if (decoded.exp && decoded.exp * 1000 <= Date.now()) {
    return null;
  }

  const primaryRole = normalizeRole(decoded.primaryRole);
  const roles = Array.from(new Set([primaryRole, ...(decoded.roles ?? []).map(normalizeRole)]));

  return {
    id: decoded.id,
    email: decoded.email,
    firstName: decoded.firstName,
    lastName: decoded.lastName,
    roles,
    primaryRole,
  };
};
