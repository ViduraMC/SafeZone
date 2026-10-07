import { useState } from 'react';
import { MAX_CREDIBILITY, MIN_CREDIBILITY } from '@/modules/reports/domain/GroundReport';
import { ReportStatus } from '@/modules/reports/domain/ReportStatus';
import { useSafeZone } from '../../AppContext';
import { Badge, Button, Card, EmptyState, Field, ListCard, Notice, Row, Segmented, TextField, Txt } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { timeAgo } from '../../lib/format';
import { useAction } from '../../lib/useAction';
import { useNav, useParam } from '../../lib/useNav';
import { ReportBody, ReportStatusBadge } from './ReportViews';

export function ReviewQueueScreen() {
  const { app } = useSafeZone();
  const nav = useNav();
  const queue = app.reportVerification.pendingQueue();
  return (
    <Screen title="Review Queue" subtitle={`${queue.length} report${queue.length === 1 ? '' : 's'} pending verification`}>
      {queue.length === 0 && <EmptyState title="All caught up">New ground reports will appear here.</EmptyState>}
      {queue.map((report) => (
        <ListCard
          key={report.id}
          label={`Review ${report.id}`}
          accent={report.severityAssessment === 'HIGH' ? 'critical' : 'warning'}
          onPress={() => nav.go(`/review/${report.id}`)}
        >
          <Row>
            <Badge tone={report.severityAssessment === 'HIGH' ? 'critical' : report.severityAssessment === 'MEDIUM' ? 'warning' : 'advisory'}>{report.severityAssessment}</Badge>
            <Txt small muted>{timeAgo(report.submittedAt, app.clock.now())}</Txt>
          </Row>
          <Txt strong>
            {app.hazardTypes.get(report.hazardTypeCode).name} - {report.location.label}
          </Txt>
          <Txt small muted>
            {app.geo.districtName(report.location.districtId)} • {report.reporterKind === 'VOLUNTEER' ? 'Volunteer' : 'Citizen'} • {report.evidence.length} photo
            {report.evidence.length === 1 ? '' : 's'}
            {report.supplements.length > 0 ? ' • updated by reporter' : ''}
          </Txt>
        </ListCard>
      ))}
    </Screen>
  );
}

export function ReviewHistoryScreen() {
  const { app } = useSafeZone();
  const nav = useNav();
  const reviewed = app.reportVerification.reviewedReports();
  return (
    <Screen title="Reviewed Reports">
      {reviewed.length === 0 && <EmptyState title="No decisions yet" />}
      {reviewed.map((report) => (
        <ListCard key={report.id} onPress={() => nav.go(`/review/${report.id}`)}>
          <Row>
            <ReportStatusBadge status={report.status} />
            <Txt small muted>{report.latestReview ? timeAgo(report.latestReview.at, app.clock.now()) : ''}</Txt>
          </Row>
          <Txt strong>
            {app.hazardTypes.get(report.hazardTypeCode).name} - {report.location.label}
          </Txt>
        </ListCard>
      ))}
    </Screen>
  );
}

type Decision = 'verify' | 'info' | 'reject';

const SCORES = Array.from({ length: MAX_CREDIBILITY - MIN_CREDIBILITY + 1 }, (_, i) => String(MIN_CREDIBILITY + i));

/** UC02 steps 12-17 with A1 (request info) and A2 (reject). */
export function ReviewDetailScreen() {
  const reportId = useParam('reportId');
  const { app, user } = useSafeZone();
  const nav = useNav();
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
    if (done) nav.resetTo('/review');
  };

  return (
    <Screen title="Review Report" back="/review">
      <ReportBody report={report} />
      {!reviewable && <Notice tone="info">{`This report is ${report.status.replace(/_/g, ' ').toLowerCase()} and is not awaiting review.`}</Notice>}
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
            <Field label={`Credibility score (${MIN_CREDIBILITY}-${MAX_CREDIBILITY})`}>
              <Segmented label="Credibility score" value={String(score)} onChange={(value) => setScore(Number(value))} options={SCORES.map((s) => ({ value: s, label: s }))} />
            </Field>
          )}
          <Field label={decision === 'verify' ? 'Comment (optional)' : decision === 'info' ? 'What information is needed?' : 'Rejection reason'}>
            <TextField label="Decision comment" multiline value={text} onChangeText={setText} />
          </Field>
          {action.error && <Notice tone="danger">{action.error}</Notice>}
          <Button block variant={decision === 'reject' ? 'danger' : 'primary'} disabled={action.busy} onPress={() => void submit()}>
            {decision === 'verify' ? 'Verify Report' : decision === 'info' ? 'Request Additional Info' : 'Reject Report'}
          </Button>
        </Card>
      )}
    </Screen>
  );
}
