import { CoordinationOverviewScreen } from './CoordinationOverviewScreen';
import { RegisterShelterScreen, ShelterListScreen, ShelterManageScreen } from './ShelterScreens';
import { ShelterDetailScreen, SheltersScreen } from './SheltersScreen';

/** UC03 Coordinate Emergency Shelters. */
export const shelterScreens = {
  Shelters: SheltersScreen,
  ShelterDetail: ShelterDetailScreen,
  Coordination: CoordinationOverviewScreen,
  ShelterList: ShelterListScreen,
  RegisterShelter: RegisterShelterScreen,
  ShelterManage: ShelterManageScreen,
};
