import type { District, RiverBasin } from './District';

const d = (id: string, name: string, province: string, latitude: number, longitude: number): District => ({
  id,
  name,
  province,
  centroid: { latitude, longitude },
});

/** The 25 administrative districts of Sri Lanka with approximate centroids. */
export const SRI_LANKA_DISTRICTS: readonly District[] = [
  d('COL', 'Colombo', 'Western', 6.87, 80.01),
  d('GAM', 'Gampaha', 'Western', 7.09, 80.01),
  d('KAL', 'Kalutara', 'Western', 6.58, 80.1),
  d('KAN', 'Kandy', 'Central', 7.29, 80.63),
  d('MAT', 'Matale', 'Central', 7.47, 80.62),
  d('NUW', 'Nuwara Eliya', 'Central', 6.97, 80.77),
  d('GAL', 'Galle', 'Southern', 6.05, 80.22),
  d('MTR', 'Matara', 'Southern', 5.95, 80.55),
  d('HAM', 'Hambantota', 'Southern', 6.12, 81.12),
  d('JAF', 'Jaffna', 'Northern', 9.66, 80.02),
  d('KIL', 'Kilinochchi', 'Northern', 9.39, 80.4),
  d('MAN', 'Mannar', 'Northern', 8.98, 79.9),
  d('VAV', 'Vavuniya', 'Northern', 8.75, 80.5),
  d('MUL', 'Mullaitivu', 'Northern', 9.27, 80.81),
  d('BAT', 'Batticaloa', 'Eastern', 7.73, 81.69),
  d('AMP', 'Ampara', 'Eastern', 7.3, 81.67),
  d('TRI', 'Trincomalee', 'Eastern', 8.59, 81.21),
  d('KUR', 'Kurunegala', 'North Western', 7.49, 80.36),
  d('PUT', 'Puttalam', 'North Western', 8.04, 79.83),
  d('ANU', 'Anuradhapura', 'North Central', 8.31, 80.4),
  d('POL', 'Polonnaruwa', 'North Central', 7.94, 81.0),
  d('BAD', 'Badulla', 'Uva', 6.99, 81.06),
  d('MON', 'Monaragala', 'Uva', 6.87, 81.35),
  d('RAT', 'Ratnapura', 'Sabaragamuwa', 6.68, 80.4),
  d('KEG', 'Kegalle', 'Sabaragamuwa', 7.25, 80.35),
];

/** Major river basins used by the Irrigation Department for flood warnings. */
export const SRI_LANKA_RIVER_BASINS: readonly RiverBasin[] = [
  { id: 'KELANI', name: 'Kelani Ganga', districtIds: ['NUW', 'KEG', 'GAM', 'COL'] },
  { id: 'KALU', name: 'Kalu Ganga', districtIds: ['RAT', 'KAL'] },
  { id: 'MAHAWELI', name: 'Mahaweli Ganga', districtIds: ['NUW', 'KAN', 'MAT', 'BAD', 'POL', 'TRI'] },
  { id: 'GIN', name: 'Gin Ganga', districtIds: ['GAL'] },
  { id: 'NILWALA', name: 'Nilwala Ganga', districtIds: ['MTR'] },
  { id: 'ATTANAGALU', name: 'Attanagalu Oya', districtIds: ['GAM'] },
  { id: 'WALAWE', name: 'Walawe Ganga', districtIds: ['RAT', 'HAM'] },
  { id: 'DEDURU', name: 'Deduru Oya', districtIds: ['KUR', 'PUT'] },
];
