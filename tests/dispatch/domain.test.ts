import { DomainError } from '@/core/shared/errors';
import { InsufficientStockError, ReliefCategory, ReliefStock } from '@/modules/dispatch/domain/Relief';
import { nextStatuses, RescueTeamStatus } from '@/modules/dispatch/domain/RescueTeam';
import { T0 } from '../helpers/fixtures';
import { team } from '../helpers/coordinationHarness';

describe('RescueTeam', () => {
  const assignment = { districtId: 'COL', locationDescription: 'Hanwella bridge', assignedBy: 'DO', assignedAt: T0, crossOrganisation: false };

  it('follows the dispatch life cycle and records the mission outcome', () => {
    const t = team('T1', 'COL');
    const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
    expect(t.isAvailable).toBe(true);
    t.dispatch(assignment);
    t.updateStatus(RescueTeamStatus.EN_ROUTE, at(10));
    t.updateStatus(RescueTeamStatus.ON_SCENE, at(45));
    const record = t.completeMission(7, '  Family of seven moved to the hall ', at(120));
    t.updateStatus(RescueTeamStatus.STANDBY, at(150));

    expect(t.statusLog.map((e) => e.status)).toEqual(['DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'RETURNING', 'STANDBY']);
    expect(record).toEqual({ assignment, onSceneAt: at(45), completedAt: at(120), peopleRescued: 7, notes: 'Family of seven moved to the hall' });
    expect(t.missions).toEqual([record]);
    expect(t.assignment).toBeUndefined();
  });

  it('only finishes a mission from the scene, with a valid number of people rescued', () => {
    const t = team('T1', 'COL');
    t.dispatch(assignment);
    expect(() => t.completeMission(3, '', T0)).toThrow('Cannot change team status from DISPATCHED to RETURNING');
    t.updateStatus(RescueTeamStatus.EN_ROUTE, T0);
    t.updateStatus(RescueTeamStatus.ON_SCENE, T0);
    expect(() => t.updateStatus(RescueTeamStatus.RETURNING, T0)).toThrow('Record the mission outcome');
    expect(() => t.completeMission(-1, '', T0)).toThrow('whole number of zero or more');
    expect(() => t.completeMission(1.5, '', T0)).toThrow(DomainError);
    expect(t.completeMission(0, '', T0).peopleRescued).toBe(0);
  });

  it('can be recalled before leaving', () => {
    const t = team('T1', 'COL');
    t.dispatch(assignment);
    t.updateStatus(RescueTeamStatus.STANDBY, T0);
    expect(t.isAvailable).toBe(true);
  });

  it('rejects skipped steps, double dispatch and empty locations', () => {
    const t = team('T1', 'COL');
    expect(() => t.updateStatus(RescueTeamStatus.ON_SCENE, T0)).toThrow('Cannot change team status from STANDBY to ON_SCENE');
    expect(() => t.dispatch({ ...assignment, locationDescription: ' ' })).toThrow('Describe where the team should go');
    t.dispatch(assignment);
    expect(() => t.dispatch(assignment)).toThrow(DomainError);
  });

  it('exposes the allowed next statuses', () => {
    expect(nextStatuses(RescueTeamStatus.DISPATCHED)).toEqual([RescueTeamStatus.EN_ROUTE, RescueTeamStatus.STANDBY]);
  });
});

describe('ReliefStock', () => {
  const stock = () => new ReliefStock({ id: 'S', ownerId: 'O', category: ReliefCategory.FOOD, itemName: 'Rations', unit: 'packs', quantity: 10 });

  it('withdraws available quantity', () => {
    const s = stock();
    s.withdraw(10);
    expect(s.available).toBe(0);
  });

  it('reports a shortage with requested and available amounts (E3)', () => {
    const s = stock();
    expect(() => s.withdraw(11)).toThrow(InsufficientStockError);
    try {
      s.withdraw(11);
    } catch (error) {
      expect(error).toMatchObject({ requested: 11, available: 10 });
    }
  });

  it('rejects invalid quantities', () => {
    expect(() => stock().withdraw(0)).toThrow(DomainError);
    expect(() => new ReliefStock({ id: 'S', ownerId: 'O', category: ReliefCategory.FOOD, itemName: 'x', unit: 'u', quantity: -1 })).toThrow(DomainError);
  });
});
