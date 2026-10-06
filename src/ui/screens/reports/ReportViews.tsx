import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Role, hasRole } from '@/core/users/UserAccount';
import type { GroundReport } from '@/modules/reports/domain/GroundReport';
import { REPORT_STATUS_LABELS, ReportStatus } from '@/modules/reports/domain/ReportStatus';
import { useSafeZone } from '../../AppContext';
import { Badge, Button, Card, EmptyState, Field, Notice, SectionTitle, type BadgeTone } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { formatDateTime, timeAgo } from '../../lib/format';
import { useAction } from '../../lib/useAction';

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
  return (
    <>
      <div className="detail-head">
        <Badge tone="info">{app.hazardTypes.get(report.hazardTypeCode).name.toUpperCase()}</Badge>
        <ReportStatusBadge status={report.status} />
        <span className="muted small push-right">Reported {timeAgo(report.submittedAt, app.clock.now())}</span>
      </div>
      <h2 className="detail-title">
        {app.hazardTypes.get(report.hazardTypeCode).name} - {report.location.label}
      </h2>
      <p className="small">
        <strong>{reporter.name}</strong>{' '}
        <span className="muted">{report.reporterKind === 'VOLUNTEER' ? `Community Volunteer (${reporter.volunteer?.trainingLevel.toLowerCase()} training)` : 'Citizen'}</span>
      </p>
      <div className="gallery">
        {report.evidence.map((photo) => (photo.previewUrl ? <img key={photo.id} src={photo.previewUrl} alt={photo.fileName} /> : null))}
      </div>
      <Card>
        <p className="caps small muted">Reporter description</p>
        <p>{report.description}</p>
      </Card>
      {report.supplements.map((s) => (
        <Card key={s.at.toISOString()} tone="info">
          <p className="caps small muted">Additional information • {formatDateTime(s.at)}</p>
          <p>{s.text}</p>
        </Card>
      ))}
      <Card>
        <dl className="kv">
          <dt>Severity assessment</dt>
          <dd>{report.severityAssessment}</dd>
          <dt>Location</dt>
          <dd>
            {report.location.label} ({app.geo.districtName(report.location.districtId)}) • {report.location.source}
            <br />
            <span className="muted small">
              {report.location.latitude.toFixed(4)}, {report.location.longitude.toFixed(4)}
            </span>
          </dd>
          <dt>Submitted</dt>
          <dd>{formatDateTime(report.submittedAt)}</dd>
        </dl>
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
          <p className="small">
            <strong>{review.decision.replace('_', ' ')}</strong> by {app.users.get(review.officerId).name} • {formatDateTime(review.at)}
            {review.credibilityScore !== undefined && ` • credibility ${review.credibilityScore}/5`}
          </p>
          {review.comment && <p className="small">{review.comment}</p>}
        </Card>
      ))}
    </>
  );
}

export function MyReportsScreen() {
  const { app, user } = useSafeZone();
  const reports = app.reportSubmission.myReports(user.id);
  return (
    <Screen title="My Reports" back="/">
      {reports.length === 0 && <EmptyState title="No reports yet">Use the Report tab to tell authorities about a hazard.</EmptyState>}
      {reports.map((report) => (
        <Link key={report.id} to={`/my-reports/${report.id}`} className="list-card">
          <div className="list-card__top">
            <ReportStatusBadge status={report.status} />
            <span className="muted small">{timeAgo(report.submittedAt, app.clock.now())}</span>
          </div>
          <p className="list-card__title">
            {app.hazardTypes.get(report.hazardTypeCode).name} - {report.location.label}
          </p>
        </Link>
      ))}
    </Screen>
  );
}

/** Reporter's view, including the A1 "provide additional information" form. */
export function MyReportDetailScreen() {
  const { reportId = '' } = useParams();
  const { app, user } = useSafeZone();
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
          <p className="strong">The duty officer needs more information</p>
          <p className="small">{report.latestReview?.comment}</p>
          <Field label="Your answer" error={action.error ?? undefined} htmlFor="supplement">
            <textarea id="supplement" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Button block disabled={action.busy} onClick={() => action.run(() => app.reportSubmission.provideAdditionalInformation(report.id, user, text))}>
            Send information
          </Button>
        </Card>
      )}
      {hasRole(user, Role.DUTY_OFFICER) && <Link to={`/review/${report.id}`}>Open in review queue</Link>}
    </Screen>
  );
}
