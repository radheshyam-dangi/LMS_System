export type RoleName = 'Admin' | 'Trainer' | 'Trainee';

export type UserRole = {
  id?: string;
  name: RoleName | string;
};

export type UserStatus = 'invited' | 'activated';

export type AppUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles?: UserRole[];
  primaryRole?: UserRole | RoleName | string;
  status?: UserStatus;
};

export type SessionUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: RoleName[];
  primaryRole: RoleName;
  status?: UserStatus;
};

export type LoginResponse = {
  user: AppUser;
  accessToken: string;
};

export type InviteUserPayload = {
  to: string;
  subject: string;
  firstName: string;
  lastName: string;
  roles: RoleName[];
  isPrimary: RoleName;
};
