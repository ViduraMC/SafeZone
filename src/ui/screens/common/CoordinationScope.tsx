import { createContext, useContext, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeZone } from '../../AppContext';
import { SelectField } from '../../components/Primitives';

interface Scope {
  readonly eventId: string;
  readonly districtId: string;
  setEventId(id: string): void;
  setDistrictId(id: string): void;
}

const ScopeContext = createContext<Scope | null>(null);

/** Remembers the disaster event and district the officer is coordinating (UC03 steps 2-3). */
export function CoordinationScopeProvider({ children }: { children: ReactNode }) {
  const { app, user } = useSafeZone();
  const events = app.overview.activeEvents();
  const initialEvent = events.find((e) => e.districtIds.includes(user.homeDistrictId)) ?? events[0];
  const [eventId, setEventId] = useState(initialEvent?.id ?? '');
  const [districtId, setDistrictId] = useState(user.homeDistrictId);
  return <ScopeContext.Provider value={{ eventId, districtId, setEventId, setDistrictId }}>{children}</ScopeContext.Provider>;
}

export function useCoordinationScope(): Scope {
  const scope = useContext(ScopeContext);
  if (!scope) throw new Error('useCoordinationScope must be used inside CoordinationScopeProvider');
  return scope;
}

export function ScopeSelector() {
  const { app } = useSafeZone();
  const scope = useCoordinationScope();
  const events = app.overview.activeEvents();
  const event = events.find((e) => e.id === scope.eventId);
  const districts = event ? event.districtIds : app.geo.listDistricts().map((d) => d.id);
  return (
    <View style={styles.scope}>
      <SelectField label="Disaster event" value={scope.eventId} onChange={scope.setEventId} options={events.map((e) => ({ value: e.id, label: e.name }))} />
      <SelectField
        label="District"
        value={scope.districtId}
        onChange={scope.setDistrictId}
        options={[...new Set([scope.districtId, ...districts])].map((id) => ({ value: id, label: `${app.geo.districtName(id)} District` }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({ scope: { gap: 8, marginBottom: 12 } });
