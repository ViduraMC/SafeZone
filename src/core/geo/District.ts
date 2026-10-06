export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

/** Administrative district (one of Sri Lanka's 25). Replaces the free-text district string on Citizen. */
export interface District {
  readonly id: string;
  readonly name: string;
  readonly province: string;
  readonly centroid: Coordinates;
}

/** A river basin covers one or more districts and is a valid alert target. */
export interface RiverBasin {
  readonly id: string;
  readonly name: string;
  readonly districtIds: readonly string[];
}
