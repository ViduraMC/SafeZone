import { useState } from 'react';
import { allSeverityLevels, isHigherSeverity, type SeverityLevel } from '@/core/hazard/SeverityLevel';
import { useSafeZone } from '../../AppContext';
import { Button, Card, ChipGroup, Field, Notice, Row, SectionTitle, SeverityBadge, StatTile, Stats, TextField, Title, Txt } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { formatDateTime, SEVERITY_LABELS, timeUntil } from '../../lib/format';
import { useAction } from '../../lib/useAction';
import { useParam } from '../../lib/useNav';

/** Delivery monitoring (UC01 steps 15-16) plus A1 "Escalate Existing Warning" and resolve. */
export function WarningDetailScreen() {
  const alertId = useParam('alertId');
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
      <Row>
        <SeverityBadge severity={alert.severity} />
        <Txt small muted>{live ? `Active • expires in ${timeUntil(alert.validUntil, now)}` : alert.status}</Txt>
      </Row>
      <Title>{alert.title}</Title>
      <Txt small muted>
        {alert.id} • {alert.target.describe(app.geo)} • issued {alert.issuedAt ? formatDateTime(alert.issuedAt) : ''}
      </Txt>

      <Stats>
        <StatTile label="Targeted" value={summary.recipients} />
        <StatTile label="Reached" value={summary.reached} />
        <StatTile label="Queued" value={summary.queued} />
      </Stats>
      <Card>
        <Txt small>
          Push delivered: {summary.deliveredByChannel.PUSH} • SMS delivered: {summary.deliveredByChannel.SMS} • Failed attempts: {summary.failedAttempts}
        </Txt>
      </Card>

      {alert.escalations.length > 0 && <SectionTitle>Escalation history</SectionTitle>}
      {alert.escalations.map((e) => (
        <Txt key={e.at.toISOString()} small>
          {formatDateTime(e.at)}: {SEVERITY_LABELS[e.from]} → {SEVERITY_LABELS[e.to]}. {e.reason}
        </Txt>
      ))}

      {live && higher.length > 0 && (
        <Card tone="warning">
          <Txt strong>Escalate warning level</Txt>
          <Field label="New level">
            <ChipGroup<SeverityLevel> label="New level" options={higher.map((l) => ({ value: l, label: SEVERITY_LABELS[l] }))} selected={level ? [level] : []} onToggle={setLevel} />
          </Field>
          <Field label="Reason for escalation">
            <TextField label="Reason for escalation" multiline value={reason} onChangeText={setReason} />
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
          <Button block variant="danger" disabled={action.busy} onPress={() => void escalate()}>
            Escalate & re-broadcast
          </Button>
        </Card>
      )}
      {live && (
        <Button block variant="secondary" onPress={() => void action.run(() => app.alerts.resolveWarning(alert.id, user))}>
          Mark as resolved
        </Button>
      )}
    </Screen>
  );
}
