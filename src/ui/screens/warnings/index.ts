import { AlertDetailScreen } from './AlertDetailScreen';
import { AlertsScreen } from './AlertsScreen';
import { IssueWarningScreen } from './IssueWarningScreen';
import { WarningDetailScreen } from './WarningDetailScreen';
import { WarningsDashboardScreen } from './WarningsDashboardScreen';

/** UC01 Issue Hazard Warning. */
export const warningScreens = {
  Alerts: AlertsScreen,
  AlertDetail: AlertDetailScreen,
  Warnings: WarningsDashboardScreen,
  IssueWarning: IssueWarningScreen,
  WarningDetail: WarningDetailScreen,
};
