export interface Identifiable {
  readonly id: string;
}

/**
 * Generic persistence port. Application services depend on this abstraction
 * (Dependency Inversion) rather than on a concrete storage technology.
 */
export interface Repository<T extends Identifiable> {
  findById(id: string): T | undefined;
  findAll(): T[];
  findWhere(predicate: (item: T) => boolean): T[];
  save(item: T): T;
  delete(id: string): boolean;
  count(): number;
}

/** In-memory adapter, used by the mobile app's local store and by unit tests. */
export class InMemoryRepository<T extends Identifiable> implements Repository<T> {
  private readonly items = new Map<string, T>();

  constructor(initial: readonly T[] = []) {
    initial.forEach((item) => this.items.set(item.id, item));
  }

  findById(id: string): T | undefined {
    return this.items.get(id);
  }

  findAll(): T[] {
    return [...this.items.values()];
  }

  findWhere(predicate: (item: T) => boolean): T[] {
    return this.findAll().filter(predicate);
  }

  save(item: T): T {
    this.items.set(item.id, item);
    return item;
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }

  count(): number {
    return this.items.size;
  }
}
