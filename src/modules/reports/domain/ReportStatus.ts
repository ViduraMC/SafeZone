/**
 * Ground report lifecycle. Adds the two statuses that the UC02 scenario uses
 * but the original ReportStatus enum (PENDING / VERIFIED / REJECTED) omitted.
 */
export enum ReportStatus {
  /** Captured offline, stored on the device (UC02 E2). */
  PENDING_SYNC = 'PENDING_SYNC',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  /** Duty officer asked the reporter for more detail (UC02 A1). */
  NEEDS_MORE_INFO = 'NEEDS_MORE_INFO',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

const ALLOWED_TRANSITIONS: Readonly<Record<ReportStatus, readonly ReportStatus[]>> = {
  [ReportStatus.PENDING_SYNC]: [ReportStatus.PENDING_VERIFICATION],
  [ReportStatus.PENDING_VERIFICATION]: [ReportStatus.VERIFIED, ReportStatus.REJECTED, ReportStatus.NEEDS_MORE_INFO],
  [ReportStatus.NEEDS_MORE_INFO]: [ReportStatus.PENDING_VERIFICATION],
  [ReportStatus.VERIFIED]: [],
  [ReportStatus.REJECTED]: [],
};

export function canTransition(from: ReportStatus, to: ReportStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export const REPORT_STATUS_LABELS: Readonly<Record<ReportStatus, string>> = {
  [ReportStatus.PENDING_SYNC]: 'Pending Synchronization',
  [ReportStatus.PENDING_VERIFICATION]: 'Pending Verification',
  [ReportStatus.NEEDS_MORE_INFO]: 'Requires Additional Information',
  [ReportStatus.VERIFIED]: 'Verified',
  [ReportStatus.REJECTED]: 'Rejected',
};
