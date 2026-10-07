import { StyleSheet, View } from 'react-native';
import { RescueTeamStatus } from '@/modules/dispatch/domain/RescueTeam';
import { ShelterStatus } from '@/modules/shelters/domain/Shelter';
import { useSafeZone } from '../../AppContext';
import { Card, KeyValue, Notice, ProgressBar, SectionTitle, StatTile, Stats, Txt } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { percent, titleCase } from '../../lib/format';
import { useNav } from '../../lib/useNav';
import { colors } from '../../theme';
import { ScopeSelector, useCoordinationScope } from '../common/CoordinationScope';

/** UC03 steps 1-3: combined operational view for the selected event and district. */
export function CoordinationOverviewScreen() {
  const { app } = useSafeZone();
  const nav = useNav();
  const { districtId } = useCoordinationScope();
  const overview = app.overview.overview(districtId);
  const pending = app.sync.pending().length;
  const s = overview.shelters;
  const supplies = Object.entries(overview.suppliesDistributed);

  return (
    <Screen title="Emergency Coordination" subtitle="Combined operational view">
      <ScopeSelector />
      {pending > 0 && <Notice tone="warning">{`${pending} field update${pending === 1 ? '' : 's'} stored on this device, waiting to synchronise.`}</Notice>}

      <SectionTitle action={{ label: 'Manage', onPress: () => nav.resetTo('/coordination/shelters') }}>Shelters</SectionTitle>
      <Card>
        <Stats>
          <StatTile label="Shelters" value={s.count} />
          <StatTile label="Sheltered" value={s.occupancy} sub={`of ${s.capacity}`} />
          <StatTile label="Near capacity / full" value={s.byStatus[ShelterStatus.NEAR_CAPACITY] + s.byStatus[ShelterStatus.FULL]} />
        </Stats>
        <ProgressBar ratio={s.capacity === 0 ? 0 : s.occupancy / s.capacity} />
        <Txt small muted>
          {s.capacity === 0 ? 'No shelters registered' : `${percent(s.occupancy / s.capacity)} of shelter capacity in use`}
          {s.byStatus[ShelterStatus.UNAVAILABLE] > 0 ? ` • ${s.byStatus[ShelterStatus.UNAVAILABLE]} unavailable` : ''}
        </Txt>
      </Card>

      <SectionTitle action={{ label: 'Dispatch', onPress: () => nav.resetTo('/coordination/teams') }}>Rescue teams</SectionTitle>
      <Card style={styles.grid}>
        {Object.values(RescueTeamStatus).map((status) => (
          <View key={status} style={styles.gridItem}>
            <Txt style={styles.gridValue}>{overview.teamsByStatus[status]}</Txt>
            <Txt small muted>{titleCase(status)}</Txt>
          </View>
        ))}
      </Card>

      <SectionTitle action={{ label: 'Distribute', onPress: () => nav.resetTo('/coordination/relief') }}>Relief distributed</SectionTitle>
      <Card>
        {supplies.length === 0 ? (
          <Txt small muted>No supplies distributed yet.</Txt>
        ) : (
          <KeyValue rows={supplies.map(([category, quantity]) => [titleCase(category), `${quantity?.toLocaleString()} units`])} />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: { width: '30%', alignItems: 'center', paddingVertical: 6 },
  gridValue: { fontSize: 22, fontWeight: '800', color: colors.navy },
});
