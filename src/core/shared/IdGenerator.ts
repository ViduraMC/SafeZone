export interface IdGenerator {
  next(prefix: string): string;
}

/** Produces readable, predictable identifiers such as `ALT-0001`. */
export class SequentialIdGenerator implements IdGenerator {
  private readonly counters = new Map<string, number>();

  next(prefix: string): string {
    const value = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, value);
    return `${prefix}-${String(value).padStart(4, '0')}`;
  }
}
