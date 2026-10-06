import { useState } from 'react';
import { nextStatuses, RescueTeamStatus } from '@/modules/dispatch/domain/RescueTeam';
import { useSafeZone } from '../../AppContext';
import { Button, Card, EmptyState, Field, Notice } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { formatDateTime, titleCase } from '../../lib/format';
import { useAction } from '../../lib/useAction';
import { TeamStatusBadge } from './TeamsScreen';

const STEPS = [RescueTeamStatus.DISPATCHED, RescueTeamStatus.EN_ROUTE, RescueTeamStatus.ON_SCENE, RescueTeamStatus.RETURNING];

/** UC04 steps 6-8: the rescue team reports progress and the mission outcome from the field (works offline). */
export function RescueAssignmentScreen() {
  const { app, user } = useSafeZone();
  const action = useAction();
  const [rescued, setRescued] = useState(0);
  const [notes, setNotes] = useState('');
  if (!user.rescueTeamId) return <Screen title="Assignment"><EmptyState title="You are not assigned to a rescue team" /></Screen>;
  const team = app.rescue.getTeam(user.rescueTeamId);
  const assignment = team.assignment;
  const currentIndex = STEPS.indexOf(team.status);

  return (
    <Screen title="Rescue Status Update" subtitle={team.name}>
      {!app.connectivity.isOnline() && <Notice tone="warning">Offline - status updates are stored and synchronised later.</Notice>}
      <Card>
        <div className="list-card__top">
          <span className="strong">Current status</span>
          <TeamStatusBadge status={team.status} />
        </div>
        {assignment ? (
          <>
            <p className="lead">{assignment.locationDescription}</p>
            <p className="muted small">
              {app.geo.districtName(assignment.districtId)} District • assigned {formatDateTime(assignment.assignedAt)} by {app.users.get(assignment.assignedBy).name}
            </p>
          </>
        ) : (
          <p className="muted">On standby. No active assignment.</p>
        )}
      </Card>

      {assignment && (
        <ol className="stepper">
          {STEPS.map((step, index) => (
            <li key={step} className={index <= currentIndex ? 'is-done' : ''}>
              {titleCase(step)}
            </li>
          ))}
        </ol>
      )}

      {action.error && <Notice tone="danger">{action.error}</Notice>}
      {nextStatuses(team.status)
        .filter((status) => status !== RescueTeamStatus.RETURNING)
        .filter((status) => status !== RescueTeamStatus.STANDBY || team.status === RescueTeamStatus.RETURNING)
        .map((status) => (
          <Button key={status} block disabled={action.busy} onClick={() => action.run(() => app.rescue.updateStatus(team.id, status, user))}>
            {status === RescueTeamStatus.STANDBY ? 'Back at base - on standby' : `Confirm: ${titleCase(status)}`}
          </Button>
        ))}

      {team.status === RescueTeamStatus.ON_SCENE && (
        <Card tone="success">
          <p className="strong">Mission outcome</p>
          <Field label="People rescued" htmlFor="rescued">
            <input id="rescued" type="number" min={0} value={rescued} onChange={(e) => setRescued(Number(e.target.value))} />
          </Field>
          <Field label="Notes for the district officer" htmlFor="notes">
            <textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Residents moved to Kaduwela Community Hall" />
          </Field>
          <Button block disabled={action.busy} onClick={() => action.run(() => app.rescue.completeMission(team.id, rescued, notes, user))}>
            Complete mission and return
          </Button>
        </Card>
      )}

      {team.missions.length > 0 && (
        <p className="muted small">
          Completed missions: {team.missions.length} • people rescued: {team.missions.reduce((sum, m) => sum + m.peopleRescued, 0)}
        </p>
      )}

      <h3 className="caps">Status log</h3>
      {team.statusLog
        .slice()
        .reverse()
        .map((entry) => (
          <p key={entry.at.toISOString() + entry.status} className="small">
            {formatDateTime(entry.at)} - {titleCase(entry.status)}
          </p>
        ))}
    </Screen>
  );
}
