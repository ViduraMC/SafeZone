import { useSafeZone } from '../../AppContext';
import { Button, Card, EmptyState, ListCard, Notice, Row, SectionTitle, SeverityBadge, severityTone, StatTile, Stats, Txt } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { timeAgo, timeUntil } from '../../lib/format';
import { useAction } from '../../lib/useAction';
import { useNav } from '../../lib/useNav';

/** UC01 steps 1-2: hazard warning dashboard with verified ground reports (duty officer input). */
export function WarningsDashboardScreen() {
  const { app } = useSafeZone();
  const nav = useNav();
  const { activeAlerts, verifiedReports } = app.alerts.dashboard();
  const queued = app.alerts.queuedDeliveryCount();
  const retry = useAction();
  const now = app.clock.now();

  return (
    <Screen title="Hazard Warning Dashboard" subtitle="Disaster Management Centre">
      <Stats>
        <StatTile label="Active warnings" value={activeAlerts.length} />
        <StatTile label="Verified reports" value={verifiedReports.length} />
        <StatTile label="Queued deliveries" value={queued} />
      </Stats>
      {queued > 0 && (
        <Notice tone="warning">
          <Txt small>
            {queued} recipient{queued === 1 ? ' is' : 's are'} still waiting for a warning (channel outage).
          </Txt>
          <Button variant="ghost" disabled={retry.busy} onPress={() => void retry.run(() => app.alerts.retryQueuedDeliveries())}>
            Retry now
          </Button>
        </Notice>
      )}
      <Button icon="plus" block onPress={() => nav.go('/warnings/new')}>Create Hazard Warning</Button>

      <SectionTitle>Active warnings</SectionTitle>
      {activeAlerts.length === 0 && <EmptyState title="No active warnings" />}
      {activeAlerts.map((alert) => {
        const summary = app.alerts.deliverySummary(alert.id);
        return (
          <ListCard key={alert.id} label={alert.title} accent={severityTone(alert.severity)} onPress={() => nav.go(`/warnings/${alert.id}`)}>
            <Row>
              <SeverityBadge severity={alert.severity} />
              <Txt small muted>expires in {timeUntil(alert.validUntil, now)}</Txt>
            </Row>
            <Txt strong>{alert.title}</Txt>
            <Txt small muted>
              {alert.target.describe(app.geo)} • reached {summary.reached}/{summary.recipients}
              {summary.queued > 0 ? ` • ${summary.queued} queued` : ''}
            </Txt>
          </ListCard>
        );
      })}

      <SectionTitle>Verified ground reports</SectionTitle>
      {verifiedReports.length === 0 && <Txt small muted>No verified reports yet.</Txt>}
      {verifiedReports.map((report) => (
        <Card key={report.reportId}>
          <Row>
            <Txt small strong>
              {app.hazardTypes.get(report.hazardTypeCode).name} • {app.geo.districtName(report.districtId)}
            </Txt>
            <Txt small muted>{timeAgo(report.verifiedAt, now)}</Txt>
          </Row>
          <Txt small>{report.summary}</Txt>
          <Txt small muted>
            Credibility {report.credibilityScore}/5 • verified by {app.users.get(report.verifiedBy).name}
          </Txt>
          <Button variant="ghost" onPress={() => nav.go(`/warnings/new?report=${report.reportId}`)}>
            Issue warning from this report
          </Button>
        </Card>
      ))}
    </Screen>
  );
}
