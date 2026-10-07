import { AuthorizationError } from '../shared/errors';

/**
 * Roles are composed onto a single account instead of being modelled as a deep
 * inheritance tree (Liskov fix: a citizen can become a volunteer at runtime
 * without changing class).
 */
export enum Role {
  CITIZEN = 'CITIZEN',
  VOLUNTEER = 'VOLUNTEER',
  DUTY_OFFICER = 'DUTY_OFFICER',
  DMC_OFFICER = 'DMC_OFFICER',
  DISTRICT_OFFICER = 'DISTRICT_OFFICER',
  RESCUE_TEAM_MEMBER = 'RESCUE_TEAM_MEMBER',
  DMC_OFFICIAL = 'DMC_OFFICIAL',
  DONOR_REPRESENTATIVE = 'DONOR_REPRESENTATIVE',
}

export interface VolunteerProfile {
  readonly volunteerId: string;
  readonly trainingLevel: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
}

export interface ContactPreferences {
  /** Citizens without a smartphone can only be reached by SMS. */
  readonly hasSmartphone: boolean;
  readonly smsOptIn: boolean;
}

export interface UserAccount {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly nic?: string;
  readonly homeDistrictId: string;
  readonly roles: readonly Role[];
  readonly contact: ContactPreferences;
  readonly volunteer?: VolunteerProfile;
  /** Rescue team the member belongs to (rescue team members only). */
  readonly rescueTeamId?: string;
  /** Resource owner organisation represented (donor representatives / district officers). */
  readonly organisationId?: string;
}

export function hasRole(user: UserAccount, role: Role): boolean {
  return user.roles.includes(role);
}

export function hasAnyRole(user: UserAccount, roles: readonly Role[]): boolean {
  return roles.some((role) => hasRole(user, role));
}

/** Guard used by application services before executing role-restricted actions. */
export function requireRole(user: UserAccount, ...roles: Role[]): void {
  if (!hasAnyRole(user, roles)) {
    throw new AuthorizationError(`${user.name} is not permitted to perform this action`);
  }
}

export function isAlertRecipient(user: UserAccount): boolean {
  return hasAnyRole(user, [Role.CITIZEN, Role.VOLUNTEER]);
}
