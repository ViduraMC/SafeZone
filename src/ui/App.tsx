import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { isAlertRecipient } from '@/core/users/UserAccount';
import { useSafeZone } from './AppContext';
import { homeRouteFor } from './navigation';
import { AlertDetailScreen } from './screens/warnings/AlertDetailScreen';
import { AlertsScreen } from './screens/warnings/AlertsScreen';
import { HomeScreen } from './screens/common/HomeScreen';
import { ShelterDetailScreen, SheltersScreen } from './screens/shelters/SheltersScreen';
import { CoordinationOverviewScreen } from './screens/shelters/CoordinationOverviewScreen';
import { CoordinationScopeProvider } from './screens/common/CoordinationScope';
import { ReliefScreen } from './screens/dispatch/ReliefScreen';
import { RegisterShelterScreen, ShelterListScreen, ShelterManageScreen } from './screens/shelters/ShelterScreens';
import { TeamsScreen } from './screens/dispatch/TeamsScreen';
import { HubScreen } from './screens/common/HubScreen';
import { ReportIncidentScreen } from './screens/reports/ReportIncidentScreen';
import { MyReportDetailScreen, MyReportsScreen } from './screens/reports/ReportViews';
import { ReviewDetailScreen, ReviewHistoryScreen, ReviewQueueScreen } from './screens/reports/ReviewScreens';
import { RescueAssignmentScreen } from './screens/dispatch/RescueAssignmentScreen';
import { ReportsScreen } from './screens/analytics/ReportsScreen';
import { IssueWarningScreen } from './screens/warnings/IssueWarningScreen';
import { WarningDetailScreen } from './screens/warnings/WarningDetailScreen';
import { WarningsDashboardScreen } from './screens/warnings/WarningsDashboardScreen';

function Home() {
  const { user } = useSafeZone();
  return isAlertRecipient(user) ? <HomeScreen /> : <Navigate to={homeRouteFor(user)} replace />;
}

export function AppRoutes() {
  const { user } = useSafeZone();
  return (
    <CoordinationScopeProvider key={user.id}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/hub" element={<HubScreen />} />
        {/* UC01 - Issue Hazard Warning */}
        <Route path="/alerts" element={<AlertsScreen />} />
        <Route path="/alerts/:alertId" element={<AlertDetailScreen />} />
        <Route path="/warnings" element={<WarningsDashboardScreen />} />
        <Route path="/warnings/new" element={<IssueWarningScreen />} />
        <Route path="/warnings/:alertId" element={<WarningDetailScreen />} />
        {/* UC02 - Submit & Verify Hazard Report */}
        <Route path="/report" element={<ReportIncidentScreen />} />
        <Route path="/my-reports" element={<MyReportsScreen />} />
        <Route path="/my-reports/:reportId" element={<MyReportDetailScreen />} />
        <Route path="/review" element={<ReviewQueueScreen />} />
        <Route path="/review/history" element={<ReviewHistoryScreen />} />
        <Route path="/review/:reportId" element={<ReviewDetailScreen />} />
        {/* UC03 - Coordinate Emergency Shelters */}
        <Route path="/shelters" element={<SheltersScreen />} />
        <Route path="/shelters/:shelterId" element={<ShelterDetailScreen />} />
        <Route path="/coordination" element={<CoordinationOverviewScreen />} />
        <Route path="/coordination/shelters" element={<ShelterListScreen />} />
        <Route path="/coordination/shelters/new" element={<RegisterShelterScreen />} />
        <Route path="/coordination/shelters/:shelterId" element={<ShelterManageScreen />} />
        {/* UC04 - Dispatch Rescue Teams & Relief Resources */}
        <Route path="/coordination/teams" element={<TeamsScreen />} />
        <Route path="/coordination/relief" element={<ReliefScreen />} />
        <Route path="/rescue" element={<RescueAssignmentScreen />} />
        {/* UC05 - Generate Disaster Response Reports */}
        <Route path="/reports" element={<ReportsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </CoordinationScopeProvider>
  );
}

export function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
