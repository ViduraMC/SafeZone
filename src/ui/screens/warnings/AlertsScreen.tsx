import { useState } from 'react';
import { isAlertRecipient } from '@/core/users/UserAccount';
import type { HazardAlert } from '@/modules/alerts/domain/HazardAlert';
import { useSafeZone } from '../../AppContext';
import { EmptyState, ListCard, Row, Segmented, SeverityBadge, severityTone, Txt } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { timeAgo } from '../../lib/format';
import { useNav } from '../../lib/useNav';

/** "Active Warnings" list (UC01 hi-fi wireframe). Citizens see their district; officers see all. */
export function AlertsScreen() {
  const { app, user } = useSafeZone();
  const nav = useNav();
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
        <ListCard key={alert.id} label={alert.title} accent={severityTone(alert.severity)} onPress={() => nav.go(`/alerts/${alert.id}`)}>
          <Row>
            <SeverityBadge severity={alert.severity} />
            <Txt small muted>{alert.issuedAt ? timeAgo(alert.issuedAt, app.clock.now()) : ''}</Txt>
          </Row>
          <Txt strong>{alert.title}</Txt>
          <Txt small muted>Affected Area: {alert.target.describe(app.geo)}</Txt>
        </ListCard>
      ))}
    </Screen>
  );
}
