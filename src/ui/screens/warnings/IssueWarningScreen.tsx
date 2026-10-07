import { useState } from 'react';
import { allSeverityLevels, type SeverityLevel } from '@/core/hazard/SeverityLevel';
import type { AlertDraft } from '@/modules/alerts/application/AlertDraft';
import type { WarningPreview, WarningResult } from '@/modules/alerts/application/AlertService';
import type { TargetScope } from '@/modules/alerts/domain/TargetArea';
import { useSafeZone } from '../../AppContext';
import { Button, Card, ChipGroup, Field, Notice, NumberField, Segmented, SelectField, StatTile, Stats, TextField, Txt } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { formatDateTime, SEVERITY_LABELS } from '../../lib/format';
import { useAction } from '../../lib/useAction';
import { useNav, useParam } from '../../lib/useNav';

type Step = 'form' | 'review' | 'done';

function initialDraft(reportId: string, lookup: (id: string) => { hazardTypeCode: string; districtId: string } | undefined): AlertDraft {
  const report = reportId ? lookup(reportId) : undefined;
  return {
    hazardTypeCode: report?.hazardTypeCode ?? '',
    severity: '',
    title: '',
    description: '',
    targetScope: 'DISTRICT',
    targetIds: report ? [report.districtId] : [],
    validityHours: 24,
    supportingReportIds: report ? [reportId] : [],
  };
}

/** UC01 main flow steps 3-16, A2/A3 targeting, A4 channels, E1-E4. */
export function IssueWarningScreen() {
  const { app, user } = useSafeZone();
  const nav = useNav();
  const reportId = useParam('report');
  const [step, setStep] = useState<Step>('form');
  const [draft, setDraft] = useState<AlertDraft>(() =>
    initialDraft(reportId, (id) => {
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
    const type = app.hazardTypes.get(code);
    update({ hazardTypeCode: code, severity: draft.severity || type.defaultSeverity });
  };

  if (step === 'done' && result) {
    const { summary } = result;
    return (
      <Screen title="Warning issued">
        <Card tone="success">
          <Txt lead>Official hazard warning issued and stored</Txt>
          <Txt small>
            {result.alert.id} • {result.alert.title}
          </Txt>
        </Card>
        {result.noRecipientsFound && (
          <Notice tone="warning">No registered citizens were found in the selected area. The warning is stored; you can change the affected area by issuing an updated warning.</Notice>
        )}
        <Stats>
          <StatTile label="Citizens targeted" value={summary.recipients} />
          <StatTile label="Reached" value={summary.reached} />
          <StatTile label="Queued for retry" value={summary.queued} />
        </Stats>
        <Card>
          <Txt small strong>Delivery by channel</Txt>
          <Txt small>
            Push: {summary.byChannel.PUSH.delivered} delivered, {summary.byChannel.PUSH.failed} failed
          </Txt>
          <Txt small>
            SMS: {summary.byChannel.SMS.delivered} delivered, {summary.byChannel.SMS.failed} failed
          </Txt>
        </Card>
        <Button block onPress={() => nav.go(`/warnings/${result.alert.id}`)}>Monitor delivery</Button>
        <Button block variant="secondary" onPress={() => nav.resetTo('/warnings')}>Back to dashboard</Button>
      </Screen>
    );
  }

  if (step === 'review' && preview) {
    return (
      <Screen title="Confirm warning">
        <Card tone="warning">
          <Txt caps small muted>
            {SEVERITY_LABELS[draft.severity as SeverityLevel]} • {app.hazardTypes.get(draft.hazardTypeCode).name}
          </Txt>
          <Txt lead>{draft.title}</Txt>
          <Txt small>{draft.description}</Txt>
        </Card>
        <Card>
          <Txt small>• Target: {preview.areaDescription} ({preview.districtIds.map((id) => app.geo.districtName(id)).join(', ')})</Txt>
          <Txt small>• Registered citizens identified: {preview.recipientCount}</Txt>
          <Txt small>
            • Channels: {preview.channels.length > 0 ? preview.channels.join(' + ') : 'none'}
            {preview.audibleOverride ? ' + audible emergency override' : ''}
          </Txt>
          <Txt small>• Valid until {formatDateTime(preview.validUntil)}</Txt>
          {(draft.supportingReportIds?.length ?? 0) > 0 && <Txt small>• Supported by verified report {draft.supportingReportIds?.join(', ')}</Txt>}
        </Card>
        {preview.recipientCount === 0 && <Notice tone="warning">No registered citizens in this area (E3). You can go back and change the affected area.</Notice>}
        {action.error && <Notice tone="danger">{action.error}</Notice>}
        <Button block variant="danger" disabled={action.busy} onPress={() => void issue()}>
          {action.busy ? 'Broadcasting...' : 'Issue Warning'}
        </Button>
        <Button block variant="secondary" onPress={() => setStep('form')}>Edit</Button>
      </Screen>
    );
  }

  const districtOptions = app.geo.listDistricts().map((d) => ({ value: d.id, label: d.name }));
  return (
    <Screen title="Hazard Warning Form">
      {(draft.supportingReportIds?.length ?? 0) > 0 && <Notice tone="info">{`Based on verified report ${draft.supportingReportIds?.join(', ')}.`}</Notice>}
      <Field label="Hazard type" error={errors.hazardTypeCode}>
        <SelectField
          label="Hazard type"
          placeholder="Select hazard type"
          value={draft.hazardTypeCode}
          invalid={!!errors.hazardTypeCode}
          onChange={selectHazard}
          options={app.hazardTypes.list().map((t) => ({ value: t.code, label: `${t.name} (${t.onset === 'FAST' ? 'fast-onset' : 'slow-onset'})` }))}
        />
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
          <SelectField
            label="River basin"
            placeholder="Select river basin"
            value={draft.targetIds[0] ?? ''}
            invalid={!!errors.targetIds}
            onChange={(id) => update({ targetIds: [id] })}
            options={app.geo.listRiverBasins().map((b) => ({ value: b.id, label: `${b.name} (${b.districtIds.map((id) => app.geo.districtName(id)).join(', ')})` }))}
          />
        )}
      </Field>
      <Field label="Headline" error={errors.title}>
        <TextField label="Headline" value={draft.title} invalid={!!errors.title} onChangeText={(title) => update({ title })} placeholder="e.g. Kelani River Basin Spillover" />
      </Field>
      <Field label="Description and required action" error={errors.description}>
        <TextField label="Description and required action" multiline value={draft.description} invalid={!!errors.description} onChangeText={(description) => update({ description })} />
      </Field>
      <Field
        label="Validity (hours)"
        error={errors.validityHours}
        hint={draft.hazardTypeCode ? `Max ${app.hazardTypes.get(draft.hazardTypeCode).maxValidityHours} h for this hazard` : undefined}
      >
        <NumberField label="Validity (hours)" value={draft.validityHours} invalid={!!errors.validityHours} onChange={(validityHours) => update({ validityHours })} />
      </Field>
      {action.error && <Notice tone="danger">{action.error}</Notice>}
      <Button block onPress={() => void validate()}>Validate & Review</Button>
    </Screen>
  );
}
