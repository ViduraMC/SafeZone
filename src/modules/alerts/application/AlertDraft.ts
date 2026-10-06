import type { HazardTypeRegistry } from '@/core/hazard/HazardType';
import { isSeverityLevel, type SeverityLevel } from '@/core/hazard/SeverityLevel';
import { FieldErrors, isBlank } from '@/core/shared/Validator';
import type { TargetScope } from '../domain/TargetArea';

/** Data captured by the Hazard Warning form (UC01 main flow steps 5-8). */
export interface AlertDraft {
  readonly hazardTypeCode: string;
  readonly severity: SeverityLevel | '';
  readonly title: string;
  readonly description: string;
  readonly targetScope: TargetScope;
  readonly targetIds: readonly string[];
  readonly validityHours: number;
  readonly eventId?: string;
  readonly supportingReportIds?: readonly string[];
}

export const TITLE_MIN = 5;
export const TITLE_MAX = 80;
export const DESCRIPTION_MIN = 15;

/** UC01 E1 "Invalid Warning Information": reports every invalid field at once. */
export class AlertDraftValidator {
  constructor(private readonly hazardTypes: HazardTypeRegistry) {}

  validate(draft: AlertDraft): void {
    const errors = new FieldErrors();
    const hazardKnown = this.hazardTypes.has(draft.hazardTypeCode);
    errors
      .require(hazardKnown, 'hazardTypeCode', 'Select a hazard type')
      .require(isSeverityLevel(draft.severity), 'severity', 'Select a warning level')
      .require(!isBlank(draft.title), 'title', 'Enter a headline')
      .require(draft.title.trim().length >= TITLE_MIN, 'title', `Headline must be at least ${TITLE_MIN} characters`)
      .require(draft.title.trim().length <= TITLE_MAX, 'title', `Headline must be at most ${TITLE_MAX} characters`)
      .require(
        draft.description.trim().length >= DESCRIPTION_MIN,
        'description',
        `Describe the hazard and required action (at least ${DESCRIPTION_MIN} characters)`,
      )
      .require(draft.targetIds.length > 0, 'targetIds', 'Select the affected district(s) or river basin')
      .require(
        draft.targetScope !== 'RIVER_BASIN' || draft.targetIds.length === 1,
        'targetIds',
        'Select exactly one river basin',
      )
      .require(Number.isFinite(draft.validityHours) && draft.validityHours >= 1, 'validityHours', 'Validity must be at least 1 hour');

    if (hazardKnown && Number.isFinite(draft.validityHours)) {
      const max = this.hazardTypes.get(draft.hazardTypeCode).maxValidityHours;
      errors.require(draft.validityHours <= max, 'validityHours', `Validity for this hazard cannot exceed ${max} hours`);
    }
    errors.throwIfAny();
  }
}
