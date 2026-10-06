import { SeverityLevel } from '@/core/hazard/SeverityLevel';
import { MS_PER_HOUR } from '@/core/shared/Clock';
import { ReliefCategory, ReliefStock } from '@/modules/dispatch/domain/Relief';
import { RescueTeam, RescueTeamStatus } from '@/modules/dispatch/domain/RescueTeam';
import { OwnerType } from '@/core/organisations/ResourceOwner';
import { Shelter } from '@/modules/shelters/domain/Shelter';
import type { Evidence } from '@/modules/reports/domain/Evidence';
import type { SafeZoneApp } from '../container';
import { generateCitizens, PERSONA_IDS, PERSONAS } from './personas';
import { placeholderPhoto } from './photos';

export const CURRENT_EVENT_ID = 'EVT-KELANI-FLOODS';
export const LANDSLIDE_EVENT_ID = 'EVT-CENTRAL-LANDSLIDES';
export const PAST_EVENT_ID = 'EVT-SOUTHERN-FLOODS-2026';

/**
 * Builds a realistic demo world. History is created through the real
 * application services with the clock frozen in the past, so deliveries,
 * occupancy snapshots and distributions are genuine outputs of the use cases.
 */
export async function seedDemoData(app: SafeZoneApp, now: Date = new Date()): Promise<void> {
  const hoursAgo = (h: number) => new Date(now.getTime() - h * MS_PER_HOUR);
  const at = (time: Date) => app.clock.freezeAt(time);
  const user = (id: string) => app.users.get(id);
  const r = app.repositories;

  [...PERSONAS, ...generateCitizens({ COL: 14, GAM: 10, KEG: 6, KAN: 6, NUW: 4, RAT: 5, GAL: 7, MTR: 5, KAL: 4 })].forEach((u) => r.users.save(u));

  [
    { id: 'OWN-GOV-COL', name: 'Colombo District Secretariat', type: OwnerType.GOVERNMENT },
    { id: 'OWN-KADUWELA-DS', name: 'Kaduwela Divisional Secretariat', type: OwnerType.GOVERNMENT },
    { id: 'OWN-GOV-GALLE', name: 'Galle District Secretariat', type: OwnerType.GOVERNMENT },
    { id: 'OWN-ARMY', name: 'Sri Lanka Army', type: OwnerType.ARMED_FORCES },
    { id: 'OWN-NAVY', name: 'Sri Lanka Navy', type: OwnerType.ARMED_FORCES },
    { id: 'OWN-REDCROSS', name: 'Sri Lanka Red Cross Society', type: OwnerType.NGO },
    { id: 'OWN-SARVODAYA', name: 'Sarvodaya Shramadana', type: OwnerType.NGO },
    { id: 'OWN-LANKAHOPE', name: 'Lanka Hope Foundation', type: OwnerType.PRIVATE_DONOR },
  ].forEach((owner) => r.owners.save(owner));

  r.events.save({ id: PAST_EVENT_ID, name: 'Southern Monsoon Floods - May 2026', hazardTypeCode: 'FLOOD', districtIds: ['GAL', 'MTR', 'KAL'], startedAt: new Date('2026-05-20T00:00:00+05:30'), endedAt: new Date('2026-05-28T23:59:00+05:30') });
  r.events.save({ id: CURRENT_EVENT_ID, name: 'Kelani Basin Floods', hazardTypeCode: 'FLOOD', districtIds: ['COL', 'GAM', 'KEG'], startedAt: hoursAgo(48) });
  r.events.save({ id: LANDSLIDE_EVENT_ID, name: 'Central Highlands Landslides', hazardTypeCode: 'LANDSLIDE', districtIds: ['KAN', 'NUW', 'KEG'], startedAt: hoursAgo(20) });

  seedShelters(app);
  seedTeams(app);
  seedStock(app);

  await seedPastEvent(app);
  await seedCurrentEvent(app, hoursAgo, at, user);

  app.clock.release();
}

