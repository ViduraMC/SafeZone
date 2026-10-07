import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MAX_CREDIBILITY, MIN_CREDIBILITY } from '@/modules/reports/domain/GroundReport';
import { ReportStatus } from '@/modules/reports/domain/ReportStatus';
import { useSafeZone } from '../../AppContext';
import { Badge, Button, Card, EmptyState, Field, Notice, Segmented } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { timeAgo } from '../../lib/format';
import { useAction } from '../../lib/useAction';
import { ReportBody, ReportStatusBadge } from './ReportViews';

export function ReviewQueueScreen() {
  const { app } = useSafeZone();
  const queue = app.reportVerification.pendingQueue();
  return (
    <Screen title="Review Queue" subtitle={`${queue.length} report${queue.length === 1 ? '' : 's'} pending verification`}>
      {queue.length === 0 && <EmptyState title="All caught up">New ground reports will appear here.</EmptyState>}
      {queue.map((report) => (
        <Link key={report.id} to={`/review/${report.id}`} className={`list-card list-card--${report.severityAssessment === 'HIGH' ? 'emergency' : 'warning'}`}>
          <div className="list-card__top">
            <Badge tone={report.severityAssessment === 'HIGH' ? 'critical' : report.severityAssessment === 'MEDIUM' ? 'warning' : 'advisory'}>
              {report.severityAssessment}
            </Badge>
            <span className="muted small">{timeAgo(report.submittedAt, app.clock.now())}</span>
          </div>
          <p className="list-card__title">
            {app.hazardTypes.get(report.hazardTypeCode).name} - {report.location.label}
          </p>
          <p className="muted small">
            {app.geo.districtName(report.location.districtId)} • {report.reporterKind === 'VOLUNTEER' ? 'Volunteer' : 'Citizen'} • {report.evidence.length} photo
            {report.evidence.length === 1 ? '' : 's'}
            {report.supplements.length > 0 && ' • updated by reporter'}
          </p>
        </Link>
      ))}
    </Screen>
  );
}

export function ReviewHistoryScreen() {
  const { app } = useSafeZone();
  const reviewed = app.reportVerification.reviewedReports();
  return (
    <Screen title="Reviewed Reports">
      {reviewed.length === 0 && <EmptyState title="No decisions yet" />}
      {reviewed.map((report) => (
        <Link key={report.id} to={`/review/${report.id}`} className="list-card">
          <div className="list-card__top">
            <ReportStatusBadge status={report.status} />
            <span className="muted small">{report.latestReview ? timeAgo(report.latestReview.at, app.clock.now()) : ''}</span>
          </div>
          <p className="list-card__title">
            {app.hazardTypes.get(report.hazardTypeCode).name} - {report.location.label}
          </p>
        </Link>
      ))}
    </Screen>
  );
}

type Decision = 'verify' | 'info' | 'reject';

/** UC02 steps 12-17 with A1 (request info) and A2 (reject). */
export function ReviewDetailScreen() {
  const { reportId = '' } = useParams();
  const { app, user } = useSafeZone();
  const navigate = useNavigate();
  const report = app.reportSubmission.getReport(reportId);
  const [decision, setDecision] = useState<Decision>('verify');
  const [score, setScore] = useState(4);
  const [text, setText] = useState('');
  const action = useAction();
  const reviewable = report.status === ReportStatus.PENDING_VERIFICATION;

  const submit = async () => {
    const done = await action.run(() => {
      if (decision === 'verify') return app.reportVerification.verify(report.id, user, score, text);
      if (decision === 'info') return app.reportVerification.requestMoreInformation(report.id, user, text);
      return app.reportVerification.reject(report.id, user, text);
    });
    if (done) navigate('/review');
  };

  return (
    <Screen title="Review Report" back="/review">
      <ReportBody report={report} />
      {!reviewable && <Notice tone="info">This report is {report.status.replace(/_/g, ' ').toLowerCase()} and is not awaiting review.</Notice>}
      {reviewable && (
        <Card>
          <Segmented<Decision>
            label="Decision"
            value={decision}
            onChange={(value) => {
              setDecision(value);
              action.reset();
            }}
            options={[
              { value: 'verify', label: 'Verify' },
              { value: 'info', label: 'Request info' },
              { value: 'reject', label: 'Reject' },
            ]}
          />
          {decision === 'verify' && (
            <Field label={`Credibility score (${MIN_CREDIBILITY}-${MAX_CREDIBILITY})`} htmlFor="score">
              <input id="score" type="range" min={MIN_CREDIBILITY} max={MAX_CREDIBILITY} value={score} onChange={(e) => setScore(Number(e.target.value))} />
              <span className="strong">{score} / {MAX_CREDIBILITY}</span>
            </Field>
          )}
          <Field
            label={decision === 'verify' ? 'Comment (optional)' : decision === 'info' ? 'What information is needed?' : 'Rejection reason'}
            htmlFor="decision-text"
          >
            <textarea id="decision-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          {action.error && <Notice tone="danger">{action.error}</Notice>}
          <Button block variant={decision === 'reject' ? 'danger' : 'primary'} disabled={action.busy} onClick={submit}>
            {decision === 'verify' ? 'Verify Report' : decision === 'info' ? 'Request Additional Info' : 'Reject Report'}
          </Button>
        </Card>
      )}
    </Screen>
  );
}
