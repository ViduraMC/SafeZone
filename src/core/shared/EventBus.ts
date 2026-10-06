/**
 * Lightweight publish/subscribe channel (Observer pattern).
 *
 * Modules communicate through events instead of calling each other directly,
 * e.g. a submitted ground report notifies duty officers without the report
 * entity knowing anything about officers (fixes the UC02 sequence coupling).
 */
export interface DomainEvent {
  readonly type: string;
  readonly occurredAt: Date;
  readonly payload: Readonly<Record<string, unknown>>;
}

export type EventListener = (event: DomainEvent) => void;

export interface EventBus {
  publish(event: DomainEvent): void;
  subscribe(type: string, listener: EventListener): () => void;
  subscribeAll(listener: EventListener): () => void;
}

export class InMemoryEventBus implements EventBus {
  private readonly listeners = new Map<string, Set<EventListener>>();
  private readonly wildcard = new Set<EventListener>();

  publish(event: DomainEvent): void {
    this.listeners.get(event.type)?.forEach((listener) => listener(event));
    this.wildcard.forEach((listener) => listener(event));
  }

  subscribe(type: string, listener: EventListener): () => void {
    const set = this.listeners.get(type) ?? new Set<EventListener>();
    set.add(listener);
    this.listeners.set(type, set);
    return () => set.delete(listener);
  }

  subscribeAll(listener: EventListener): () => void {
    this.wildcard.add(listener);
    return () => this.wildcard.delete(listener);
  }
}
