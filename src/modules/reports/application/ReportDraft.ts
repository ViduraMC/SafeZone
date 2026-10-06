import type { HazardTypeRegistry } from '@/core/hazard/HazardType';
import { FieldErrors } from '@/core/shared/Validator';
import { MAX_PHOTOS_PER_REPORT, type Evidence } from '../domain/Evidence';
import type { SeverityAssessment } from '../domain/GroundReport';
import type { ReportLocation } from '../domain/ReportLocation';

/** Data entered on the "Report Incident" screen (UC02 main flow steps 3-7). */
export interface ReportDraft {
  readonly hazardTypeCode: string;
  readonly description: string;
  readonly severityAssessment: SeverityAssessment | '';
  readonly location?: ReportLocation;
  readonly photos: readonly Evidence[];
}

export const REPORT_DESCRIPTION_MIN = 10;
export const REPORT_DESCRIPTION_MAX = 1000;

/** UC02 E3 "Missing Required Information": highlights every missing field. */
export class ReportDraftValidator {
  constructor(private readonly hazardTypes: HazardTypeRegistry) {}

  validate(draft: ReportDraft): void {
    const description = draft.description.trim();
    new FieldErrors()
      .require(this.hazardTypes.has(draft.hazardTypeCode), 'hazardTypeCode', 'Select the incident type')
      .require(description.length >= REPORT_DESCRIPTION_MIN, 'description', `Describe what you see (at least ${REPORT_DESCRIPTION_MIN} characters)`)
      .require(description.length <= REPORT_DESCRIPTION_MAX, 'description', `Keep the description under ${REPORT_DESCRIPTION_MAX} characters`)
      .require(draft.severityAssessment !== '', 'severityAssessment', 'Choose a severity assessment')
      .require(draft.location !== undefined, 'location', 'Location is required - enable GPS or enter it manually')
      .require(draft.photos.length >= 1, 'photos', 'Add at least one photo of the hazard')
      .require(draft.photos.length <= MAX_PHOTOS_PER_REPORT, 'photos', `Attach at most ${MAX_PHOTOS_PER_REPORT} photos`)
      .throwIfAny();
  }
}
