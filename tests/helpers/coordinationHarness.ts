import { InMemoryRepository } from '@/core/shared/Repository';
import { Role } from '@/core/users/UserAccount';
import { FieldUpdateRecorder } from '@/core/sync/FieldUpdateRecorder';
import { ShelterCoordinationService } from '@/modules/shelters/application/ShelterCoordinationService';
import type { OccupancySnapshot } from '@/modules/shelters/domain/OccupancySnapshot';
import { OwnerType, type ResourceOwner } from '@/core/organisations/ResourceOwner';
import { Shelter, type ShelterProps } from '@/modules/shelters/domain/Shelter';
import { makeUser, testKernel } from './fixtures';

export function shelter(overrides: Partial<ShelterProps> = {}): Shelter {
  return new Shelter({
    id: 'SHL-A',
    name: 'Kaduwela Community Hall',
    districtId: 'COL',
    address: 'Avissawella Rd',
    location: { latitude: 6.9356, longitude: 79.9846 },
    capacity: 100,
    ownerId: 'OWN-GOV',
    contactPhone: '+94 11 000 0000',
    facilities: ['Clean Water'],
    ...overrides,
  });
}

/** UC03 object graph: three shelters and four owner organisations. */
export function coordinationHarness() {
  const officer = makeUser({ roles: [Role.DISTRICT_OFFICER], homeDistrictId: 'COL' });
  const otherDistrictOfficer = makeUser({ roles: [Role.DISTRICT_OFFICER], homeDistrictId: 'GAL' });
  const k = testKernel([officer, otherDistrictOfficer]);

  const owners = new InMemoryRepository<ResourceOwner>([
    { id: 'OWN-GOV', name: 'Colombo District Secretariat', type: OwnerType.GOVERNMENT },
    { id: 'OWN-NAVY', name: 'Sri Lanka Navy', type: OwnerType.ARMED_FORCES },
    { id: 'OWN-RC', name: 'Red Cross', type: OwnerType.NGO },
    { id: 'OWN-DONOR', name: 'Hope Foundation', type: OwnerType.PRIVATE_DONOR },
  ]);
  const shelters = new InMemoryRepository<Shelter>([
    shelter(),
    shelter({ id: 'SHL-B', name: 'Hanwella College', location: { latitude: 6.9014, longitude: 80.0857 }, capacity: 300 }),
    shelter({ id: 'SHL-C', name: 'Kolonnawa Hall', location: { latitude: 6.9329, longitude: 79.8848 }, capacity: 50, occupancy: 48 }),
  ]);
  const snapshots = new InMemoryRepository<OccupancySnapshot>();

  const updates = new FieldUpdateRecorder(k.connectivity, k.sync, k.events, k.clock);
  k.sync.registerHandler(updates);
  return {
    ...k,
    officer,
    otherDistrictOfficer,
    owners,
    shelters,
    snapshots,
    updates,
    shelterService: new ShelterCoordinationService(shelters, snapshots, updates, k.inbox, k.users, k.geo, k.ids, k.clock),
  };
}
