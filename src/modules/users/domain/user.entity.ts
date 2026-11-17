export const Role = { CLIENT: 'CLIENT', PROVIDER: 'PROVIDER' } as const;
export type Role = (typeof Role)[keyof typeof Role];

export interface User {
  id: string;
  fullName: string;
  nif: string;
  email: string; // always lowercase
  passwordHash: string;
  role: Role;
  balance: number; // integer, smallest currency unit (cents)
  createdAt: Date;
}

export type NewUser = Pick<User, 'fullName' | 'nif' | 'email' | 'passwordHash' | 'role'>;

/** What the API may expose: never the password hash. */
export type PublicUser = Omit<User, 'passwordHash'>;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _omit, ...rest } = user;
  return rest;
}