function shelter(id: string, name: string, districtId: string, address: string, lat: number, lon: number, capacity: number, ownerId: string, phone: string, facilities: string[]): Shelter {
  return new Shelter({ id, name, districtId, address, location: { latitude: lat, longitude: lon }, capacity, ownerId, contactPhone: phone, facilities });
}

function seedShelters(app: SafeZoneApp): void {
  const all = ['Clean Water', 'First Aid Desk', 'Hot Meals', 'Device Charging'];
  [
    shelter('SHL-KADU-CH', 'Kaduwela Community Hall', 'COL', 'Avissawella Rd, Kaduwela', 6.9356, 79.9846, 200, 'OWN-KADUWELA-DS', '+94 11 253 9284', all),
    shelter('SHL-KADU-MP', 'Kaduwela Multipurpose Hall', 'COL', 'Vihara Maha Devi Mawatha, Kaduwela', 6.9301, 79.9808, 120, 'OWN-KADUWELA-DS', '+94 11 253 9100', ['Clean Water', 'Hot Meals']),
    shelter('SHL-HANWELLA', 'Hanwella Central College', 'COL', 'Colombo-Avissawella Rd, Hanwella', 6.9014, 80.0857, 300, 'OWN-GOV-COL', '+94 36 225 5120', all),
    shelter('SHL-KOLONNAWA', 'Kolonnawa Temple Hall', 'COL', 'Kolonnawa Rd, Kolonnawa', 6.9329, 79.8848, 150, 'OWN-GOV-COL', '+94 11 257 2290', ['Clean Water', 'First Aid Desk']),
    shelter('SHL-AVISSA', 'Avissawella Town Hall', 'COL', 'Main St, Avissawella', 6.9553, 80.2104, 180, 'OWN-GOV-COL', '+94 36 222 2251', ['Clean Water', 'Hot Meals', 'Device Charging']),
    shelter('SHL-BIYAGAMA', 'Biyagama Sports Complex', 'GAM', 'Biyagama Rd, Biyagama', 6.9497, 79.9853, 400, 'OWN-ARMY', '+94 11 248 7700', all),
    shelter('SHL-KELANIYA', 'Kelaniya Raja Maha Vihara Hall', 'GAM', 'Kelaniya', 6.9531, 79.9218, 250, 'OWN-REDCROSS', '+94 11 291 1505', ['Clean Water', 'Hot Meals', 'First Aid Desk']),
    shelter('SHL-RUWANWELLA', 'Ruwanwella Maha Vidyalaya', 'KEG', 'Ruwanwella', 7.0441, 80.2559, 150, 'OWN-SARVODAYA', '+94 36 226 8040', ['Clean Water']),
    shelter('SHL-GAMPOLA', 'Gampola Central College', 'KAN', 'Nuwara Eliya Rd, Gampola', 7.1643, 80.5696, 220, 'OWN-ARMY', '+94 81 235 2215', all),
    shelter('SHL-BADDEGAMA', 'Baddegama Central College', 'GAL', 'Baddegama', 6.1667, 80.1833, 250, 'OWN-GOV-GALLE', '+94 91 229 2210', all),
    shelter('SHL-THAWALAMA', 'Thawalama Temple Hall', 'GAL', 'Thawalama', 6.3409, 80.3325, 120, 'OWN-GOV-GALLE', '+94 91 228 0144', ['Clean Water', 'Hot Meals']),
    shelter('SHL-AKURESSA', 'Akuressa Community Centre', 'MTR', 'Akuressa', 6.0959, 80.4747, 200, 'OWN-REDCROSS', '+94 41 228 3360', ['Clean Water', 'First Aid Desk']),
  ].forEach((s) => app.repositories.shelters.save(s));
}

