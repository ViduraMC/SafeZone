import { useState } from 'react';
import { OWNER_TYPE_LABELS } from '@/core/organisations/ResourceOwner';
import { RescueTeamStatus, type RescueTeam } from '@/modules/dispatch/domain/RescueTeam';
import { useSafeZone } from '../../AppContext';
import { Badge, Button, Card, EmptyState, Field, Notice, SectionTitle, type BadgeTone } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { timeAgo, titleCase } from '../../lib/format';
import { useAction } from '../../lib/useAction';
import { ScopeSelector, useCoordinationScope } from '../common/CoordinationScope';

const STATUS_TONE: Readonly<Record<RescueTeamStatus, BadgeTone>> = {
  [RescueTeamStatus.STANDBY]: 'success',
  [RescueTeamStatus.DISPATCHED]: 'info',
  [RescueTeamStatus.EN_ROUTE]: 'warning',
  [RescueTeamStatus.ON_SCENE]: 'critical',
  [RescueTeamStatus.RETURNING]: 'neutral',
};

export function TeamStatusBadge({ status }: { status: RescueTeamStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{titleCase(status).toUpperCase()}</Badge>;
}

/** UC04 steps 1-5 with A1 (teams from another district or organisation) and A3 (recall). */
export function TeamsScreen() {
  const { app, user } = useSafeZone();
  const { districtId, eventId } = useCoordinationScope();
  const [showOthers, setShowOthers] = useState(false);
  const [selected, setSelected] = useState<RescueTeam>();
  const [location, setLocation] = useState('');
  const action = useAction();
  const local = app.rescue.availableInDistrict(districtId);
  const others = app.rescue.availableElsewhere(districtId);
  const deployed = app.rescue.deployedTo(districtId);

  const dispatch = async () => {
    if (!selected) return;
    const team = await action.run(() => app.rescue.dispatch(selected.id, { districtId, locationDescription: location, eventId }, user));
    if (team) {
      setSelected(undefined);
      setLocation('');
    }
  };

  const teamCard = (team: RescueTeam) => {
    const owner = app.organisations.get(team.ownerId);
    return (
      <Card key={team.id} tone={selected?.id === team.id ? 'info' : undefined}>
        <div className="list-card__top">
          <span className="strong">{team.name}</span>
          <TeamStatusBadge status={team.status} />
        </div>
        <p className="muted small">
          {owner.name} ({OWNER_TYPE_LABELS[owner.type]}) • {team.specialisation} • {team.members} members • based in {app.geo.districtName(team.homeDistrictId)}
        </p>
        {team.isAvailable && (
          <Button variant="ghost" onClick={() => setSelected(team)}>
            Select for dispatch
          </Button>
        )}
      </Card>
    );
  };

  return (
    <Screen title="Rescue Teams" subtitle="Dispatch and monitor real-time status">
      <ScopeSelector />
      {selected && (
        <Card tone="warning">
          <p className="strong">Dispatch {selected.name}</p>
          {selected.homeDistrictId !== districtId && <p className="small">Cross-organisation assignment from {app.geo.districtName(selected.homeDistrictId)}.</p>}
          <Field label="Incident location" htmlFor="loc">
            <input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Hanwella bridge" />
          </Field>
          {action.error && <Notice tone="danger">{action.error}</Notice>}
          <div className="button-row">
            <Button onClick={dispatch} disabled={action.busy}>
              Dispatch
            </Button>
            <Button variant="secondary" onClick={() => setSelected(undefined)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <SectionTitle>Deployed in {app.geo.districtName(districtId)}</SectionTitle>
      {deployed.length === 0 && <p className="muted small">No teams deployed.</p>}
      {deployed.map((team) => (
        <Card key={team.id}>
          <div className="list-card__top">
            <span className="strong">{team.name}</span>
            <TeamStatusBadge status={team.status} />
          </div>
          <p className="small">{team.assignment?.locationDescription}</p>
          <p className="muted small">
            Dispatched {team.assignment && timeAgo(team.assignment.assignedAt, app.clock.now())}
            {team.assignment?.crossOrganisation && ' • cross-organisation'}
          </p>
          {team.status === RescueTeamStatus.DISPATCHED && (
            <Button variant="ghost" onClick={() => action.run(() => app.rescue.updateStatus(team.id, RescueTeamStatus.STANDBY, user))}>
              Recall before departure
            </Button>
          )}
        </Card>
      ))}

      <SectionTitle>Available in district</SectionTitle>
      {local.length === 0 && (
        <EmptyState title="No standby teams in this district">Search teams from other organisations below.</EmptyState>
      )}
      {local.map(teamCard)}

      <Button variant="secondary" block onClick={() => setShowOthers(!showOthers)}>
        {showOthers ? 'Hide' : 'Search'} teams from other districts & organisations ({others.length})
      </Button>
      {showOthers && others.map(teamCard)}
    </Screen>
  );
}
