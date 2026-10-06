import type { Repository } from '../shared/Repository';
import { NotFoundError } from '../shared/errors';
import { hasRole, isAlertRecipient, type Role, type UserAccount } from './UserAccount';

/** Query port for finding people; narrow on purpose (Interface Segregation). */
export interface UserDirectory {
  get(userId: string): UserAccount;
  findRecipientsInDistricts(districtIds: readonly string[]): UserAccount[];
  findByRole(role: Role): UserAccount[];
}

export class RepositoryUserDirectory implements UserDirectory {
  constructor(private readonly users: Repository<UserAccount>) {}

  get(userId: string): UserAccount {
    const user = this.users.findById(userId);
    if (!user) throw new NotFoundError('User', userId);
    return user;
  }

  findRecipientsInDistricts(districtIds: readonly string[]): UserAccount[] {
    const wanted = new Set(districtIds);
    return this.users.findWhere((user) => isAlertRecipient(user) && wanted.has(user.homeDistrictId));
  }

  findByRole(role: Role): UserAccount[] {
    return this.users.findWhere((user) => hasRole(user, role));
  }
}
