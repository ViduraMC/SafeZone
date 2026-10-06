import type { GeoDirectory } from '@/core/geo/GeoDirectory';
import { DomainError } from '@/core/shared/errors';

export type TargetScope = 'DISTRICT' | 'RIVER_BASIN';

/**
 * Where an alert is aimed. Replaces HazardAlert.targetByDistrict() and
 * targetByRiverBasin() (Open/Closed fix): a new targeting mode such as a GPS
 * radius is added by implementing this interface, without touching HazardAlert.
 */
export interface TargetArea {
  readonly scope: TargetScope;
  readonly ids: readonly string[];
  resolveDistrictIds(geo: GeoDirectory): string[];
  describe(geo: GeoDirectory): string;
}

export class DistrictTarget implements TargetArea {
  readonly scope = 'DISTRICT' as const;
  readonly ids: readonly string[];

  constructor(districtIds: readonly string[]) {
    if (districtIds.length === 0) throw new DomainError('At least one district must be targeted');
    this.ids = [...new Set(districtIds)];
  }

  resolveDistrictIds(geo: GeoDirectory): string[] {
    return this.ids.map((id) => geo.getDistrict(id).id);
  }

  describe(geo: GeoDirectory): string {
    return this.ids.map((id) => geo.districtName(id)).join(', ');
  }
}

export class RiverBasinTarget implements TargetArea {
  readonly scope = 'RIVER_BASIN' as const;
  readonly ids: readonly string[];

  constructor(basinId: string) {
    this.ids = [basinId];
  }

  resolveDistrictIds(geo: GeoDirectory): string[] {
    return [...geo.getRiverBasin(this.ids[0]).districtIds];
  }

  describe(geo: GeoDirectory): string {
    return `${geo.getRiverBasin(this.ids[0]).name} basin`;
  }
}

/** Factory that turns the form's scope switch + selection into a TargetArea. */
export function createTargetArea(scope: TargetScope, ids: readonly string[]): TargetArea {
  if (scope === 'RIVER_BASIN') {
    if (ids.length !== 1) throw new DomainError('Select exactly one river basin');
    return new RiverBasinTarget(ids[0]);
  }
  return new DistrictTarget(ids);
}
