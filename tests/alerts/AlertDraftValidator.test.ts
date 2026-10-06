import { ValidationError } from '@/core/shared/errors';
import { AlertDraftValidator, type AlertDraft } from '@/modules/alerts/application/AlertDraft';
import { validDraft } from '../helpers/alertsHarness';
import { hazardTypes } from '../helpers/fixtures';

const validator = new AlertDraftValidator(hazardTypes());

function errorsFor(draft: AlertDraft): Record<string, string> {
  try {
    validator.validate(draft);
    return {};
  } catch (error) {
    if (error instanceof ValidationError) return { ...error.fieldErrors };
    throw error;
  }
}

describe('AlertDraftValidator (UC01 E1)', () => {
  it('accepts a complete draft', () => {
    expect(errorsFor(validDraft())).toEqual({});
  });

  it('highlights every missing field at once', () => {
    const errors = errorsFor(validDraft({ hazardTypeCode: '', severity: '', title: '', description: '', targetIds: [], validityHours: 0 }));
    expect(Object.keys(errors).sort()).toEqual(['description', 'hazardTypeCode', 'severity', 'targetIds', 'title', 'validityHours']);
    expect(errors.title).toBe('Enter a headline');
  });

  it.each([
    [{ title: 'Abc' }, 'title', 'at least 5'],
    [{ title: 'x'.repeat(81) }, 'title', 'at most 80'],
    [{ description: 'too short' }, 'description', 'at least 15'],
    [{ targetScope: 'RIVER_BASIN' as const, targetIds: ['KALU', 'GIN'] }, 'targetIds', 'exactly one'],
    [{ validityHours: Number.NaN }, 'validityHours', 'at least 1 hour'],
    [{ hazardTypeCode: 'TSUNAMI', validityHours: 13 }, 'validityHours', 'cannot exceed 12 hours'],
  ])('rejects %j', (patch, field, message) => {
    expect(errorsFor(validDraft(patch))[field]).toContain(message);
  });

  it('allows long validity for slow-onset hazards such as drought', () => {
    expect(errorsFor(validDraft({ hazardTypeCode: 'DROUGHT', validityHours: 24 * 21 }))).toEqual({});
  });

  it('accepts boundary values', () => {
    expect(errorsFor(validDraft({ title: 'Flood', description: 'x'.repeat(15), validityHours: 1 }))).toEqual({});
  });
});
