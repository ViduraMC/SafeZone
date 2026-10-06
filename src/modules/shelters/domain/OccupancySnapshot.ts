/** Point-in-time shelter occupancy, recorded on every change (feeds UC05 "occupancy over time"). */
export interface OccupancySnapshot {
  readonly id: string;
  readonly shelterId: string;
  readonly districtId: string;
  readonly occupancy: number;
  readonly capacity: number;
  readonly at: Date;
}
