import { useCallback, useState } from 'react';
import { DomainError, ValidationError } from '@/core/shared/errors';

export interface ActionState {
  readonly busy: boolean;
  readonly error: string | null;
  readonly fieldErrors: Readonly<Record<string, string>>;
}

/**
 * Runs a (possibly async) use-case action and maps domain errors to UI state:
 * validation errors highlight fields, other domain errors show a message.
 */
export function useAction() {
  const [state, setState] = useState<ActionState>({ busy: false, error: null, fieldErrors: {} });

  const run = useCallback(async <T,>(action: () => T | Promise<T>): Promise<T | undefined> => {
    setState({ busy: true, error: null, fieldErrors: {} });
    try {
      const result = await action();
      setState({ busy: false, error: null, fieldErrors: {} });
      return result;
    } catch (error) {
      if (error instanceof ValidationError) {
        setState({ busy: false, error: 'Please correct the highlighted fields.', fieldErrors: error.fieldErrors });
      } else if (error instanceof DomainError) {
        setState({ busy: false, error: error.message, fieldErrors: {} });
      } else {
        setState({ busy: false, error: 'Something went wrong. Please try again.', fieldErrors: {} });
      }
      return undefined;
    }
  }, []);

  const reset = useCallback(() => setState({ busy: false, error: null, fieldErrors: {} }), []);

  /** Removes the error of fields the user has just edited (immediate feedback). */
  const clearFields = useCallback((...fields: string[]) => {
    setState((current) => {
      if (!fields.some((field) => field in current.fieldErrors)) return current;
      const fieldErrors = { ...current.fieldErrors };
      fields.forEach((field) => delete fieldErrors[field]);
      const error = Object.keys(fieldErrors).length === 0 ? null : current.error;
      return { ...current, fieldErrors, error };
    });
  }, []);

  return { ...state, run, reset, clearFields };
}
