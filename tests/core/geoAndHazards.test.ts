import type { DisasterEvent } from '@/core/events/DisasterEvent';
import { isEventOngoing } from '@/core/events/DisasterEvent';
import { distanceKm, isWithinSriLanka, StaticGeoDirectory } from '@/core/geo/GeoDirectory';
import { HazardTypeRegistry } from '@/core/hazard/HazardType';
import { allSeverityLevels, isHigherSeverity, isSeverityLevel, SeverityLevel, severityRank } from '@/core/hazard/SeverityLevel';
import { NotFoundError } from '@/core/shared/errors';
import { geo, hazardTypes, T0 } from '../helpers/fixtures';

describe('StaticGeoDirectory', () => {
  const directory = geo();

  it('lists all 25 districts alphabetically and resolves names', () => {
    const districts = directory.listDistricts();
    expect(districts).toHaveLength(25);
    expect(districts[0].name).toBe('Ampara');
    expect(directory.districtName('COL')).toBe('Colombo');
    expect(directory.districtName('NOPE')).toBe('NOPE');
  });

  it('looks up river basins and their districts', () => {
    expect(directory.getRiverBasin('KELANI').districtIds).toContain('COL');
    expect(directory.listRiverBasins().map((b) => b.id)).toContain('MAHAWELI');
  });

  it('throws NotFoundError for unknown districts and basins', () => {
    expect(() => directory.getDistrict('XX')).toThrow(NotFoundError);
    expect(() => directory.getRiverBasin('XX')).toThrow(NotFoundError);
    expect(directory.findDistrict('XX')).toBeUndefined();
  });

  it('finds the nearest district to a coordinate', () => {
    expect(directory.nearestDistrict({ latitude: 6.93, longitude: 79.98 }).id).toBe('COL');
    expect(directory.nearestDistrict({ latitude: 9.66, longitude: 80.02 }).id).toBe('JAF');
  });

  it('fails nearestDistrict when there are no districts', () => {
    expect(() => new StaticGeoDirectory([], []).nearestDistrict({ latitude: 7, longitude: 80 })).toThrow(NotFoundError);
  });
});

describe('geographic helpers', () => {
  it('detects points outside Sri Lanka', () => {
    expect(isWithinSriLanka({ latitude: 6.9, longitude: 79.86 })).toBe(true);
    expect(isWithinSriLanka({ latitude: 13.08, longitude: 80.27 })).toBe(false);
  });

  it('computes great-circle distance in km', () => {
    const colombo = { latitude: 6.9271, longitude: 79.8612 };
    const kandy = { latitude: 7.2906, longitude: 80.6337 };
    expect(distanceKm(colombo, kandy)).toBeGreaterThan(90);
    expect(distanceKm(colombo, kandy)).toBeLessThan(100);
    expect(distanceKm(colombo, colombo)).toBe(0);
  });
});

describe('SeverityLevel ordering', () => {
  it('ranks advisory < warning < emergency', () => {
    expect(allSeverityLevels()).toEqual([SeverityLevel.ADVISORY, SeverityLevel.WARNING, SeverityLevel.EMERGENCY]);
    expect(severityRank(SeverityLevel.EMERGENCY)).toBe(2);
    expect(isHigherSeverity(SeverityLevel.EMERGENCY, SeverityLevel.WARNING)).toBe(true);
    expect(isHigherSeverity(SeverityLevel.WARNING, SeverityLevel.WARNING)).toBe(false);
  });

  it('recognises valid severity strings only', () => {
    expect(isSeverityLevel('WARNING')).toBe(true);
    expect(isSeverityLevel('')).toBe(false);
    expect(isSeverityLevel('CRITICAL')).toBe(false);
  });
});

describe('HazardTypeRegistry', () => {
  it('contains fast and slow onset hazards with their own validity limits', () => {
    const registry = hazardTypes();
    expect(registry.get('DROUGHT')).toMatchObject({ onset: 'SLOW', maxValidityHours: 720 });
    expect(registry.get('FLASH_FLOOD').onset).toBe('FAST');
  });

  it('accepts new hazard types without code changes (Open/Closed)', () => {
    const registry = new HazardTypeRegistry();
    expect(registry.has('HEATWAVE')).toBe(false);
    registry.register({ code: 'HEATWAVE', name: 'Heatwave', onset: 'SLOW', defaultSeverity: SeverityLevel.ADVISORY, maxValidityHours: 240 });
    expect(registry.list().map((t) => t.code)).toEqual(['HEATWAVE']);
    expect(() => registry.get('UNKNOWN')).toThrow(NotFoundError);
  });
});

describe('DisasterEvent', () => {
  const event: DisasterEvent = { id: 'E', name: 'Floods', hazardTypeCode: 'FLOOD', districtIds: ['COL'], startedAt: T0 };

  it('is ongoing from its start until it ends', () => {
    expect(isEventOngoing(event, new Date(T0.getTime() - 1))).toBe(false);
    expect(isEventOngoing(event, new Date(T0.getTime() + 1e9))).toBe(true);
    expect(isEventOngoing({ ...event, endedAt: new Date(T0.getTime() + 1000) }, new Date(T0.getTime() + 2000))).toBe(false);
  });
});
