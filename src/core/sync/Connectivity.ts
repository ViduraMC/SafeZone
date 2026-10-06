export type ConnectivityListener = (online: boolean) => void;

/** Port describing the device's data connectivity. */
export interface ConnectivityMonitor {
  isOnline(): boolean;
  onChange(listener: ConnectivityListener): () => void;
}

/**
 * Connectivity that can be switched from the UI, so the offline flows of every
 * use case (UC01 E2, UC02 E2, UC03 E1/E4) can be demonstrated on demand.
 */
export class SimulatedConnectivity implements ConnectivityMonitor {
  private readonly listeners = new Set<ConnectivityListener>();

  constructor(private online = true) {}

  isOnline(): boolean {
    return this.online;
  }

  setOnline(online: boolean): void {
    if (this.online === online) return;
    this.online = online;
    this.listeners.forEach((listener) => listener(online));
  }

  onChange(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
