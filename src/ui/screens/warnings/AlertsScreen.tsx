import { useState } from 'react';
import { Link } from 'react-router-dom';
import { isAlertRecipient } from '@/core/users/UserAccount';
import type { HazardAlert } from '@/modules/alerts/domain/HazardAlert';
import { useSafeZone } from '../../AppContext';
import { EmptyState, Segmented, SeverityBadge } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { timeAgo } from '../../lib/format';

/** "Active Warnings" list (UC01 hi-fi wireframe). Citizens see their district; officers see all. */
export function AlertsScreen() {
  const { app, user } = useSafeZone();
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const lists = isAlertRecipient(user)
    ? app.alerts.listForDistrict(user.homeDistrictId)
    : { active: app.alerts.listActive(), archived: app.alerts.listArchived() };
  const shown: HazardAlert[] = lists[tab];

  return (
    <Screen title="Active Warnings">
      <Segmented<'active' | 'archived'>
        label="Alert lists"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: `Active (${lists.active.length})` },
          { value: 'archived', label: 'Archived' },
        ]}
      />
      {shown.length === 0 && <EmptyState title={tab === 'active' ? 'No active warnings' : 'No archived warnings'} />}
      {shown.map((alert) => (
        <Link key={alert.id} to={`/alerts/${alert.id}`} className={`list-card list-card--${alert.severity.toLowerCase()}`}>
          <div className="list-card__top">
            <SeverityBadge severity={alert.severity} />
            <span className="muted small">{alert.issuedAt ? timeAgo(alert.issuedAt, app.clock.now()) : ''}</span>
          </div>
          <p className="list-card__title">{alert.title}</p>
          <p className="muted small">Affected Area: {alert.target.describe(app.geo)}</p>
        </Link>
      ))}
    </Screen>
  );
}