function seedTeams(app: SafeZoneApp): void {
  [
    new RescueTeam({ id: 'TEAM-NAVY-1', name: 'SL Navy Rescue Boat Unit 1', ownerId: 'OWN-NAVY', homeDistrictId: 'COL', specialisation: 'Flood boat rescue', members: 8 }),
    new RescueTeam({ id: 'TEAM-ARMY-1', name: 'SL Army 1st Rapid Response', ownerId: 'OWN-ARMY', homeDistrictId: 'GAM', specialisation: 'Evacuation & logistics', members: 20 }),
    new RescueTeam({ id: 'TEAM-REDCROSS-1', name: 'Red Cross First Aid Team - Colombo', ownerId: 'OWN-REDCROSS', homeDistrictId: 'COL', specialisation: 'First aid', members: 6 }),
    new RescueTeam({ id: 'TEAM-KADUWELA', name: 'Kaduwela Volunteer Rescue Team', ownerId: 'OWN-KADUWELA-DS', homeDistrictId: 'COL', specialisation: 'Community evacuation', members: 12 }),
    new RescueTeam({ id: 'TEAM-NAVY-2', name: 'SL Navy Boat Team - Kalutara', ownerId: 'OWN-NAVY', homeDistrictId: 'KAL', specialisation: 'Flood boat rescue', members: 8 }),
    new RescueTeam({ id: 'TEAM-ARMY-2', name: 'SL Army Engineering Unit - Kegalle', ownerId: 'OWN-ARMY', homeDistrictId: 'KEG', specialisation: 'Landslide search & rescue', members: 15 }),
    new RescueTeam({ id: 'TEAM-SARVODAYA', name: 'Sarvodaya Relief Team - Kandy', ownerId: 'OWN-SARVODAYA', homeDistrictId: 'KAN', specialisation: 'Relief distribution', members: 10 }),
  ].forEach((team) => app.repositories.teams.save(team));
}

function seedStock(app: SafeZoneApp): void {
  const stock = (id: string, ownerId: string, category: ReliefCategory, itemName: string, unit: string, quantity: number) =>
    app.repositories.stocks.save(new ReliefStock({ id, ownerId, category, itemName, unit, quantity }));
  stock('STK-GOV-RATIONS', 'OWN-GOV-COL', ReliefCategory.FOOD, 'Dry ration packs', 'packs', 1500);
  stock('STK-GOV-WATER', 'OWN-GOV-COL', ReliefCategory.WATER, 'Bottled water', 'litres', 6000);
  stock('STK-ARMY-MEALS', 'OWN-ARMY', ReliefCategory.FOOD, 'Cooked meal packets', 'packets', 1200);
  stock('STK-ARMY-TARP', 'OWN-ARMY', ReliefCategory.SHELTER_KIT, 'Tarpaulin sheets', 'sheets', 300);
  stock('STK-RC-PURIFY', 'OWN-REDCROSS', ReliefCategory.WATER, 'Water purification kits', 'kits', 500);
  stock('STK-RC-FIRSTAID', 'OWN-REDCROSS', ReliefCategory.MEDICINE, 'First aid kits', 'kits', 180);
  stock('STK-RC-HYGIENE', 'OWN-REDCROSS', ReliefCategory.HYGIENE, 'Hygiene packs', 'packs', 700);
  stock('STK-HOPE-MILK', 'OWN-LANKAHOPE', ReliefCategory.FOOD, 'Infant milk powder', 'tins', 240);
  stock('STK-HOPE-MATS', 'OWN-LANKAHOPE', ReliefCategory.SHELTER_KIT, 'Sleeping mats', 'mats', 500);
  stock('STK-SARV-MEDS', 'OWN-SARVODAYA', ReliefCategory.MEDICINE, 'Essential medicine packs', 'packs', 40);
}

