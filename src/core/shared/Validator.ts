import { ValidationError } from './errors';

/**
 * Small helper that collects field errors and throws a single ValidationError.
 * Keeps validators declarative and avoids long if/else chains.
 */
export class FieldErrors {
  private readonly errors: Record<string, string> = {};

  require(condition: boolean, field: string, message: string): this {
    if (!condition && !(field in this.errors)) {
      this.errors[field] = message;
    }
    return this;
  }

  get isEmpty(): boolean {
    return Object.keys(this.errors).length === 0;
  }

  toRecord(): Readonly<Record<string, string>> {
    return { ...this.errors };
  }

  throwIfAny(): void {
    if (!this.isEmpty) {
      throw new ValidationError(this.toRecord());
    }
  }
}

export function isBlank(value: string | undefined | null): boolean {
  return value === undefined || value === null || value.trim().length === 0;
}
