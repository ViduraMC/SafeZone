import { NotFoundError } from '../shared/errors';
import { SeverityLevel } from './SeverityLevel';

export type OnsetSpeed = 'FAST' | 'SLOW';

/**
 * Hazard type as configurable data instead of a fixed enum (Open/Closed fix).
 *
 * The original design hard-coded FLOOD | LANDSLIDE | CYCLONE | DROUGHT. The case
 * study stresses hazards "of varying speed and scale", so each type now carries
 * its own onset speed, default severity and maximum warning validity. A new
 * hazard is added by registering configuration, not by editing switch statements.
 */
export interface HazardType {
  readonly code: string;
  readonly name: string;
  readonly onset: OnsetSpeed;
  readonly defaultSeverity: SeverityLevel;
  /** Longest validity window (hours) a single warning of this type may have. */
  readonly maxValidityHours: number;
}

export class HazardTypeRegistry {
  private readonly types = new Map<string, HazardType>();

  constructor(initial: readonly HazardType[] = []) {
    initial.forEach((type) => this.register(type));
  }

  register(type: HazardType): void {
    this.types.set(type.code, type);
  }

  get(code: string): HazardType {
    const type = this.types.get(code);
    if (!type) throw new NotFoundError('Hazard type', code);
    return type;
  }

  has(code: string): boolean {
    return this.types.has(code);
  }

  list(): readonly HazardType[] {
    return [...this.types.values()];
  }
}

export const DEFAULT_HAZARD_TYPES: readonly HazardType[] = [
  { code: 'FLOOD', name: 'Flood', onset: 'FAST', defaultSeverity: SeverityLevel.WARNING, maxValidityHours: 72 },
  { code: 'FLASH_FLOOD', name: 'Flash Flood', onset: 'FAST', defaultSeverity: SeverityLevel.EMERGENCY, maxValidityHours: 24 },
  { code: 'LANDSLIDE', name: 'Landslide', onset: 'FAST', defaultSeverity: SeverityLevel.WARNING, maxValidityHours: 72 },
  { code: 'CYCLONE', name: 'Cyclone', onset: 'FAST', defaultSeverity: SeverityLevel.WARNING, maxValidityHours: 96 },
  { code: 'TSUNAMI', name: 'Tsunami', onset: 'FAST', defaultSeverity: SeverityLevel.EMERGENCY, maxValidityHours: 12 },
  { code: 'DROUGHT', name: 'Drought', onset: 'SLOW', defaultSeverity: SeverityLevel.ADVISORY, maxValidityHours: 24 * 30 },
];
