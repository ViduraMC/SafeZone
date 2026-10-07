import { Role, type UserAccount } from '@/core/users/UserAccount';

/**
 * Demo personas. Login is out of scope for the assignment, so the app offers a
 * persona switcher instead; each persona exercises one actor of the use cases.
 */
export const PERSONA_IDS = {
  citizen: 'USR-CITIZEN',
  volunteer: 'USR-VOLUNTEER',
  dutyOfficer: 'USR-DUTY',
  dmcOfficer: 'USR-DMC',
  districtOfficer: 'USR-DISTRICT',
  rescueMember: 'USR-RESCUE',
  dmcOfficial: 'USR-OFFICIAL',
  donor: 'USR-DONOR',
} as const;

export const PERSONAS: readonly UserAccount[] = [
  {
    id: PERSONA_IDS.citizen,
    name: 'Nimali Perera',
    phone: '+94 77 123 4567',
    nic: '199512345678',
    homeDistrictId: 'COL',
    roles: [Role.CITIZEN],
    contact: { hasSmartphone: true, smsOptIn: true },
  },
  {
    id: PERSONA_IDS.volunteer,
    name: 'Amith Perera',
    phone: '+94 71 555 0101',
    nic: '199023456789',
    homeDistrictId: 'COL',
    roles: [Role.CITIZEN, Role.VOLUNTEER],
    contact: { hasSmartphone: true, smsOptIn: true },
    volunteer: { volunteerId: 'CDV-0042', trainingLevel: 'INTERMEDIATE' },
  },
  {
    id: PERSONA_IDS.dutyOfficer,
    name: 'Kasun Jayasuriya',
    phone: '+94 11 213 6222',
    homeDistrictId: 'COL',
    roles: [Role.DUTY_OFFICER],
    contact: { hasSmartphone: true, smsOptIn: false },
  },
  {
    id: PERSONA_IDS.dmcOfficer,
    name: 'Ruwan Wijesinghe',
    phone: '+94 11 213 6136',
    homeDistrictId: 'COL',
    roles: [Role.DMC_OFFICER],
    contact: { hasSmartphone: true, smsOptIn: false },
  },
  {
    id: PERSONA_IDS.districtOfficer,
    name: 'Pradeep Silva',
    phone: '+94 11 269 5541',
    homeDistrictId: 'COL',
    roles: [Role.DISTRICT_OFFICER],
    contact: { hasSmartphone: true, smsOptIn: false },
    organisationId: 'OWN-GOV-COL',
  },
  {
    id: PERSONA_IDS.rescueMember,
    name: 'Lt. Sanjeewa Bandara',
    phone: '+94 76 800 1122',
    homeDistrictId: 'COL',
    roles: [Role.RESCUE_TEAM_MEMBER],
    contact: { hasSmartphone: true, smsOptIn: true },
    rescueTeamId: 'TEAM-NAVY-1',
  },
  {
    id: PERSONA_IDS.dmcOfficial,
    name: 'Dr. Chamari Fernando',
    phone: '+94 11 267 0002',
    homeDistrictId: 'COL',
    roles: [Role.DMC_OFFICIAL],
    contact: { hasSmartphone: true, smsOptIn: false },
  },
  {
    id: PERSONA_IDS.donor,
    name: 'Dilani Gunawardena',
    phone: '+94 11 269 1095',
    homeDistrictId: 'COL',
    roles: [Role.DONOR_REPRESENTATIVE],
    contact: { hasSmartphone: true, smsOptIn: false },
    organisationId: 'OWN-REDCROSS',
  },
];

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  [Role.CITIZEN]: 'Citizen',
  [Role.VOLUNTEER]: 'Community Volunteer',
  [Role.DUTY_OFFICER]: 'Duty Officer',
  [Role.DMC_OFFICER]: 'DMC Officer',
  [Role.DISTRICT_OFFICER]: 'District Officer',
  [Role.RESCUE_TEAM_MEMBER]: 'Rescue Team',
  [Role.DMC_OFFICIAL]: 'DMC Official',
  [Role.DONOR_REPRESENTATIVE]: 'Donor Organisation',
};

const FIRST_NAMES = ['Saman', 'Kumari', 'Nuwan', 'Dilini', 'Ruwani', 'Chathura', 'Tharindu', 'Ishara', 'Lahiru', 'Sachini', 'Mohamed', 'Fathima', 'Suresh', 'Priya', 'Asela', 'Hasini'];
const LAST_NAMES = ['Fernando', 'Silva', 'Perera', 'Bandara', 'Rajapaksha', 'Dissanayake', 'Herath', 'Rizwan', 'Kumar', 'Wickramasinghe', 'Jayawardena', 'Senanayake'];

/** Registered citizens per district, generated deterministically. */
export function generateCitizens(perDistrict: Readonly<Record<string, number>>): UserAccount[] {
  const citizens: UserAccount[] = [];
  let n = 0;
  for (const [districtId, count] of Object.entries(perDistrict)) {
    for (let i = 0; i < count; i += 1, n += 1) {
      citizens.push({
        id: `USR-C${String(n + 1).padStart(3, '0')}`,
        name: `${FIRST_NAMES[n % FIRST_NAMES.length]} ${LAST_NAMES[(n * 7) % LAST_NAMES.length]}`,
        phone: `+94 7${n % 9} ${String(1000000 + n * 7919).slice(-7)}`,
        homeDistrictId: districtId,
        roles: [Role.CITIZEN],
        // Roughly one in five registered citizens has a basic phone (SMS only).
        contact: { hasSmartphone: n % 5 !== 0, smsOptIn: n % 2 === 0 },
      });
    }
  }
  return citizens;
}
