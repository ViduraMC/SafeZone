/**
 * Error hierarchy shared by every module.
 *
 * Domain and application code throw these typed errors instead of returning
 * magic values, so the UI can translate each category into the right message
 * (field highlighting, permission notice, retry prompt, ...).
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'DOMAIN_RULE_VIOLATION',
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Raised when user input fails validation. Carries one message per invalid field. */
export class ValidationError extends DomainError {
  constructor(public readonly fieldErrors: Readonly<Record<string, string>>) {
    super(`Validation failed: ${Object.keys(fieldErrors).join(', ')}`, 'VALIDATION_FAILED');
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} '${id}' was not found`, 'NOT_FOUND');
  }
}

export class AuthorizationError extends DomainError {
  constructor(message: string) {
    super(message, 'NOT_AUTHORIZED');
  }
}

/** Raised when an unexpected infrastructure failure stops an operation (scenario "System Error" flows). */
export class OperationFailedError extends DomainError {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message, 'OPERATION_FAILED');
  }
}
