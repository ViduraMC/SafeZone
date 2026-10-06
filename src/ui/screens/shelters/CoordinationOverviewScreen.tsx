import { Link } from 'react-router-dom';
import { RescueTeamStatus } from '@/modules/dispatch/domain/RescueTeam';
import { ShelterStatus } from '@/modules/shelters/domain/Shelter';
import { useSafeZone } from '../../AppContext';
import { Card, Notice, ProgressBar, SectionTitle, StatTile } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { percent, titleCase } from '../../lib/format';
import { ScopeSelector, useCoordinationScope } from '../common/CoordinationScope';

/** UC03 steps 1-3: combined operational view for the selected event and district. */
export function CoordinationOverviewScreen() {
  const { app } = useSafeZone();
  const { districtId } = useCoordinationScope();
  const overview = app.overview.overview(districtId);
  const pending = app.sync.pending().length;
  const s = overview.shelters;
  const deployed = overview.teamsByStatus;

  return (
    <Screen title="Emergency Coordination" subtitle="Combined operational view">
      <ScopeSelector />
      {pending > 0 && (
        <Notice tone="warning">
          {pending} field update{pending === 1 ? '' : 's'} stored on this device, waiting to synchronise.
        </Notice>
      )}

      <SectionTitle action={<Link to="/coordination/shelters">Manage</Link>}>Shelters</SectionTitle>
      <Card>
        <div className="stats">
          <StatTile label="Shelters" value={s.count} />
          <StatTile label="Sheltered" value={s.occupancy} sub={`of ${s.capacity}`} />
          <StatTile label="Near capacity / full" value={s.byStatus[ShelterStatus.NEAR_CAPACITY] + s.byStatus[ShelterStatus.FULL]} />
        </div>
        <ProgressBar ratio={s.capacity === 0 ? 0 : s.occupancy / s.capacity} />
        <p className="muted small">{s.capacity === 0 ? 'No shelters registered' : `${percent(s.occupancy / s.capacity)} of shelter capacity in use`}{s.byStatus[ShelterStatus.UNAVAILABLE] > 0 && ` • ${s.byStatus[ShelterStatus.UNAVAILABLE]} unavailable`}</p>
      </Card>

      <SectionTitle action={<Link to="/coordination/teams">Dispatch</Link>}>Rescue teams</SectionTitle>
      <Card>
        <div className="status-grid">
          {Object.values(RescueTeamStatus).map((status) => (
            <div key={status} className="status-grid__item">
              <span className="status-grid__value">{deployed[status]}</span>
              <span className="muted small">{titleCase(status)}</span>
            </div>
          ))}
        </div>
      </Card>

      <SectionTitle action={<Link to="/coordination/relief">Distribute</Link>}>Relief distributed</SectionTitle>
      <Card>
        {Object.keys(overview.suppliesDistributed).length === 0 && <p className="muted small">No supplies distributed yet.</p>}
        <dl className="kv">
          {Object.entries(overview.suppliesDistributed).map(([category, quantity]) => (
            <div key={category} className="kv__row">
              <dt>{titleCase(category)}</dt>
              <dd>{quantity?.toLocaleString()} units</dd>
            </div>
          ))}
        </dl>
      </Card>
    </Screen>
  );
}
