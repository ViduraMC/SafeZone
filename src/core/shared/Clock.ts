/** Abstraction over the system time so that time-dependent rules are testable. */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Clock whose time is controlled explicitly (tests and demo seeding). */
export class ManualClock implements Clock {
  private current: Date;

  constructor(start: Date) {
    this.current = new Date(start.getTime());
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(time: Date): void {
    this.current = new Date(time.getTime());
  }

  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}

export const MS_PER_HOUR = 3_600_000;

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * MS_PER_HOUR);
}

/**
 * Real-time clock that can be frozen temporarily. Used to seed demo history
 * through the real services ("two days ago ..."), then released to live time.
 */
export class ControllableClock implements Clock {
  private frozenAt?: Date;

  now(): Date {
    return this.frozenAt ? new Date(this.frozenAt.getTime()) : new Date();
  }

  freezeAt(time: Date): void {
    this.frozenAt = new Date(time.getTime());
  }

  advanceMinutes(minutes: number): void {
    const base = this.frozenAt ?? new Date();
    this.frozenAt = new Date(base.getTime() + minutes * 60_000);
  }

  release(): void {
    this.frozenAt = undefined;
  }
}
