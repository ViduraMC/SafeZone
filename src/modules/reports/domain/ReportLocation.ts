import type { Coordinates } from '@/core/geo/District';
import { isWithinSriLanka, type GeoDirectory } from '@/core/geo/GeoDirectory';
import { DomainError } from '@/core/shared/errors';

export type LocationSource = 'GPS' | 'MANUAL';

/** Where a hazard was observed. Linked to a District entity rather than a free-text string. */
export interface ReportLocation extends Coordinates {
  readonly source: LocationSource;
  readonly districtId: string;
  readonly label: string;
}

export function locationFromGps(point: Coordinates, geo: GeoDirectory, label?: string): ReportLocation {
  if (!isWithinSriLanka(point)) {
    throw new DomainError('The detected location is outside Sri Lanka');
  }
  const district = geo.nearestDistrict(point);
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    source: 'GPS',
    districtId: district.id,
    label: label?.trim() || `GPS location, ${district.name} District`,
  };
}

/** UC02 E1: reporter picks the district manually and describes the place. */
export function locationFromManualEntry(districtId: string, placeDescription: string, geo: GeoDirectory): ReportLocation {
  const district = geo.getDistrict(districtId);
  if (placeDescription.trim().length < 3) {
    throw new DomainError('Describe the place (e.g. nearest town or landmark)');
  }
  return {
    ...district.centroid,
    source: 'MANUAL',
    districtId: district.id,
    label: `${placeDescription.trim()}, ${district.name} District`,
  };
}
