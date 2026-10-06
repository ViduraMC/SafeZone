import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { allSeverityLevels, type SeverityLevel } from '@/core/hazard/SeverityLevel';
import type { AlertDraft } from '@/modules/alerts/application/AlertDraft';
import type { WarningPreview, WarningResult } from '@/modules/alerts/application/AlertService';
import type { TargetScope } from '@/modules/alerts/domain/TargetArea';
import { useSafeZone } from '../../AppContext';
import { Button, Card, ChipGroup, Field, Notice, Segmented, StatTile } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { formatDateTime, SEVERITY_LABELS } from '../../lib/format';
import { useAction } from '../../lib/useAction';

type Step = 'form' | 'review' | 'done';

function initialDraft(reportId: string | null, lookup: (id: string) => { hazardTypeCode: string; districtId: string } | undefined): AlertDraft {
  const report = reportId ? lookup(reportId) : undefined;
  return {
    hazardTypeCode: report?.hazardTypeCode ?? '',
    severity: '',
    title: '',
    description: '',
    targetScope: 'DISTRICT',
    targetIds: report ? [report.districtId] : [],
    validityHours: 24,
    supportingReportIds: reportId && report ? [reportId] : [],
  };
}

/** UC01 main flow steps 3-16, A2/A3 targeting, A4 channels, E1-E4. */
export function IssueWarningScreen() {
  const { app, user } = useSafeZone();
  const [params] = useSearchParams();
  const [step, setStep] = useState<Step>('form');
  const [draft, setDraft] = useState<AlertDraft>(() =>
    initialDraft(params.get('report'), (id) => {
      const r = app.alerts.dashboard().verifiedReports.find((v) => v.reportId === id);
      return r && { hazardTypeCode: r.hazardTypeCode, districtId: r.districtId };
    }),
  );
  const [preview, setPreview] = useState<WarningPreview>();
  const [result, setResult] = useState<WarningResult>();
  const action = useAction();
  const update = (patch: Partial<AlertDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    action.clearFields(...Object.keys(patch));
  };
  const errors = action.fieldErrors;

  const validate = async () => {
    const p = await action.run(() => app.alerts.preview(draft));
    if (p) {
      setPreview(p);
      setStep('review');
    }
  };

  const issue = async () => {
    const r = await action.run(() => app.alerts.issueWarning(draft, user));
    if (r) {
      setResult(r);
      setStep('done');
    }
  };

  const selectHazard = (code: string) => {
    const type = code ? app.hazardTypes.get(code) : undefined;
    update({ hazardTypeCode: code, severity: draft.severity || (type?.defaultSeverity ?? '') });
  };

  if (step === 'done' && result) {
    const { summary } = result;
    return (
      <Screen title="Warning issued">
        <Card tone="success">
          <p className="lead">Official hazard warning issued & stored</p>
          <p className="small">
            {result.alert.id} • {result.alert.title}
          </p>
        </Card>
        {result.noRecipientsFound && (
          <Notice tone="warning">No registered citizens were found in the selected area. The warning is stored; you can modify the affected area by issuing an updated warning.</Notice>
        )}
        <div className="stats">
          <StatTile label="Citizens targeted" value={summary.recipients} />
          <StatTile label="Reached" value={summary.reached} />
          <StatTile label="Queued for retry" value={summary.queued} />
        </div>
        <Card>
          <p className="small strong">Delivery by channel</p>
          <p className="small">
            Push: {summary.byChannel.PUSH.delivered} delivered, {summary.byChannel.PUSH.failed} failed
            <br />
            SMS: {summary.byChannel.SMS.delivered} delivered, {summary.byChannel.SMS.failed} failed
          </p>
        </Card>
        <Link className="btn btn--primary btn--block" to={`/warnings/${result.alert.id}`}>
          Monitor delivery
        </Link>
        <Link className="btn btn--secondary btn--block" to="/warnings">
          Back to dashboard
        </Link>
      </Screen>
    );
  }

  if (step === 'review' && preview) {
    return (
      <Screen title="Confirm warning" back>
        <Card tone="warning">
          <p className="caps small muted">{SEVERITY_LABELS[draft.severity as SeverityLevel]} • {app.hazardTypes.get(draft.hazardTypeCode).name}</p>
          <p className="lead">{draft.title}</p>
          <p className="small">{draft.description}</p>
        </Card>
        <Card>
          <ul className="checklist">
            <li>Target: {preview.areaDescription} ({preview.districtIds.map((id) => app.geo.districtName(id)).join(', ')})</li>
            <li>Registered citizens identified: {preview.recipientCount}</li>
            <li>Channels: {preview.channels.length > 0 ? preview.channels.join(' + ') : 'none'}{preview.audibleOverride ? ' + audible emergency override' : ''}</li>
            <li>Valid until {formatDateTime(preview.validUntil)}</li>
            {(draft.supportingReportIds?.length ?? 0) > 0 && <li>Supported by verified report {draft.supportingReportIds?.join(', ')}</li>}
          </ul>
        </Card>
        {preview.recipientCount === 0 && <Notice tone="warning">No registered citizens in this area (E3). You can go back and change the affected area.</Notice>}
        {action.error && <Notice tone="danger">{action.error}</Notice>}
        <Button block variant="danger" disabled={action.busy} onClick={issue}>
          {action.busy ? 'Broadcasting...' : 'Issue Warning'}
        </Button>
        <Button block variant="secondary" onClick={() => setStep('form')}>
          Edit
        </Button>
      </Screen>
    );
  }

  const districtOptions = app.geo.listDistricts().map((d) => ({ value: d.id, label: d.name }));
  return (
    <Screen title="Hazard Warning Form">
      {(draft.supportingReportIds?.length ?? 0) > 0 && <Notice tone="info">Based on verified report {draft.supportingReportIds?.join(', ')}.</Notice>}
      <Field label="Hazard type" error={errors.hazardTypeCode} htmlFor="hazard">
        <select id="hazard" value={draft.hazardTypeCode} onChange={(e) => selectHazard(e.target.value)}>
          <option value="">Select hazard type</option>
          {app.hazardTypes.list().map((t) => (
            <option key={t.code} value={t.code}>
              {t.name} ({t.onset === 'FAST' ? 'fast-onset' : 'slow-onset'})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Warning level" error={errors.severity}>
        <Segmented<SeverityLevel | ''>
          label="Warning level"
          value={draft.severity}
          onChange={(severity) => update({ severity })}
          options={allSeverityLevels().map((level) => ({ value: level, label: SEVERITY_LABELS[level] }))}
        />
      </Field>
      <Field label="Target scope">
        <Segmented<TargetScope>
          label="Target scope"
          value={draft.targetScope}
          onChange={(targetScope) => update({ targetScope, targetIds: [] })}
          options={[
            { value: 'DISTRICT', label: 'By District' },
            { value: 'RIVER_BASIN', label: 'By River Basin' },
          ]}
        />
      </Field>
      <Field label={draft.targetScope === 'DISTRICT' ? 'Affected districts' : 'Affected river basin'} error={errors.targetIds}>
        {draft.targetScope === 'DISTRICT' ? (
          <ChipGroup
            label="Affected districts"
            options={districtOptions}
            selected={draft.targetIds}
            onToggle={(id) => update({ targetIds: draft.targetIds.includes(id) ? draft.targetIds.filter((x) => x !== id) : [...draft.targetIds, id] })}
          />
        ) : (
          <select value={draft.targetIds[0] ?? ''} onChange={(e) => update({ targetIds: e.target.value ? [e.target.value] : [] })} aria-label="River basin">
            <option value="">Select river basin</option>
            {app.geo.listRiverBasins().map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.districtIds.map((id) => app.geo.districtName(id)).join(', ')})
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Headline" error={errors.title} htmlFor="title">
        <input id="title" value={draft.title} onChange={(e) => update({ title: e.target.value })} placeholder="e.g. Kelani River Basin Spillover" />
      </Field>
      <Field label="Description & required action" error={errors.description} htmlFor="desc">
        <textarea id="desc" rows={4} value={draft.description} onChange={(e) => update({ description: e.target.value })} />
      </Field>
      <Field label="Validity (hours)" error={errors.validityHours} htmlFor="validity" hint={draft.hazardTypeCode ? `Max ${app.hazardTypes.get(draft.hazardTypeCode).maxValidityHours} h for this hazard` : undefined}>
        <input id="validity" type="number" min={1} value={draft.validityHours} onChange={(e) => update({ validityHours: Number(e.target.value) })} />
      </Field>
      {action.error && <Notice tone="danger">{action.error}</Notice>}
      <Button block onClick={validate}>
        Validate & Review
      </Button>
    </Screen>
  );
}
