import type { LinkingOptions, ParamListBase } from '@react-navigation/native';

/**
 * Every screen of the app and its path. Paths let notifications, the status
 * banner and the web build link to a screen the same way (for example
 * "/alerts/ALR-1"), and React Navigation turns them into stack routes.
 */
export const ROUTE_PATHS = {
  Home: '/',
  Hub: '/hub',
  // UC01 - Issue Hazard Warning
  Alerts: '/alerts',
  AlertDetail: '/alerts/:alertId',
  Warnings: '/warnings',
  IssueWarning: '/warnings/new',
  WarningDetail: '/warnings/:alertId',
  // UC02 - Submit & Verify Hazard Report
  ReportIncident: '/report',
  MyReports: '/my-reports',
  MyReportDetail: '/my-reports/:reportId',
  ReviewQueue: '/review',
  ReviewHistory: '/review/history',
  ReviewDetail: '/review/:reportId',
  // UC03 - Coordinate Emergency Shelters
  Shelters: '/shelters',
  ShelterDetail: '/shelters/:shelterId',
  Coordination: '/coordination',
  ShelterList: '/coordination/shelters',
  RegisterShelter: '/coordination/shelters/new',
  ShelterManage: '/coordination/shelters/:shelterId',
  // UC04 - Dispatch Rescue Teams & Relief Resources
  Teams: '/coordination/teams',
  Relief: '/coordination/relief',
  Rescue: '/rescue',
  // UC05 - Generate Disaster Response Reports
  Reports: '/reports',
} as const;

export type RouteName = keyof typeof ROUTE_PATHS;

export function routeNameForPath(path: string): RouteName | undefined {
  return (Object.keys(ROUTE_PATHS) as RouteName[]).find((name) => ROUTE_PATHS[name] === path);
}

export const linking: LinkingOptions<ParamListBase> = {
  prefixes: ['safezone://'],
  config: {
    screens: Object.fromEntries(Object.entries(ROUTE_PATHS).map(([name, path]) => [name, path.slice(1)])),
  },
};
