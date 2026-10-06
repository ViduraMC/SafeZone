export interface ErrorLogEntry {
  readonly operation: string;
  readonly message: string;
  readonly at: Date;
}

/** Port used by services to record unexpected failures ("System records the error"). */
export interface ErrorLog {
  record(operation: string, error: unknown, at: Date): void;
  entries(): readonly ErrorLogEntry[];
}

export class InMemoryErrorLog implements ErrorLog {
  private readonly log: ErrorLogEntry[] = [];

  record(operation: string, error: unknown, at: Date): void {
    const message = error instanceof Error ? error.message : String(error);
    this.log.push({ operation, message, at });
  }

  entries(): readonly ErrorLogEntry[] {
    return [...this.log];
  }
}
