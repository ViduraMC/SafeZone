import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { allSeverityLevels, isHigherSeverity, type SeverityLevel } from '@/core/hazard/SeverityLevel';
import { useSafeZone } from '../../AppContext';
import { Button, Card, ChipGroup, Field, Notice, SectionTitle, SeverityBadge, StatTile } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { formatDateTime, SEVERITY_LABELS, timeUntil } from '../../lib/format';
import { useAction } from '../../lib/useAction';

/** Delivery monitoring (UC01 step 15-16) plus A1 "Escalate Existing Warning" and resolve. */
export function WarningDetailScreen() {
  const { alertId = '' } = useParams();
  const { app, user } = useSafeZone();
  const alert = app.alerts.getAlert(alertId);
  const summary = app.alerts.deliverySummary(alert.id);
  const higher = allSeverityLevels().filter((level) => isHigherSeverity(level, alert.severity));
  const [level, setLevel] = useState<SeverityLevel | ''>(higher[0] ?? '');
  const [reason, setReason] = useState('');
  const [reports, setReports] = useState<string[]>([]);
  const action = useAction();
  const now = app.clock.now();
  const live = alert.isActiveAt(now);
  const verified = app.alerts.dashboard().verifiedReports.filter((r) => alert.target.resolveDistrictIds(app.geo).includes(r.districtId));

  const escalate = async () => {
    const done = await action.run(() => {
      if (!level) throw new Error('Select a level');
      return app.alerts.escalateWarning(alert.id, level, reason, user, reports);
    });
    if (done) setReason('');
  };

  return (
    <Screen title="Warning monitoring" back="/warnings">
      <div className="detail-head">
        <SeverityBadge severity={alert.severity} />
        <span className="muted small">{live ? `Active • expires in ${timeUntil(alert.validUntil, now)}` : alert.status}</span>
      </div>
      <h2 className="detail-title">{alert.title}</h2>
      <p className="muted small">
        {alert.id} • {alert.target.describe(app.geo)} • issued {alert.issuedAt && formatDateTime(alert.issuedAt)}
      </p>

      <div className="stats">
        <StatTile label="Targeted" value={summary.recipients} />
        <StatTile label="Reached" value={summary.reached} />
        <StatTile label="Queued" value={summary.queued} />
      </div>
      <Card>
        <p className="small">
          Push delivered: <strong>{summary.deliveredByChannel.PUSH}</strong> • SMS delivered: <strong>{summary.deliveredByChannel.SMS}</strong> • Failed attempts:{' '}
          <strong>{summary.failedAttempts}</strong>
        </p>
      </Card>

      {alert.escalations.length > 0 && (
        <>
          <SectionTitle>Escalation history</SectionTitle>
          {alert.escalations.map((e) => (
            <p key={e.at.toISOString()} className="small">
              {formatDateTime(e.at)}: {SEVERITY_LABELS[e.from]} → {SEVERITY_LABELS[e.to]} - {e.reason}
            </p>
          ))}
        </>
      )}

      {live && higher.length > 0 && (
        <Card tone="warning">
          <p className="strong">Escalate warning level</p>
          <Field label="New level">
            <ChipGroup<SeverityLevel>
              label="New level"
              options={higher.map((l) => ({ value: l, label: SEVERITY_LABELS[l] }))}
              selected={level ? [level] : []}
              onToggle={setLevel}
            />
          </Field>
          <Field label="Reason for escalation" htmlFor="reason">
            <textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {verified.length > 0 && (
            <Field label="Supporting verified reports">
              <ChipGroup
                label="Supporting reports"
                options={verified.map((r) => ({ value: r.reportId, label: `${r.reportId} (${app.geo.districtName(r.districtId)})` }))}
                selected={reports}
                onToggle={(id) => setReports(reports.includes(id) ? reports.filter((x) => x !== id) : [...reports, id])}
              />
            </Field>
          )}
          {action.error && <Notice tone="danger">{action.error}</Notice>}
          <Button block variant="danger" disabled={action.busy} onClick={escalate}>
            Escalate & re-broadcast
          </Button>
        </Card>
      )}
      {live && (
        <Button block variant="secondary" onClick={() => action.run(() => app.alerts.resolveWarning(alert.id, user))}>
          Mark as resolved
        </Button>
      )}
    </Screen>
  );
}
