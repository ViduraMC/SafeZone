import { NEAR_CAPACITY_RATIO, ShelterCapacityError, ShelterStatus } from '@/modules/shelters/domain/Shelter';
import { shelter } from '../helpers/coordinationHarness';

describe('Shelter', () => {
  it('derives its status from occupancy (80% threshold) and availability', () => {
    const s = shelter({ capacity: 100 });
    expect(s.status).toBe(ShelterStatus.AVAILABLE);
    s.admit(79);
    expect(s.status).toBe(ShelterStatus.AVAILABLE);
    s.admit(1);
    expect(s.occupancyRatio).toBe(NEAR_CAPACITY_RATIO);
    expect(s.status).toBe(ShelterStatus.NEAR_CAPACITY);
    s.admit(20);
    expect(s.status).toBe(ShelterStatus.FULL);
    expect(s.remainingCapacity).toBe(0);
  });

  it('refuses more people than remaining capacity and reports what is left (A1)', () => {
    const s = shelter({ capacity: 50, occupancy: 45 });
    expect(() => s.admit(6)).toThrow(ShelterCapacityError);
    try {
      s.admit(6);
    } catch (error) {
      expect((error as ShelterCapacityError).remaining).toBe(5);
    }
    expect(s.occupancy).toBe(45);
  });

  it.each([0, -3, 2.5])('rejects admitting %s people', (people) => {
    expect(() => shelter().admit(people)).toThrow('whole number greater than zero');
  });

  it('releases people but never below zero', () => {
    const s = shelter({ occupancy: 10 });
    s.release(4);
    expect(s.occupancy).toBe(6);
    expect(() => s.release(7)).toThrow('Cannot release more people than are sheltered');
  });

  it('can be marked unavailable with a reason and reopened (E2)', () => {
    const s = shelter();
    expect(() => s.markUnavailable(' ')).toThrow('A reason is required');
    s.markUnavailable(' Flooded ');
    expect(s.status).toBe(ShelterStatus.UNAVAILABLE);
    expect(s.unavailableReason).toBe('Flooded');
    expect(() => s.admit(1)).toThrow('is unavailable: Flooded');
    s.reopen();
    expect(s.isAvailable).toBe(true);
  });

  it('validates capacity and initial occupancy', () => {
    expect(() => shelter({ capacity: 0 })).toThrow('Capacity must be a whole number');
    expect(() => shelter({ capacity: 10, occupancy: 11 })).toThrow('Occupancy must be between 0 and capacity');
  });
});

