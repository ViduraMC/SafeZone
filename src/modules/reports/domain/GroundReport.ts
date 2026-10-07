import { DomainError } from '@/core/shared/errors';
import type { Evidence } from './Evidence';
import type { ReportLocation } from './ReportLocation';
import { canTransition, ReportStatus } from './ReportStatus';

export type SeverityAssessment = 'LOW' | 'MEDIUM' | 'HIGH';
export type ReporterKind = 'CITIZEN' | 'VOLUNTEER';
export type ReviewDecision = 'VERIFIED' | 'REJECTED' | 'INFO_REQUESTED';

/**
 * One duty-officer review. A report can collect several (the original 1:1
 * GroundReport-ReportVerification multiplicity could not support the
 * "request more information" loop).
 */
export interface ReportReview {
  readonly officerId: string;
  readonly decision: ReviewDecision;
  readonly comment: string;
  readonly at: Date;
  readonly credibilityScore?: number;
}

export interface StatusChange {
  readonly from?: ReportStatus;
  readonly to: ReportStatus;
  readonly at: Date;
}

export interface Supplement {
  readonly text: string;
  readonly evidence: readonly Evidence[];
  readonly at: Date;
}

export interface GroundReportProps {
  readonly id: string;
  readonly reporterId: string;
  readonly reporterKind: ReporterKind;
  readonly hazardTypeCode: string;
  readonly description: string;
  readonly severityAssessment: SeverityAssessment;
  readonly location: ReportLocation;
  readonly evidence: readonly Evidence[];
  readonly submittedAt: Date;
}

export const MIN_CREDIBILITY = 1;
export const MAX_CREDIBILITY = 5;

/** Citizen/volunteer hazard observation and its verification state machine. */
export class GroundReport {
  readonly id: string;
  readonly reporterId: string;
  readonly reporterKind: ReporterKind;
  readonly hazardTypeCode: string;
  readonly description: string;
  readonly severityAssessment: SeverityAssessment;
  readonly location: ReportLocation;
  readonly submittedAt: Date;

  private _status: ReportStatus;
  private readonly _evidence: Evidence[];
  private readonly _reviews: ReportReview[] = [];
  private readonly _history: StatusChange[] = [];
  private readonly _supplements: Supplement[] = [];

  private constructor(props: GroundReportProps, initialStatus: ReportStatus) {
    this.id = props.id;
    this.reporterId = props.reporterId;
    this.reporterKind = props.reporterKind;
    this.hazardTypeCode = props.hazardTypeCode;
    this.description = props.description;
    this.severityAssessment = props.severityAssessment;
    this.location = props.location;
    this.submittedAt = props.submittedAt;
    this._evidence = [...props.evidence];
    this._status = initialStatus;
    this._history.push({ to: initialStatus, at: props.submittedAt });
  }

  /** Online submissions go straight to verification; offline ones wait for sync (E2). */
  static submit(props: GroundReportProps, capturedOffline: boolean): GroundReport {
    return new GroundReport(props, capturedOffline ? ReportStatus.PENDING_SYNC : ReportStatus.PENDING_VERIFICATION);
  }

  get status(): ReportStatus {
    return this._status;
  }

  get evidence(): readonly Evidence[] {
    return [...this._evidence];
  }

  get reviews(): readonly ReportReview[] {
    return [...this._reviews];
  }

  get history(): readonly StatusChange[] {
    return [...this._history];
  }

  get supplements(): readonly Supplement[] {
    return [...this._supplements];
  }

  get latestReview(): ReportReview | undefined {
    return this._reviews[this._reviews.length - 1];
  }

  get verifiedReview(): ReportReview | undefined {
    return this._reviews.find((review) => review.decision === 'VERIFIED');
  }

  markSynced(at: Date): void {
    this.transitionTo(ReportStatus.PENDING_VERIFICATION, at);
  }

  verify(officerId: string, credibilityScore: number, comment: string, at: Date): void {
    if (!Number.isInteger(credibilityScore) || credibilityScore < MIN_CREDIBILITY || credibilityScore > MAX_CREDIBILITY) {
      throw new DomainError(`Credibility score must be a whole number from ${MIN_CREDIBILITY} to ${MAX_CREDIBILITY}`);
    }
    this.transitionTo(ReportStatus.VERIFIED, at);
    this._reviews.push({ officerId, decision: 'VERIFIED', comment: comment.trim(), credibilityScore, at });
  }

  reject(officerId: string, reason: string, at: Date): void {
    requireText(reason, 'A rejection reason is required');
    this.transitionTo(ReportStatus.REJECTED, at);
    this._reviews.push({ officerId, decision: 'REJECTED', comment: reason.trim(), at });
  }

  requestMoreInformation(officerId: string, question: string, at: Date): void {
    requireText(question, 'Tell the reporter what information is needed');
    this.transitionTo(ReportStatus.NEEDS_MORE_INFO, at);
    this._reviews.push({ officerId, decision: 'INFO_REQUESTED', comment: question.trim(), at });
  }

  /** Reporter answers an information request; the report returns to the review queue. */
  supplement(text: string, evidence: readonly Evidence[], at: Date): void {
    requireText(text, 'Provide the requested information');
    this.transitionTo(ReportStatus.PENDING_VERIFICATION, at);
    this._supplements.push({ text: text.trim(), evidence: [...evidence], at });
    this._evidence.push(...evidence);
  }

  private transitionTo(next: ReportStatus, at: Date): void {
    if (!canTransition(this._status, next)) {
      throw new DomainError(`A report that is ${this._status} cannot become ${next}`);
    }
    this._history.push({ from: this._status, to: next, at });
    this._status = next;
  }
}

function requireText(value: string, message: string): void {
  if (value.trim().length === 0) throw new DomainError(message);
}
