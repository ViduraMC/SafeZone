import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SeverityLevel } from '@/core/hazard/SeverityLevel';
import { REPORT_STATUS_LABELS } from '@/modules/reports/domain/ReportStatus';
import { useSafeZone } from '../../AppContext';
import { Icon } from '../../components/Icon';
import { Badge, Button, Card, SectionTitle, SeverityBadge } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { timeAgo } from '../../lib/format';

/** Citizen home: the critical alert takeover from the UC01 hi-fi wireframe, or a calm summary. */
export function HomeScreen() {
  const { app, user } = useSafeZone();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<readonly string[]>([]);
  const { active } = app.alerts.listForDistrict(user.homeDistrictId);
  const critical = active.find((alert) => alert.severity === SeverityLevel.EMERGENCY && !dismissed.includes(alert.id));
  const myReports = app.reportSubmission.myReports(user.id).slice(0, 3);
  const district = app.geo.districtName(user.homeDistrictId);

  if (critical) {
    return (
      <div className="takeover" role="alertdialog" aria-labelledby="critical-title">
        <div className="takeover__icon">
          <Icon name="alert" size={56} />
        </div>
        <h1 id="critical-title">CRITICAL ALERT</h1>
        <p className="takeover__headline">{critical.title}</p>
        <p className="takeover__body">{critical.description}</p>
        <Button variant="secondary" block onClick={() => navigate('/shelters')}>
          <Icon name="pin" size={18} /> Find Nearest Shelter
        </Button>
        <a className="btn btn--outline-light btn--block" href="tel:119">
          <Icon name="phone" size={18} /> Call Emergency: 119
        </a>
        <button type="button" className="takeover__dismiss" onClick={() => setDismissed([...dismissed, critical.id])}>
          Dismiss Alert
        </button>
      </div>
    );
  }

  return (
    <Screen title={`Hello, ${user.name.split(' ')[0]}`} subtitle={`${district} District`}>
      <Card tone={active.length > 0 ? 'warning' : 'success'}>
        <p className="lead">{active.length > 0 ? `${active.length} active warning${active.length > 1 ? 's' : ''} for your area` : 'No active warnings for your area'}</p>
        {active.slice(0, 2).map((alert) => (
          <Link key={alert.id} to={`/alerts/${alert.id}`} className="row-link">
            <SeverityBadge severity={alert.severity} /> <span>{alert.title}</span>
          </Link>
        ))}
      </Card>

      <div className="quick-actions">
        <Button variant="primary" onClick={() => navigate('/report')}>
          <Icon name="alert" size={18} /> Report a hazard
        </Button>
        <Button variant="secondary" onClick={() => navigate('/shelters')}>
          <Icon name="shelter" size={18} /> Find shelter
        </Button>
      </div>

      <SectionTitle action={<Link to="/my-reports">See all</Link>}>My reports</SectionTitle>
      {myReports.length === 0 && <p className="muted">You have not submitted any hazard reports.</p>}
      {myReports.map((report) => (
        <Link key={report.id} to={`/my-reports/${report.id}`} className="list-card">
          <div className="list-card__top">
            <Badge tone="neutral">{REPORT_STATUS_LABELS[report.status]}</Badge>
            <span className="muted small">{timeAgo(report.submittedAt, app.clock.now())}</span>
          </div>
          <p className="list-card__title">{app.hazardTypes.get(report.hazardTypeCode).name} - {report.location.label}</p>
        </Link>
      ))}
    </Screen>
  );
}
