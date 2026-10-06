/**
 * Port through which UC01 reads duty-officer-verified ground reports ("check
 * verified reports" in the UC01 sequence diagram). Implemented by the reports
 * module, so the alert module never depends on GroundReport directly
 * (Dependency Inversion fix: HazardAlert used to call ReportVerification).
 */
export interface VerifiedReportSummary {
  readonly reportId: string;
  readonly hazardTypeCode: string;
  readonly districtId: string;
  readonly summary: string;
  readonly credibilityScore: number;
  readonly verifiedAt: Date;
  readonly verifiedBy: string;
}

export interface VerifiedReportFeed {
  listVerified(districtIds?: readonly string[]): VerifiedReportSummary[];
}