/** Completed event used to demonstrate UC04 with a full data set. */
async function seedPastEvent(app: SafeZoneApp): Promise<void> {
  const t = (iso: string) => app.clock.freezeAt(new Date(`${iso}+05:30`));
  const dmc = app.users.get(PERSONA_IDS.dmcOfficer);
  const officer = app.users.get(PERSONA_IDS.districtOfficer);

  t('2026-05-20T06:00:00');
  const gin = await app.alerts.issueWarning(
    { hazardTypeCode: 'FLOOD', severity: SeverityLevel.WARNING, title: 'Gin Ganga flood warning', description: 'Gin Ganga rising rapidly at Baddegama. Residents in low-lying areas prepare to evacuate.', targetScope: 'RIVER_BASIN', targetIds: ['GIN'], validityHours: 72, eventId: PAST_EVENT_ID },
    dmc,
  );
  t('2026-05-20T09:00:00');
  await app.alerts.issueWarning(
    { hazardTypeCode: 'FLOOD', severity: SeverityLevel.ADVISORY, title: 'Nilwala Ganga flood advisory', description: 'Heavy rain in the upper catchment. Monitor water levels along Nilwala Ganga.', targetScope: 'RIVER_BASIN', targetIds: ['NILWALA'], validityHours: 48, eventId: PAST_EVENT_ID },
    dmc,
  );
  t('2026-05-21T04:30:00');
  // Push network was down in parts of Galle during the escalation.
  app.connectivity.setOnline(false);
  await app.alerts.escalateWarning(gin.alert.id, SeverityLevel.EMERGENCY, 'Major flood level exceeded at Baddegama gauge', dmc);
  app.connectivity.setOnline(true);
  t('2026-05-25T18:00:00');
  app.alerts.resolveWarning(gin.alert.id, dmc);

  const occupancyPlan: [string, string, number][] = [
    ['2026-05-20T10:00:00', 'SHL-BADDEGAMA', 60],
    ['2026-05-20T16:00:00', 'SHL-THAWALAMA', 40],
    ['2026-05-21T06:00:00', 'SHL-BADDEGAMA', 120],
    ['2026-05-21T08:00:00', 'SHL-AKURESSA', 70],
    ['2026-05-21T14:00:00', 'SHL-THAWALAMA', 55],
    ['2026-05-22T09:00:00', 'SHL-BADDEGAMA', 50],
    ['2026-05-22T12:00:00', 'SHL-AKURESSA', 60],
  ];
  occupancyPlan.forEach(([time, shelterId, people]) => {
    t(time);
    app.shelters.allocate(shelterId, people, officer);
  });
  const releases: [string, string, number][] = [
    ['2026-05-25T10:00:00', 'SHL-BADDEGAMA', 150],
    ['2026-05-26T10:00:00', 'SHL-THAWALAMA', 95],
    ['2026-05-26T15:00:00', 'SHL-AKURESSA', 130],
    ['2026-05-27T09:00:00', 'SHL-BADDEGAMA', 80],
  ];
  releases.forEach(([time, shelterId, people]) => {
    t(time);
    app.shelters.release(shelterId, people, officer);
  });

  const distributionPlan: [string, string, number, string, string?][] = [
    ['2026-05-20T18:00:00', 'STK-GOV-RATIONS', 300, 'GAL', 'SHL-BADDEGAMA'],
    ['2026-05-21T09:00:00', 'STK-RC-PURIFY', 120, 'GAL'],
    ['2026-05-21T12:00:00', 'STK-ARMY-MEALS', 400, 'GAL', 'SHL-BADDEGAMA'],
    ['2026-05-22T10:00:00', 'STK-RC-HYGIENE', 150, 'MTR', 'SHL-AKURESSA'],
    ['2026-05-22T15:00:00', 'STK-HOPE-MILK', 60, 'MTR'],
    ['2026-05-23T08:00:00', 'STK-RC-FIRSTAID', 40, 'GAL'],
    ['2026-05-23T11:00:00', 'STK-GOV-WATER', 1500, 'MTR'],
  ];
  distributionPlan.forEach(([time, stockId, quantity, districtId, shelterId]) => {
    t(time);
    app.relief.distribute({ stockId, quantity, districtId, shelterId, eventId: PAST_EVENT_ID }, officer);
  });

  // Rescue missions, including one team borrowed from another district.
  const missions: [string, string, string, string[], number][] = [
    ['TEAM-NAVY-2', 'GAL', 'Baddegama low-lying houses', ['2026-05-20T19:00:00', '2026-05-20T19:20:00', '2026-05-20T20:05:00', '2026-05-21T03:30:00', '2026-05-21T06:00:00'], 34],
    ['TEAM-NAVY-2', 'GAL', 'Thawalama temple road', ['2026-05-21T09:00:00', '2026-05-21T09:15:00', '2026-05-21T10:10:00', '2026-05-21T15:00:00', '2026-05-21T17:00:00'], 21],
    ['TEAM-ARMY-2', 'MTR', 'Akuressa town centre', ['2026-05-21T07:00:00', '2026-05-21T07:30:00', '2026-05-21T09:40:00', '2026-05-21T18:00:00', '2026-05-22T08:00:00'], 18],
  ];
  missions.forEach(([teamId, districtId, place, [dispatched, enRoute, onScene, done, back], rescued]) => {
    t(dispatched);
    app.rescue.dispatch(teamId, { districtId, locationDescription: place, eventId: PAST_EVENT_ID }, officer);
    t(enRoute);
    app.rescue.updateStatus(teamId, RescueTeamStatus.EN_ROUTE, officer);
    t(onScene);
    app.rescue.updateStatus(teamId, RescueTeamStatus.ON_SCENE, officer);
    t(done);
    app.rescue.completeMission(teamId, rescued, 'Residents moved to the nearest open shelter.', officer);
    t(back);
    app.rescue.updateStatus(teamId, RescueTeamStatus.STANDBY, officer);
  });
}

