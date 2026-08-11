import { type Permissions } from './permissions';

export type UserRole = 'Admin' | 'User' | 'Driver';

export interface CurrentUser {
  id: string;
  userName: string;
  firstName?: string;
  lastName?: string;
  roles: UserRole[];
  perms: Permissions;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
