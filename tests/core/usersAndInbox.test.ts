import { InboxService, type InboxMessage } from '@/core/notifications/Inbox';
import { OrganisationDirectory, OwnerType } from '@/core/organisations/ResourceOwner';
import { ManualClock } from '@/core/shared/Clock';
import { AuthorizationError, NotFoundError } from '@/core/shared/errors';
import { SequentialIdGenerator } from '@/core/shared/IdGenerator';
import { InMemoryRepository } from '@/core/shared/Repository';
import { hasAnyRole, hasRole, isAlertRecipient, requireRole, Role } from '@/core/users/UserAccount';
import { RepositoryUserDirectory } from '@/core/users/UserDirectory';
import { makeUser, T0 } from '../helpers/fixtures';

describe('UserAccount roles (composition instead of inheritance)', () => {
  const volunteer = makeUser({ roles: [Role.CITIZEN, Role.VOLUNTEER] });
  const officer = makeUser({ roles: [Role.DUTY_OFFICER] });

  it('lets one account hold several roles', () => {
    expect(hasRole(volunteer, Role.VOLUNTEER)).toBe(true);
    expect(hasAnyRole(volunteer, [Role.DMC_OFFICER, Role.CITIZEN])).toBe(true);
    expect(hasAnyRole(officer, [Role.CITIZEN, Role.VOLUNTEER])).toBe(false);
  });

  it('treats citizens and volunteers as alert recipients but not officers', () => {
    expect(isAlertRecipient(volunteer)).toBe(true);
    expect(isAlertRecipient(officer)).toBe(false);
  });

  it('requireRole throws AuthorizationError for missing roles', () => {
    expect(() => requireRole(officer, Role.DUTY_OFFICER)).not.toThrow();
    expect(() => requireRole(volunteer, Role.DUTY_OFFICER, Role.DMC_OFFICER)).toThrow(AuthorizationError);
  });
});

describe('RepositoryUserDirectory', () => {
  const colCitizen = makeUser({ homeDistrictId: 'COL' });
  const galVolunteer = makeUser({ homeDistrictId: 'GAL', roles: [Role.CITIZEN, Role.VOLUNTEER] });
  const colOfficer = makeUser({ homeDistrictId: 'COL', roles: [Role.DISTRICT_OFFICER] });
  const directory = new RepositoryUserDirectory(new InMemoryRepository([colCitizen, galVolunteer, colOfficer]));

  it('finds alert recipients only in the requested districts', () => {
    expect(directory.findRecipientsInDistricts(['COL']).map((u) => u.id)).toEqual([colCitizen.id]);
    expect(directory.findRecipientsInDistricts(['COL', 'GAL'])).toHaveLength(2);
    expect(directory.findRecipientsInDistricts([])).toEqual([]);
  });

  it('finds users by role and by id', () => {
    expect(directory.findByRole(Role.DISTRICT_OFFICER)).toEqual([colOfficer]);
    expect(directory.get(galVolunteer.id)).toBe(galVolunteer);
    expect(() => directory.get('nobody')).toThrow(NotFoundError);
  });
});

describe('InboxService', () => {
  it('delivers messages newest first, counts unread and marks them read', () => {
    const clock = new ManualClock(T0);
    const inbox = new InboxService(new InMemoryRepository<InboxMessage>(), new SequentialIdGenerator(), clock);
    inbox.deliver({ userId: 'u1', kind: 'ALERT', title: 'first', body: '' });
    clock.advanceMinutes(5);
    const second = inbox.deliver({ userId: 'u1', kind: 'SYSTEM', title: 'second', body: '' });
    inbox.deliver({ userId: 'u2', kind: 'SYSTEM', title: 'other user', body: '' });

    expect(inbox.forUser('u1').map((m) => m.title)).toEqual(['second', 'first']);
    expect(inbox.unreadCount('u1')).toBe(2);
    inbox.markRead(second.id);
    inbox.markRead('unknown-id');
    expect(inbox.unreadCount('u1')).toBe(1);
  });

  it('keeps the newest first when messages are delivered in the same instant', () => {
    const inbox = new InboxService(new InMemoryRepository<InboxMessage>(), new SequentialIdGenerator(), new ManualClock(T0));
    inbox.deliver({ userId: 'u1', kind: 'REPORT_UPDATE', title: 'submitted', body: '' });
    inbox.deliver({ userId: 'u1', kind: 'REPORT_UPDATE', title: 'updated', body: '' });
    expect(inbox.forUser('u1').map((m) => m.title)).toEqual(['updated', 'submitted']);
  });
});

describe('OrganisationDirectory', () => {
  const directory = new OrganisationDirectory(
    new InMemoryRepository([
      { id: 'B', name: 'Sri Lanka Navy', type: OwnerType.ARMED_FORCES },
      { id: 'A', name: 'Red Cross', type: OwnerType.NGO },
    ]),
  );

  it('lists owners by name and looks them up by id', () => {
    expect(directory.list().map((o) => o.id)).toEqual(['A', 'B']);
    expect(directory.get('B').type).toBe(OwnerType.ARMED_FORCES);
    expect(() => directory.get('Z')).toThrow(NotFoundError);
  });
});
