import { NotFoundError } from '../shared/errors';
import type { Coordinates, District, RiverBasin } from './District';

/** Read-only lookup of the administrative geography used for targeting and reporting. */
export interface GeoDirectory {
  listDistricts(): readonly District[];
  listRiverBasins(): readonly RiverBasin[];
  getDistrict(id: string): District;
  getRiverBasin(id: string): RiverBasin;
  findDistrict(id: string): District | undefined;
  districtName(id: string): string;
  /** Finds the district whose centroid is closest to the given point. */
  nearestDistrict(point: Coordinates): District;
}

export class StaticGeoDirectory implements GeoDirectory {
  private readonly districts: Map<string, District>;
  private readonly basins: Map<string, RiverBasin>;

  constructor(districts: readonly District[], basins: readonly RiverBasin[]) {
    this.districts = new Map(districts.map((d) => [d.id, d]));
    this.basins = new Map(basins.map((b) => [b.id, b]));
  }

  listDistricts(): readonly District[] {
    return [...this.districts.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  listRiverBasins(): readonly RiverBasin[] {
    return [...this.basins.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  getDistrict(id: string): District {
    const district = this.districts.get(id);
    if (!district) throw new NotFoundError('District', id);
    return district;
  }

  findDistrict(id: string): District | undefined {
    return this.districts.get(id);
  }

  getRiverBasin(id: string): RiverBasin {
    const basin = this.basins.get(id);
    if (!basin) throw new NotFoundError('River basin', id);
    return basin;
  }

  districtName(id: string): string {
    return this.districts.get(id)?.name ?? id;
  }

  nearestDistrict(point: Coordinates): District {
    let nearest: District | undefined;
    let best = Number.POSITIVE_INFINITY;
    for (const district of this.districts.values()) {
      const distance = squaredDistance(point, district.centroid);
      if (distance < best) {
        best = distance;
        nearest = district;
      }
    }
    if (!nearest) throw new NotFoundError('District', 'nearest');
    return nearest;
  }
}

function squaredDistance(a: Coordinates, b: Coordinates): number {
  const dLat = a.latitude - b.latitude;
  const dLon = a.longitude - b.longitude;
  return dLat * dLat + dLon * dLon;
}

/** Approximate bounding box of Sri Lanka, used to reject impossible coordinates. */
export const SRI_LANKA_BOUNDS = { minLat: 5.85, maxLat: 9.9, minLon: 79.5, maxLon: 81.95 } as const;

export function isWithinSriLanka(point: Coordinates): boolean {
  return (
    point.latitude >= SRI_LANKA_BOUNDS.minLat &&
    point.latitude <= SRI_LANKA_BOUNDS.maxLat &&
    point.longitude >= SRI_LANKA_BOUNDS.minLon &&
    point.longitude <= SRI_LANKA_BOUNDS.maxLon
  );
}

/** Great-circle distance in kilometres (used for "nearest shelter"). */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
