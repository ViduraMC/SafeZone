import { AuthorizationError, DomainError, NotFoundError } from '@/core/shared/errors';
import { Role } from '@/core/users/UserAccount';
import { InsufficientStockError } from '@/modules/dispatch/domain/Relief';
import { RescueTeamStatus } from '@/modules/dispatch/domain/RescueTeam';
import { OwnerType } from '@/core/organisations/ResourceOwner';
import { makeUser } from '../helpers/fixtures';
import { coordinationHarness } from '../helpers/coordinationHarness';

describe('RescueDispatchService', () => {
  it('separates teams in the district from those that could be borrowed (A1)', () => {
    const h = coordinationHarness();
    expect(h.rescue.availableInDistrict('COL').map((t) => t.id)).toEqual(['T-COL', 'T-COL-2']);
    expect(h.rescue.availableElsewhere('COL').map((t) => t.id)).toEqual(['T-KAL']);
    expect(h.rescue.allTeams()).toHaveLength(3);
  });

  it('dispatches a team, marks cross-organisation assignments and notifies its members', () => {
    const h = coordinationHarness();
    const local = h.rescue.dispatch('T-COL', { districtId: 'COL', locationDescription: ' Hanwella bridge ', eventId: 'EVT-NOW' }, h.officer);
    const borrowed = h.rescue.dispatch('T-KAL', { districtId: 'COL', locationDescription: 'Kolonnawa' }, h.officer);

    expect(local.status).toBe(RescueTeamStatus.DISPATCHED);
    expect(local.assignment).toMatchObject({ locationDescription: 'Hanwella bridge', crossOrganisation: false, eventId: 'EVT-NOW' });
    expect(borrowed.assignment?.crossOrganisation).toBe(true);
    expect(h.rescue.deployedTo('COL')).toHaveLength(2);
    expect(h.inbox.forUser(h.navyMember.id)[0]).toMatchObject({ kind: 'TASK', title: 'New rescue assignment' });
  });

  it('lets team members update only their own team (A4, E4)', () => {
    const h = coordinationHarness();
    h.rescue.dispatch('T-COL', { districtId: 'COL', locationDescription: 'Bridge' }, h.officer);
    h.rescue.dispatch('T-COL-2', { districtId: 'COL', locationDescription: 'Market' }, h.officer);

    expect(h.rescue.updateStatus('T-COL', RescueTeamStatus.EN_ROUTE, h.navyMember).status).toBe(RescueTeamStatus.EN_ROUTE);
    expect(() => h.rescue.updateStatus('T-COL-2', RescueTeamStatus.EN_ROUTE, h.navyMember)).toThrow('own team');
    expect(h.rescue.updateStatus('T-COL-2', RescueTeamStatus.EN_ROUTE, h.officer).status).toBe(RescueTeamStatus.EN_ROUTE);
    expect(() => h.rescue.updateStatus('T-COL', RescueTeamStatus.EN_ROUTE, makeUser())).toThrow(AuthorizationError);
  });

  it('records a mission outcome from the team or the officer (main flow step 8)', () => {
    const h = coordinationHarness();
    h.rescue.dispatch('T-COL', { districtId: 'COL', locationDescription: 'Bridge' }, h.officer);
    h.rescue.updateStatus('T-COL', RescueTeamStatus.EN_ROUTE, h.navyMember);
    h.rescue.updateStatus('T-COL', RescueTeamStatus.ON_SCENE, h.navyMember);

    expect(() => h.rescue.completeMission('T-COL', 4, '', makeUser())).toThrow(AuthorizationError);
    const record = h.rescue.completeMission('T-COL', 4, 'Four people evacuated', h.navyMember);

    expect(record.peopleRescued).toBe(4);
    expect(h.rescue.getTeam('T-COL').status).toBe(RescueTeamStatus.RETURNING);
    expect(h.published.at(-1)?.payload.description).toBe('Team T-COL completed its mission (4 rescued)');
  });

  it('recalls a dispatched team before it leaves (A3) but refuses skipped steps (E3)', () => {
    const h = coordinationHarness();
    h.rescue.dispatch('T-COL', { districtId: 'COL', locationDescription: 'Bridge' }, h.officer);
    expect(() => h.rescue.updateStatus('T-COL', RescueTeamStatus.ON_SCENE, h.officer)).toThrow('Cannot change team status');
    expect(h.rescue.updateStatus('T-COL', RescueTeamStatus.STANDBY, h.officer).isAvailable).toBe(true);
  });

  it('rejects unknown teams and districts', () => {
    const h = coordinationHarness();
    expect(() => h.rescue.getTeam('T-404')).toThrow(NotFoundError);
    expect(() => h.rescue.dispatch('T-COL', { districtId: 'XX', locationDescription: 'x' }, h.officer)).toThrow(NotFoundError);
  });
});

describe('ReliefDistributionService', () => {
  it('pools available stock across owners and filters by owner type (A2)', () => {
    const h = coordinationHarness();
    expect(h.relief.availableStock().map((v) => v.stock.id)).toEqual(['STK-RATIONS', 'STK-MEDS']);
    expect(h.relief.availableStock([OwnerType.NGO]).map((v) => v.owner.name)).toEqual(['Red Cross']);
    expect(h.organisations.list().map((o) => o.name)[0]).toBe('Colombo District Secretariat');
  });

  it('records a distribution and reduces stock', () => {
    const h = coordinationHarness();
    const d = h.relief.distribute({ stockId: 'STK-RATIONS', quantity: 120, districtId: 'COL', shelterId: 'SHL-A', eventId: 'EVT-NOW' }, h.officer);

    expect(d).toMatchObject({ ownerId: 'OWN-GOV', quantity: 120, districtId: 'COL', shelterId: 'SHL-A', distributedBy: h.officer.id });
    expect(h.stocks.findById('STK-RATIONS')?.available).toBe(380);
    expect(h.relief.distributionsTo('COL')).toEqual([d]);
  });

  it('refuses to distribute more than is available and records nothing (E1)', () => {
    const h = coordinationHarness();
    expect(() => h.relief.distribute({ stockId: 'STK-MEDS', quantity: 41, districtId: 'COL' }, h.officer)).toThrow(InsufficientStockError);
    expect(h.distributions.count()).toBe(0);
    expect(h.stocks.findById('STK-MEDS')?.available).toBe(40);
  });

  it('validates stock, shelter and owner references', () => {
    const h = coordinationHarness();
    expect(() => h.relief.distribute({ stockId: 'NOPE', quantity: 1, districtId: 'COL' }, h.officer)).toThrow(NotFoundError);
    expect(() => h.relief.distribute({ stockId: 'STK-MEDS', quantity: 1, districtId: 'COL', shelterId: 'NOPE' }, h.officer)).toThrow(NotFoundError);
    expect(() => h.relief.distribute({ stockId: 'STK-MEDS', quantity: 1, districtId: 'GAL', shelterId: 'SHL-A' }, h.officer)).toThrow(DomainError);
    expect(() => h.organisations.get('NOPE')).toThrow(NotFoundError);
    expect(() => h.relief.distribute({ stockId: 'STK-MEDS', quantity: 1, districtId: 'COL' }, makeUser({ roles: [Role.DONOR_REPRESENTATIVE] }))).toThrow(AuthorizationError);
  });
});

