import { useNavigate, useParams } from 'react-router-dom';
import { useSafeZone } from '../../AppContext';
import { Badge, Button, Card, SectionTitle, SeverityBadge } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { formatDateTime, SEVERITY_LABELS, timeUntil } from '../../lib/format';

export function AlertDetailScreen() {
  const { alertId = '' } = useParams();
  const { app } = useSafeZone();
  const navigate = useNavigate();
  const alert = app.alerts.getAlert(alertId);
  const now = app.clock.now();
  const active = alert.isActiveAt(now);
  const districts = alert.target.resolveDistrictIds(app.geo);

  const share = () => {
    const text = `${alert.title} - ${alert.target.describe(app.geo)}. ${alert.description}`;
    if (navigator.share) void navigator.share({ title: 'SafeZone alert', text });
    else void navigator.clipboard?.writeText(text);
  };

  return (
    <Screen title="Warning details" back>
      <div className="detail-head">
        <SeverityBadge severity={alert.severity} />
        <span className="muted small">{active ? `Active • Expires in ${timeUntil(alert.validUntil, now)}` : `Ended • ${alert.status}`}</span>
      </div>
      <h2 className="detail-title">{alert.title}</h2>
      <p className="muted small">
        Issued by: <strong>Disaster Management Centre</strong>
        <br />
        Time: <strong>{alert.issuedAt ? formatDateTime(alert.issuedAt) : '-'}</strong>
        {' • '}
        {app.hazardTypes.get(alert.hazardTypeCode).name}
      </p>

      <SectionTitle>Affected regions</SectionTitle>
      <div className="chips">
        {alert.target.scope === 'RIVER_BASIN' && <Badge tone="info">{alert.target.describe(app.geo)}</Badge>}
        {districts.map((id) => (
          <span key={id} className="chip chip--static">{app.geo.districtName(id)} District</span>
        ))}
      </div>

      <Card>
        <p>{alert.description}</p>
      </Card>

      {alert.escalations.length > 0 && (
        <>
          <SectionTitle>Updates</SectionTitle>
          {alert.escalations.map((e) => (
            <Card key={e.at.toISOString()} tone="warning">
              <p className="small">
                <strong>{formatDateTime(e.at)}</strong> - raised from {SEVERITY_LABELS[e.from]} to {SEVERITY_LABELS[e.to]}
              </p>
              <p className="small">{e.reason}</p>
            </Card>
          ))}
        </>
      )}

      <div className="button-row">
        <Button onClick={() => navigate('/shelters')}>Find Nearest Shelter</Button>
        <Button variant="secondary" onClick={share}>Share Alert</Button>
      </div>
    </Screen>
  );
}
