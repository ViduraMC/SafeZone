import { hasRole, Role, type UserAccount } from '@/core/users/UserAccount';
import type { IconName } from './components/Icon';

export interface Tab {
  readonly to: string;
  readonly label: string;
  readonly icon: IconName;
}

const HUB: Tab = { to: '/hub', label: 'Hub', icon: 'menu' };

/**
 * Role-based views of the single mobile app (system overview, section 1.5).
 * Officers get their own task-focused tabs instead of the citizen tabs that the
 * original wireframes reused for every use case.
 */
const TABS_BY_ROLE: readonly [Role, readonly Tab[]][] = [
  [Role.DMC_OFFICER, [
    { to: '/warnings', label: 'Warnings', icon: 'megaphone' },
    { to: '/warnings/new', label: 'Issue', icon: 'plus' },
    { to: '/alerts', label: 'Alerts', icon: 'bell' },
    HUB,
  ]],
  [Role.DUTY_OFFICER, [
    { to: '/review', label: 'Review', icon: 'check' },
    { to: '/review/history', label: 'Reviewed', icon: 'file' },
    { to: '/alerts', label: 'Alerts', icon: 'bell' },
    HUB,
  ]],
  [Role.DISTRICT_OFFICER, [
    { to: '/coordination', label: 'Overview', icon: 'grid' },
    { to: '/coordination/shelters', label: 'Shelters', icon: 'shelter' },
    { to: '/coordination/teams', label: 'Teams', icon: 'users' },
    { to: '/coordination/relief', label: 'Relief', icon: 'box' },
    HUB,
  ]],
  [Role.RESCUE_TEAM_MEMBER, [
    { to: '/rescue', label: 'Assignment', icon: 'rescue' },
    { to: '/alerts', label: 'Alerts', icon: 'bell' },
    HUB,
  ]],
  [Role.DMC_OFFICIAL, [
    { to: '/reports', label: 'Reports', icon: 'chart' },
    HUB,
  ]],
  [Role.DONOR_REPRESENTATIVE, [
    { to: '/reports', label: 'Reports', icon: 'chart' },
    HUB,
  ]],
  [Role.CITIZEN, [
    { to: '/', label: 'Home', icon: 'home' },
    { to: '/alerts', label: 'Alerts', icon: 'bell' },
    { to: '/report', label: 'Report', icon: 'alert' },
    { to: '/shelters', label: 'Shelters', icon: 'shelter' },
    HUB,
  ]],
];

export function tabsFor(user: UserAccount): readonly Tab[] {
  const match = TABS_BY_ROLE.find(([role]) => hasRole(user, role));
  return match ? match[1] : [HUB];
}

export function homeRouteFor(user: UserAccount): string {
  return tabsFor(user)[0].to;
}
