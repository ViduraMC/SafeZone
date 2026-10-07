import { AuthorizationError } from '@/core/shared/errors';
import { hasAnyRole, hasRole, Role, type UserAccount } from '@/core/users/UserAccount';
import { ReportCategory } from '../domain/ReportCriteria';

export interface AccessScope {
  /** When set, resource data is limited to this owner organisation. */
  readonly ownerId?: string;
}

/**
 * Strategy deciding what a requester may see (UC05 E3 "Unauthorized
 * Information Access" and A3 "Donor-Specific Report").
 */
export interface ReportAccessPolicy {
  supports(user: UserAccount): boolean;
  authorise(categories: readonly ReportCategory[], user: UserAccount): AccessScope;
}

export class DmcOfficialAccessPolicy implements ReportAccessPolicy {
  supports(user: UserAccount): boolean {
    return hasAnyRole(user, [Role.DMC_OFFICIAL, Role.DMC_OFFICER]);
  }

  authorise(): AccessScope {
    return {};
  }
}

export const DONOR_CATEGORIES: readonly ReportCategory[] = [ReportCategory.RESOURCE_DISTRIBUTION];

export class DonorAccessPolicy implements ReportAccessPolicy {
  supports(user: UserAccount): boolean {
    return hasRole(user, Role.DONOR_REPRESENTATIVE);
  }

  authorise(categories: readonly ReportCategory[], user: UserAccount): AccessScope {
    if (!user.organisationId) {
      throw new AuthorizationError('Your account is not linked to a donor organisation');
    }
    const restricted = categories.filter((category) => !DONOR_CATEGORIES.includes(category));
    if (restricted.length > 0) {
      throw new AuthorizationError(
        'Donor organisations can only view the distribution of resources they contributed. ' +
          'Alert, citizen and shelter statistics are restricted to DMC officials.',
      );
    }
    return { ownerId: user.organisationId };
  }
}
