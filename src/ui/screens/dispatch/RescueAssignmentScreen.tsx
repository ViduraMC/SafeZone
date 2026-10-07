import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { nextStatuses, RescueTeamStatus } from '@/modules/dispatch/domain/RescueTeam';
import { useSafeZone } from '../../AppContext';
import { Button, Card, EmptyState, Field, Notice, NumberField, Row, SectionTitle, TextField, Txt } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { formatDateTime, titleCase } from '../../lib/format';
import { useAction } from '../../lib/useAction';
import { colors } from '../../theme';
import { TeamStatusBadge } from './TeamsScreen';

const STEPS = [RescueTeamStatus.DISPATCHED, RescueTeamStatus.EN_ROUTE, RescueTeamStatus.ON_SCENE, RescueTeamStatus.RETURNING];

/** UC04 steps 6-8: the rescue team reports progress and the mission outcome from the field (works offline). */
export function RescueAssignmentScreen() {
  const { app, user } = useSafeZone();
  const action = useAction();
  const [rescued, setRescued] = useState(0);
  const [notes, setNotes] = useState('');
  if (!user.rescueTeamId) {
    return (
      <Screen title="Assignment">
        <EmptyState title="You are not assigned to a rescue team" />
      </Screen>
    );
  }
  const team = app.rescue.getTeam(user.rescueTeamId);
  const assignment = team.assignment;
  const currentIndex = STEPS.indexOf(team.status);

  return (
    <Screen title="Rescue Status Update" subtitle={team.name}>
      {!app.connectivity.isOnline() && <Notice tone="warning">Offline. Status updates are stored and synchronised later.</Notice>}
      <Card>
        <Row>
          <Txt strong>Current status</Txt>
          <TeamStatusBadge status={team.status} />
        </Row>
        {assignment ? (
          <>
            <Txt lead>{assignment.locationDescription}</Txt>
            <Txt small muted>
              {app.geo.districtName(assignment.districtId)} District • assigned {formatDateTime(assignment.assignedAt)} by {app.users.get(assignment.assignedBy).name}
            </Txt>
          </>
        ) : (
          <Txt muted>On standby. No active assignment.</Txt>
        )}
      </Card>

      {assignment && (
        <View style={styles.stepper}>
          {STEPS.map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={[styles.dot, index <= currentIndex && styles.dotDone]} />
              <Txt small strong={index <= currentIndex} muted={index > currentIndex}>
                {titleCase(step)}
              </Txt>
            </View>
          ))}
        </View>
      )}

      {action.error && <Notice tone="danger">{action.error}</Notice>}
      {nextStatuses(team.status)
        .filter((status) => status !== RescueTeamStatus.RETURNING)
        .filter((status) => status !== RescueTeamStatus.STANDBY || team.status === RescueTeamStatus.RETURNING)
        .map((status) => (
          <Button key={status} block disabled={action.busy} onPress={() => void action.run(() => app.rescue.updateStatus(team.id, status, user))}>
            {status === RescueTeamStatus.STANDBY ? 'Back at base, on standby' : `Confirm: ${titleCase(status)}`}
          </Button>
        ))}

      {team.status === RescueTeamStatus.ON_SCENE && (
        <Card tone="success">
          <Txt strong>Mission outcome</Txt>
          <Field label="People rescued">
            <NumberField label="People rescued" value={rescued} onChange={setRescued} />
          </Field>
          <Field label="Notes for the district officer">
            <TextField label="Notes for the district officer" multiline value={notes} onChangeText={setNotes} placeholder="e.g. Residents moved to Kaduwela Community Hall" />
          </Field>
          <Button block disabled={action.busy} onPress={() => void action.run(() => app.rescue.completeMission(team.id, rescued, notes, user))}>
            Complete mission and return
          </Button>
        </Card>
      )}

      {team.missions.length > 0 && (
        <Txt small muted>
          Completed missions: {team.missions.length} • people rescued: {team.missions.reduce((sum, m) => sum + m.peopleRescued, 0)}
        </Txt>
      )}

      <SectionTitle>Status log</SectionTitle>
      {team.statusLog
        .slice()
        .reverse()
        .map((entry) => (
          <Txt key={entry.at.toISOString() + entry.status} small>
            {formatDateTime(entry.at)}: {titleCase(entry.status)}
          </Txt>
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  step: { alignItems: 'center', gap: 4, flex: 1 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.border },
  dotDone: { backgroundColor: colors.advisory },
});
