import { createContext, useContext, useState, type ReactNode } from 'react';
import { useSafeZone } from '../../AppContext';

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
    <div className="scope">
      <select aria-label="Disaster event" value={scope.eventId} onChange={(e) => scope.setEventId(e.target.value)}>
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <select aria-label="District" value={scope.districtId} onChange={(e) => scope.setDistrictId(e.target.value)}>
        {[...new Set([scope.districtId, ...districts])].map((id) => (
          <option key={id} value={id}>
            {app.geo.districtName(id)} District
          </option>
        ))}
      </select>
    </div>
  );
}
