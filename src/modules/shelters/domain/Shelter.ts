import type { Coordinates } from '@/core/geo/District';
import { DomainError } from '@/core/shared/errors';

export enum ShelterStatus {
  AVAILABLE = 'AVAILABLE',
  NEAR_CAPACITY = 'NEAR_CAPACITY',
  FULL = 'FULL',
  /** Added for UC03 E2 "Shelter Becomes Unavailable" (flooded, damaged, closed). */
  UNAVAILABLE = 'UNAVAILABLE',
}

/** Occupancy ratio from which a shelter is reported as near capacity (UC03 A1). */
export const NEAR_CAPACITY_RATIO = 0.8;

export class ShelterCapacityError extends DomainError {
  constructor(readonly remaining: number) {
    super(`Only ${remaining} places remain in this shelter`, 'SHELTER_CAPACITY_EXCEEDED');
  }
}

export interface ShelterProps {
  readonly id: string;
  readonly name: string;
  readonly districtId: string;
  readonly address: string;
  readonly location: Coordinates;
  readonly capacity: number;
  readonly ownerId: string;
  readonly contactPhone: string;
  readonly facilities: readonly string[];
  readonly occupancy?: number;
}

export class Shelter {
  readonly id: string;
  readonly name: string;
  readonly districtId: string;
  readonly address: string;
  readonly location: Coordinates;
  readonly capacity: number;
  readonly ownerId: string;
  readonly contactPhone: string;
  readonly facilities: readonly string[];

  private _occupancy: number;
  private _unavailableReason?: string;

  constructor(props: ShelterProps) {
    requirePositiveInteger(props.capacity, 'Capacity');
    const occupancy = props.occupancy ?? 0;
    if (occupancy < 0 || occupancy > props.capacity) {
      throw new DomainError('Occupancy must be between 0 and capacity');
    }
    this.id = props.id;
    this.name = props.name;
    this.districtId = props.districtId;
    this.address = props.address;
    this.location = props.location;
    this.capacity = props.capacity;
    this.ownerId = props.ownerId;
    this.contactPhone = props.contactPhone;
    this.facilities = [...props.facilities];
    this._occupancy = occupancy;
  }

  get occupancy(): number {
    return this._occupancy;
  }

  get remainingCapacity(): number {
    return this.capacity - this._occupancy;
  }

  get occupancyRatio(): number {
    return this._occupancy / this.capacity;
  }

  get isAvailable(): boolean {
    return this._unavailableReason === undefined;
  }

  get unavailableReason(): string | undefined {
    return this._unavailableReason;
  }

  get status(): ShelterStatus {
    if (!this.isAvailable) return ShelterStatus.UNAVAILABLE;
    if (this.remainingCapacity === 0) return ShelterStatus.FULL;
    if (this.occupancyRatio >= NEAR_CAPACITY_RATIO) return ShelterStatus.NEAR_CAPACITY;
    return ShelterStatus.AVAILABLE;
  }

  /** Allocates places to evacuees (UC03 step 7). */
  admit(people: number): void {
    requirePositiveInteger(people, 'Number of people');
    if (!this.isAvailable) throw new DomainError(`${this.name} is unavailable: ${this._unavailableReason}`);
    if (people > this.remainingCapacity) throw new ShelterCapacityError(this.remainingCapacity);
    this._occupancy += people;
  }

  release(people: number): void {
    requirePositiveInteger(people, 'Number of people');
    if (people > this._occupancy) throw new DomainError('Cannot release more people than are sheltered');
    this._occupancy -= people;
  }

  markUnavailable(reason: string): void {
    if (reason.trim().length === 0) throw new DomainError('A reason is required');
    this._unavailableReason = reason.trim();
  }

  reopen(): void {
    this._unavailableReason = undefined;
  }
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DomainError(`${label} must be a whole number greater than zero`);
  }
}
