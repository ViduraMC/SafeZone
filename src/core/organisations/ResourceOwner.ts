import { NotFoundError } from '../shared/errors';
import type { Repository } from '../shared/Repository';

/**
 * Organisation that owns shelters, rescue teams or relief stock. The original
 * design merged NGO and Armed Forces into one subclass and had no Government
 * class; the owner type is now a value, so all four case-study owners exist
 * and none needs special behaviour (no subclass explosion).
 */
export enum OwnerType {
  GOVERNMENT = 'GOVERNMENT',
  ARMED_FORCES = 'ARMED_FORCES',
  NGO = 'NGO',
  PRIVATE_DONOR = 'PRIVATE_DONOR',
}

export const OWNER_TYPE_LABELS: Readonly<Record<OwnerType, string>> = {
  [OwnerType.GOVERNMENT]: 'Government',
  [OwnerType.ARMED_FORCES]: 'Armed Forces',
  [OwnerType.NGO]: 'NGO',
  [OwnerType.PRIVATE_DONOR]: 'Private Donor',
};

export interface ResourceOwner {
  readonly id: string;
  readonly name: string;
  readonly type: OwnerType;
}

/** Read-only lookup of owner organisations, shared by shelter and dispatch coordination. */
export class OrganisationDirectory {
  constructor(private readonly owners: Repository<ResourceOwner>) {}

  list(): ResourceOwner[] {
    return this.owners.findAll().sort((a, b) => a.name.localeCompare(b.name));
  }

  get(ownerId: string): ResourceOwner {
    const owner = this.owners.findById(ownerId);
    if (!owner) throw new NotFoundError('Resource owner', ownerId);
    return owner;
  }
}
