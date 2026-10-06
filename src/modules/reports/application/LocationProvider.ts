import type { Coordinates } from '@/core/geo/District';
import { DomainError } from '@/core/shared/errors';

export class LocationUnavailableError extends DomainError {
  constructor(message = 'Unable to get your GPS location. Enable location services or enter it manually.') {
    super(message, 'LOCATION_UNAVAILABLE');
  }
}

/** Device GPS port. Keeps hardware access out of the Evidence entity (SRP fix). */
export interface LocationProvider {
  currentPosition(): Promise<Coordinates>;
}

/** Simulated GPS (the assignment allows mocking device hardware). */
export class SimulatedLocationProvider implements LocationProvider {
  constructor(
    private position: Coordinates,
    private available = true,
  ) {}

  setAvailable(available: boolean): void {
    this.available = available;
  }

  isAvailable(): boolean {
    return this.available;
  }

  moveTo(position: Coordinates): void {
    this.position = position;
  }

  async currentPosition(): Promise<Coordinates> {
    if (!this.available) throw new LocationUnavailableError();
    return this.position;
  }
}
