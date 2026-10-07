import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UserAccount } from '@/core/users/UserAccount';
import type { SafeZoneApp } from '@/app/container';

interface AppContextValue {
  readonly app: SafeZoneApp;
  readonly user: UserAccount;
  switchUser(userId: string): void;
  /** Increments on every domain event so screens re-read fresh data. */
  readonly version: number;
}

const AppContext = createContext<AppContextValue | null>(null);

const PERSONA_STORAGE_KEY = 'safezone.persona';

function readStoredPersona(): string | null {
  try {
    return window.localStorage.getItem(PERSONA_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function AppProvider({ app, initialUserId, children }: { app: SafeZoneApp; initialUserId: string; children: ReactNode }) {
  const [userId, setUserId] = useState(() => {
    const stored = readStoredPersona();
    return stored && app.repositories.users.findById(stored) ? stored : initialUserId;
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    const unsubscribeEvents = app.events.subscribeAll(bump);
    const unsubscribeConnectivity = app.connectivity.onChange(bump);
    return () => {
      unsubscribeEvents();
      unsubscribeConnectivity();
    };
  }, [app]);

  const switchUser = useCallback((id: string) => {
    setUserId(id);
    try {
      window.localStorage.setItem(PERSONA_STORAGE_KEY, id);
    } catch {
      /* persona is a convenience only */
    }
  }, []);

  const value = useMemo(() => ({ app, user: app.users.get(userId), switchUser, version }), [app, userId, switchUser, version]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useSafeZone(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useSafeZone must be used inside <AppProvider>');
  return context;
}

/** Forces a re-render after a mutation that does not publish a domain event. */
export function useRefresh(): () => void {
  const [, setTick] = useState(0);
  return useCallback(() => setTick((t) => t + 1), []);
}