async function seedCurrentEvent(
  app: SafeZoneApp,
  hoursAgo: (h: number) => Date,
  at: (time: Date) => void,
  user: (id: string) => ReturnType<SafeZoneApp['users']['get']>,
): Promise<void> {
  const dmc = user(PERSONA_IDS.dmcOfficer);
  const duty = user(PERSONA_IDS.dutyOfficer);
  const officer = user(PERSONA_IDS.districtOfficer);
  const volunteer = user(PERSONA_IDS.volunteer);
  const citizen = user(PERSONA_IDS.citizen);
  const photo = (caption: string, hue: number): Evidence => app.reportSubmission.attachPhoto({ fileName: `${caption}.jpg`, mimeType: 'image/jpeg', sizeBytes: 840_000, previewUrl: placeholderPhoto(caption, hue) });

  at(hoursAgo(46));
  const kelani = await app.alerts.issueWarning(
    { hazardTypeCode: 'FLOOD', severity: SeverityLevel.WARNING, title: 'Kelani River Basin Spillover', description: 'Water levels of the Kelani River are rising at Hanwella. Low-lying residents in Hanwella, Kaduwela and Kolonnawa prepare to evacuate to designated safe zones.', targetScope: 'RIVER_BASIN', targetIds: ['KELANI'], validityHours: 72, eventId: CURRENT_EVENT_ID },
    dmc,
  );
  at(hoursAgo(40));
  const attanagalu = await app.alerts.issueWarning(
    { hazardTypeCode: 'FLOOD', severity: SeverityLevel.ADVISORY, title: 'Attanagalu Oya water level advisory', description: 'Attanagalu Oya is above the alert level. Avoid crossing flooded roads in Gampaha.', targetScope: 'RIVER_BASIN', targetIds: ['ATTANAGALU'], validityHours: 48, eventId: CURRENT_EVENT_ID },
    dmc,
  );

  at(hoursAgo(31));
  const kaduwelaReport = app.reportSubmission.submit(
    { hazardTypeCode: 'FLOOD', description: 'Water level has risen above 2 feet near Kaduwela Junction. Small vehicles and bikes cannot pass. Local traffic is completely blocked.', severityAssessment: 'HIGH', location: { latitude: 6.9339, longitude: 79.9829, source: 'GPS', districtId: 'COL', label: 'Kaduwela Junction' }, photos: [photo('Road flooding - Kaduwela Junction', 205)] },
    volunteer,
  );
  at(hoursAgo(30.5));
  app.reportVerification.verify(kaduwelaReport.id, duty, 5, 'Matches Hanwella gauge readings. Trained volunteer.');
  at(hoursAgo(30));
  await app.alerts.escalateWarning(kelani.alert.id, SeverityLevel.EMERGENCY, 'Hanwella gauge exceeded major flood level (7.5 m); verified ground report from Kaduwela Junction.', dmc, [kaduwelaReport.id]);

  at(hoursAgo(20));
  const treeReport = app.reportSubmission.submit(
    { hazardTypeCode: 'FLOOD', description: 'Large tree fallen across the road at Malabe, traffic blocked.', severityAssessment: 'LOW', location: { latitude: 6.9061, longitude: 79.9696, source: 'GPS', districtId: 'COL', label: 'Malabe, Kaduwela Rd' }, photos: [photo('Fallen tree - Malabe', 120)] },
    user('USR-C002'),
  );
  at(hoursAgo(19));
  app.reportVerification.reject(treeReport.id, duty, 'Not a flood hazard. Forwarded to the Road Development Authority.');
  at(hoursAgo(18));
  app.alerts.resolveWarning(attanagalu.alert.id, dmc);

  at(hoursAgo(5));
  // SMS gateway outage: people with basic phones could not be reached and were queued (UC01 E2).
  app.smsGateway.setAvailable(false);
  await app.alerts.issueWarning(
    { hazardTypeCode: 'LANDSLIDE', severity: SeverityLevel.EMERGENCY, title: 'Extreme Landslide Risk', description: 'Rainfall exceeded 150 mm in 24 hours. Residents on slopes in Kandy and Nuwara Eliya districts evacuate immediately.', targetScope: 'DISTRICT', targetIds: ['KAN', 'NUW'], validityHours: 48, eventId: LANDSLIDE_EVENT_ID },
    dmc,
  );
  app.smsGateway.setAvailable(true);

  at(hoursAgo(3));
  const slopeReport = app.reportSubmission.submit(
    { hazardTypeCode: 'LANDSLIDE', description: 'Cracks appearing on the slope behind houses near Ruwanwella temple. Small rocks falling.', severityAssessment: 'MEDIUM', location: { latitude: 7.0441, longitude: 80.2559, source: 'GPS', districtId: 'KEG', label: 'Ruwanwella temple road' }, photos: [photo('Slope cracks - Ruwanwella', 30)] },
    citizen,
  );
  at(hoursAgo(2.5));
  app.reportVerification.requestMoreInformation(slopeReport.id, duty, 'Please add a photo showing the full slope and tell us how many houses are below it.');

  at(hoursAgo(2));
  await app.alerts.issueWarning(
    { hazardTypeCode: 'FLOOD', severity: SeverityLevel.ADVISORY, title: 'Heavy rain expected in Sabaragamuwa', description: 'More than 100 mm of rain is expected in Ratnapura district over the next 24 hours. Stay alert for rising water.', targetScope: 'DISTRICT', targetIds: ['RAT'], validityHours: 24 },
    dmc,
  );

  at(hoursAgo(1));
  app.reportSubmission.submit(
    { hazardTypeCode: 'FLOOD', description: 'Water is flowing over the Hanwella bridge approach road. Two houses near the river bank are surrounded by water.', severityAssessment: 'HIGH', location: { latitude: 6.9014, longitude: 80.0857, source: 'GPS', districtId: 'COL', label: 'Hanwella bridge' }, photos: [photo('Hanwella bridge', 210), photo('Houses surrounded', 200)] },
    user('USR-C005'),
  );
  at(hoursAgo(0.6));
  app.reportSubmission.submit(
    { hazardTypeCode: 'FLOOD', description: 'Drainage canal overflowing near Kolonnawa market; water entering shops.', severityAssessment: 'MEDIUM', location: { latitude: 6.9329, longitude: 79.8848, source: 'GPS', districtId: 'COL', label: 'Kolonnawa market' }, photos: [photo('Canal overflow - Kolonnawa', 190)] },
    volunteer,
  );

  const allocations: [number, string, number][] = [
    [44, 'SHL-KADU-CH', 40], [42, 'SHL-HANWELLA', 80], [40, 'SHL-BIYAGAMA', 60], [36, 'SHL-KADU-MP', 30],
    [30, 'SHL-HANWELLA', 110], [29, 'SHL-KADU-CH', 50], [28, 'SHL-KELANIYA', 120], [26, 'SHL-KOLONNAWA', 40],
    [22, 'SHL-BIYAGAMA', 60], [20, 'SHL-KELANIYA', 90], [16, 'SHL-HANWELLA', 55], [12, 'SHL-KADU-CH', 30],
    [10, 'SHL-KADU-MP', 35], [6, 'SHL-RUWANWELLA', 30], [4, 'SHL-GAMPOLA', 45],
  ];
  allocations.forEach(([h, shelterId, people]) => {
    at(hoursAgo(h));
    app.shelters.allocate(shelterId, people, officer);
  });

  const distributions: [number, string, number, string, string?][] = [
    [43, 'STK-GOV-RATIONS', 200, 'COL', 'SHL-KADU-CH'], [41, 'STK-GOV-WATER', 1200, 'COL', 'SHL-HANWELLA'],
    [35, 'STK-ARMY-MEALS', 300, 'GAM', 'SHL-BIYAGAMA'], [28, 'STK-RC-FIRSTAID', 30, 'COL', 'SHL-HANWELLA'],
    [27, 'STK-RC-HYGIENE', 120, 'GAM', 'SHL-KELANIYA'], [24, 'STK-HOPE-MATS', 150, 'COL', 'SHL-KADU-CH'],
    [21, 'STK-RC-PURIFY', 80, 'COL'], [15, 'STK-ARMY-TARP', 60, 'GAM'], [9, 'STK-HOPE-MILK', 40, 'COL', 'SHL-KADU-MP'],
  ];
  distributions.forEach(([h, stockId, quantity, districtId, shelterId]) => {
    at(hoursAgo(h));
    app.relief.distribute({ stockId, quantity, districtId, shelterId, eventId: CURRENT_EVENT_ID }, officer);
  });

  at(hoursAgo(30));
  app.rescue.dispatch('TEAM-KADUWELA', { districtId: 'COL', locationDescription: 'Kaduwela riverside lane', eventId: CURRENT_EVENT_ID }, officer);
  at(hoursAgo(29.8));
  app.rescue.updateStatus('TEAM-KADUWELA', RescueTeamStatus.EN_ROUTE, officer);
  at(hoursAgo(29.3));
  app.rescue.updateStatus('TEAM-KADUWELA', RescueTeamStatus.ON_SCENE, officer);
  at(hoursAgo(26));
  app.rescue.completeMission('TEAM-KADUWELA', 12, 'Elderly residents moved to Kaduwela Community Hall.', officer);
  at(hoursAgo(25));
  app.rescue.updateStatus('TEAM-KADUWELA', RescueTeamStatus.STANDBY, officer);

  at(hoursAgo(20));
  app.rescue.dispatch('TEAM-ARMY-1', { districtId: 'GAM', locationDescription: 'Biyagama low-lying housing scheme', eventId: CURRENT_EVENT_ID }, officer);
  at(hoursAgo(19));
  app.rescue.updateStatus('TEAM-ARMY-1', RescueTeamStatus.EN_ROUTE, officer);
  at(hoursAgo(18));
  app.rescue.updateStatus('TEAM-ARMY-1', RescueTeamStatus.ON_SCENE, officer);
  at(hoursAgo(0.8));
  app.rescue.dispatch('TEAM-NAVY-1', { districtId: 'COL', locationDescription: 'Hanwella bridge - two houses surrounded by water', eventId: CURRENT_EVENT_ID }, officer);
}
