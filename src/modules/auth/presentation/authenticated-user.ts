import { Role } from '../../users/domain/user.entity';

/** What the guard attaches to the request after verifying the JWT. */
export interface AuthenticatedUser {
  id: string;
  role: Role;
}
