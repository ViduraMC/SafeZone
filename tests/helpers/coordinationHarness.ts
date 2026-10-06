import { InMemoryRepository } from '@/core/shared/Repository';
import { Role } from '@/core/users/UserAccount';
import { FieldUpdateRecorder } from '@/core/sync/FieldUpdateRecorder';
import { ReliefDistributionService } from '@/modules/dispatch/application/ReliefDistributionService';
import { RescueDispatchService } from '@/modules/dispatch/application/RescueDispatchService';
import { ShelterCoordinationService } from '@/modules/shelters/application/ShelterCoordinationService';
import { ReliefCategory, ReliefStock, type ReliefDistribution } from '@/modules/dispatch/domain/Relief';
import type { OccupancySnapshot } from '@/modules/shelters/domain/OccupancySnapshot';
import { RescueTeam } from '@/modules/dispatch/domain/RescueTeam';
import { OrganisationDirectory, OwnerType, type ResourceOwner } from '@/core/organisations/ResourceOwner';
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

export const team = (id: string, homeDistrictId: string, ownerId = 'OWN-NAVY') =>
  new RescueTeam({ id, name: `Team ${id}`, ownerId, homeDistrictId, specialisation: 'Boat rescue', members: 6 });

/** UC03 + UC04 object graph: three shelters, three teams, four owners, three stocks. */
export function coordinationHarness() {
  const officer = makeUser({ roles: [Role.DISTRICT_OFFICER], homeDistrictId: 'COL' });
  const otherDistrictOfficer = makeUser({ roles: [Role.DISTRICT_OFFICER], homeDistrictId: 'GAL' });
  const navyMember = makeUser({ roles: [Role.RESCUE_TEAM_MEMBER], rescueTeamId: 'T-COL' });
  const k = testKernel([officer, otherDistrictOfficer, navyMember]);

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
  const teams = new InMemoryRepository<RescueTeam>([team('T-COL', 'COL'), team('T-COL-2', 'COL', 'OWN-RC'), team('T-KAL', 'KAL')]);
  const stocks = new InMemoryRepository<ReliefStock>([
    new ReliefStock({ id: 'STK-RATIONS', ownerId: 'OWN-GOV', category: ReliefCategory.FOOD, itemName: 'Dry rations', unit: 'packs', quantity: 500 }),
    new ReliefStock({ id: 'STK-MEDS', ownerId: 'OWN-RC', category: ReliefCategory.MEDICINE, itemName: 'Medicine packs', unit: 'packs', quantity: 40 }),
    new ReliefStock({ id: 'STK-EMPTY', ownerId: 'OWN-DONOR', category: ReliefCategory.WATER, itemName: 'Water', unit: 'litres', quantity: 0 }),
  ]);
  const snapshots = new InMemoryRepository<OccupancySnapshot>();
  const distributions = new InMemoryRepository<ReliefDistribution>();

  const updates = new FieldUpdateRecorder(k.connectivity, k.sync, k.events, k.clock);
  k.sync.registerHandler(updates);
  return {
    ...k,
    officer,
    otherDistrictOfficer,
    navyMember,
    owners,
    shelters,
    teams,
    stocks,
    snapshots,
    distributions,
    updates,
    shelterService: new ShelterCoordinationService(shelters, snapshots, updates, k.inbox, k.users, k.geo, k.ids, k.clock),
    rescue: new RescueDispatchService(teams, updates, k.inbox, k.users, k.geo, k.clock),
    organisations: new OrganisationDirectory(owners),
    relief: new ReliefDistributionService(stocks, new OrganisationDirectory(owners), distributions, shelters, updates, k.ids, k.clock),
  };
}
