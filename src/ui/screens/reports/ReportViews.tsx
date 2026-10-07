import { useState } from 'react';
import { Role, hasRole } from '@/core/users/UserAccount';
import type { GroundReport } from '@/modules/reports/domain/GroundReport';
import { REPORT_STATUS_LABELS, ReportStatus } from '@/modules/reports/domain/ReportStatus';
import { useSafeZone } from '../../AppContext';
import { EvidenceImage } from '../../components/EvidenceImage';
import { Badge, Button, Card, EmptyState, Field, KeyValue, LinkText, ListCard, Notice, Row, SectionTitle, TextField, Title, Txt, type BadgeTone } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { formatDateTime, timeAgo } from '../../lib/format';
import { useAction } from '../../lib/useAction';
import { useNav, useParam } from '../../lib/useNav';

const STATUS_TONE: Readonly<Record<ReportStatus, BadgeTone>> = {
  [ReportStatus.PENDING_SYNC]: 'watch',
  [ReportStatus.PENDING_VERIFICATION]: 'info',
  [ReportStatus.NEEDS_MORE_INFO]: 'warning',
  [ReportStatus.VERIFIED]: 'success',
  [ReportStatus.REJECTED]: 'critical',
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{REPORT_STATUS_LABELS[status].toUpperCase()}</Badge>;
}

/** Shared read-only body of a report (used by reporter and duty officer screens). */
export function ReportBody({ report }: { report: GroundReport }) {
  const { app } = useSafeZone();
  const reporter = app.users.get(report.reporterId);
  const hazard = app.hazardTypes.get(report.hazardTypeCode).name;
  return (
    <>
      <Row>
        <Badge tone="info">{hazard.toUpperCase()}</Badge>
        <ReportStatusBadge status={report.status} />
      </Row>
      <Txt small muted>Reported {timeAgo(report.submittedAt, app.clock.now())}</Txt>
      <Title>
        {hazard} - {report.location.label}
      </Title>
      <Txt small>
        <Txt small strong>{reporter.name}</Txt>{' '}
        <Txt small muted>{report.reporterKind === 'VOLUNTEER' ? `Community Volunteer (${reporter.volunteer?.trainingLevel.toLowerCase()} training)` : 'Citizen'}</Txt>
      </Txt>
      {report.evidence.map((photo) => (photo.previewUrl ? <EvidenceImage key={photo.id} uri={photo.previewUrl} /> : null))}
      <Card>
        <Txt caps small muted>Reporter description</Txt>
        <Txt>{report.description}</Txt>
      </Card>
      {report.supplements.map((s) => (
        <Card key={s.at.toISOString()} tone="info">
          <Txt caps small muted>Additional information • {formatDateTime(s.at)}</Txt>
          <Txt>{s.text}</Txt>
        </Card>
      ))}
      <Card>
        <KeyValue
          rows={[
            ['Severity assessment', report.severityAssessment],
            [
              'Location',
              <Txt key="loc">
                {report.location.label} ({app.geo.districtName(report.location.districtId)}) • {report.location.source}
                {'\n'}
                <Txt small muted>
                  {report.location.latitude.toFixed(4)}, {report.location.longitude.toFixed(4)}
                </Txt>
              </Txt>,
            ],
            ['Submitted', formatDateTime(report.submittedAt)],
          ]}
        />
      </Card>
    </>
  );
}

function ReviewHistory({ report }: { report: GroundReport }) {
  const { app } = useSafeZone();
  if (report.reviews.length === 0) return null;
  return (
    <>
      <SectionTitle>Duty officer decisions</SectionTitle>
      {report.reviews.map((review) => (
        <Card key={review.at.toISOString()} tone={review.decision === 'VERIFIED' ? 'success' : review.decision === 'REJECTED' ? 'danger' : 'warning'}>
          <Txt small>
            <Txt small strong>{review.decision.replace('_', ' ')}</Txt> by {app.users.get(review.officerId).name} • {formatDateTime(review.at)}
            {review.credibilityScore !== undefined ? ` • credibility ${review.credibilityScore}/5` : ''}
          </Txt>
          {review.comment ? <Txt small>{review.comment}</Txt> : null}
        </Card>
      ))}
    </>
  );
}

export function MyReportsScreen() {
  const { app, user } = useSafeZone();
  const nav = useNav();
  const reports = app.reportSubmission.myReports(user.id);
  return (
    <Screen title="My Reports" back="/">
      {reports.length === 0 && <EmptyState title="No reports yet">Use the Report tab to tell authorities about a hazard.</EmptyState>}
      {reports.map((report) => (
        <ListCard key={report.id} onPress={() => nav.go(`/my-reports/${report.id}`)}>
          <Row>
            <ReportStatusBadge status={report.status} />
            <Txt small muted>{timeAgo(report.submittedAt, app.clock.now())}</Txt>
          </Row>
          <Txt strong>
            {app.hazardTypes.get(report.hazardTypeCode).name} - {report.location.label}
          </Txt>
        </ListCard>
      ))}
    </Screen>
  );
}

/** Reporter's view, including the A1 "provide additional information" form. */
export function MyReportDetailScreen() {
  const reportId = useParam('reportId');
  const { app, user } = useSafeZone();
  const nav = useNav();
  const report = app.reportSubmission.getReport(reportId);
  const [text, setText] = useState('');
  const action = useAction();
  const canRespond = report.status === ReportStatus.NEEDS_MORE_INFO && report.reporterId === user.id;

  return (
    <Screen title="Incident Report" back="/my-reports">
      {report.status === ReportStatus.PENDING_SYNC && <Notice tone="warning">Stored on this device. It will be sent automatically when you are back online.</Notice>}
      <ReportBody report={report} />
      <ReviewHistory report={report} />
      {canRespond && (
        <Card tone="warning">
          <Txt strong>The duty officer needs more information</Txt>
          <Txt small>{report.latestReview?.comment}</Txt>
          <Field label="Your answer" error={action.error}>
            <TextField label="Your answer" multiline value={text} onChangeText={setText} />
          </Field>
          <Button block disabled={action.busy} onPress={() => void action.run(() => app.reportSubmission.provideAdditionalInformation(report.id, user, text))}>
            Send information
          </Button>
        </Card>
      )}
      {hasRole(user, Role.DUTY_OFFICER) && <LinkText onPress={() => nav.go(`/review/${report.id}`)}>Open in review queue</LinkText>}
    </Screen>
  );
}
