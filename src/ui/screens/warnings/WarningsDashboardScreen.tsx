import { Link } from 'react-router-dom';
import { useSafeZone } from '../../AppContext';
import { Icon } from '../../components/Icon';
import { Button, Card, EmptyState, Notice, SectionTitle, SeverityBadge, StatTile } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { timeAgo, timeUntil } from '../../lib/format';
import { useAction } from '../../lib/useAction';

/** UC01 steps 1-2: hazard warning dashboard with verified ground reports (duty officer input). */
export function WarningsDashboardScreen() {
  const { app } = useSafeZone();
  const { activeAlerts, verifiedReports } = app.alerts.dashboard();
  const queued = app.alerts.queuedDeliveryCount();
  const retry = useAction();
  const now = app.clock.now();

  return (
    <Screen title="Hazard Warning Dashboard" subtitle="Disaster Management Centre">
      <div className="stats">
        <StatTile label="Active warnings" value={activeAlerts.length} />
        <StatTile label="Verified reports" value={verifiedReports.length} />
        <StatTile label="Queued deliveries" value={queued} />
      </div>
      {queued > 0 && (
        <Notice tone="warning">
          {queued} recipient{queued === 1 ? ' is' : 's are'} still waiting for a warning (channel outage).{' '}
          <button type="button" className="link-btn" disabled={retry.busy} onClick={() => retry.run(() => app.alerts.retryQueuedDeliveries())}>
            Retry now
          </button>
        </Notice>
      )}
      <Link to="/warnings/new" className="btn btn--primary btn--block">
        <Icon name="plus" size={18} /> Create Hazard Warning
      </Link>

      <SectionTitle>Active warnings</SectionTitle>
      {activeAlerts.length === 0 && <EmptyState title="No active warnings" />}
      {activeAlerts.map((alert) => {
        const summary = app.alerts.deliverySummary(alert.id);
        return (
          <Link key={alert.id} to={`/warnings/${alert.id}`} className={`list-card list-card--${alert.severity.toLowerCase()}`}>
            <div className="list-card__top">
              <SeverityBadge severity={alert.severity} />
              <span className="muted small">expires in {timeUntil(alert.validUntil, now)}</span>
            </div>
            <p className="list-card__title">{alert.title}</p>
            <p className="muted small">
              {alert.target.describe(app.geo)} • reached {summary.reached}/{summary.recipients}
              {summary.queued > 0 && ` • ${summary.queued} queued`}
            </p>
          </Link>
        );
      })}

      <SectionTitle>Verified ground reports</SectionTitle>
      {verifiedReports.length === 0 && <p className="muted small">No verified reports yet.</p>}
      {verifiedReports.map((report) => (
        <Card key={report.reportId}>
          <div className="list-card__top">
            <span className="small strong">
              {app.hazardTypes.get(report.hazardTypeCode).name} • {app.geo.districtName(report.districtId)}
            </span>
            <span className="muted small">{timeAgo(report.verifiedAt, now)}</span>
          </div>
          <p className="small">{report.summary}</p>
          <p className="muted small">
            Credibility {report.credibilityScore}/5 • verified by {app.users.get(report.verifiedBy).name}
          </p>
          <Link to={`/warnings/new?report=${report.reportId}`}>
            <Button variant="ghost">Issue warning from this report</Button>
          </Link>
        </Card>
      ))}
    </Screen>
  );
}
