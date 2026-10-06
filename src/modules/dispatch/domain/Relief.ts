import { DomainError } from '@/core/shared/errors';

export enum ReliefCategory {
  FOOD = 'FOOD',
  WATER = 'WATER',
  MEDICINE = 'MEDICINE',
  HYGIENE = 'HYGIENE',
  SHELTER_KIT = 'SHELTER_KIT',
}

export class InsufficientStockError extends DomainError {
  constructor(
    readonly requested: number,
    readonly available: number,
  ) {
    super(`Requested ${requested} but only ${available} available`, 'INSUFFICIENT_STOCK');
  }
}

export interface ReliefStockProps {
  readonly id: string;
  readonly ownerId: string;
  readonly category: ReliefCategory;
  readonly itemName: string;
  readonly unit: string;
  readonly quantity: number;
}

/** Relief supply pledged by an owner organisation and held for distribution. */
export class ReliefStock {
  readonly id: string;
  readonly ownerId: string;
  readonly category: ReliefCategory;
  readonly itemName: string;
  readonly unit: string;
  private _available: number;

  constructor(props: ReliefStockProps) {
    if (!Number.isInteger(props.quantity) || props.quantity < 0) {
      throw new DomainError('Stock quantity must be a whole number of zero or more');
    }
    this.id = props.id;
    this.ownerId = props.ownerId;
    this.category = props.category;
    this.itemName = props.itemName;
    this.unit = props.unit;
    this._available = props.quantity;
  }

  get available(): number {
    return this._available;
  }

  /** UC04 E1: refuses to hand out more than is available. */
  withdraw(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new DomainError('Quantity must be a whole number greater than zero');
    }
    if (quantity > this._available) throw new InsufficientStockError(quantity, this._available);
    this._available -= quantity;
  }
}

/** Immutable record of supplies sent to a district or shelter (feeds UC05). */
export interface ReliefDistribution {
  readonly id: string;
  readonly stockId: string;
  readonly ownerId: string;
  readonly category: ReliefCategory;
  readonly itemName: string;
  readonly unit: string;
  readonly quantity: number;
  readonly districtId: string;
  readonly shelterId?: string;
  readonly eventId?: string;
  readonly distributedBy: string;
  readonly distributedAt: Date;
}
