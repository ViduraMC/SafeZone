import { DomainError } from '@/core/shared/errors';
import { isHigherSeverity, type SeverityLevel } from '@/core/hazard/SeverityLevel';
import type { TargetArea } from './TargetArea';

export enum AlertStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ESCALATED = 'ESCALATED',
  RESOLVED = 'RESOLVED',
}

export interface EscalationEntry {
  readonly from: SeverityLevel;
  readonly to: SeverityLevel;
  readonly reason: string;
  readonly escalatedBy: string;
  readonly at: Date;
  readonly supportingReportIds: readonly string[];
}

export interface HazardAlertProps {
  readonly id: string;
  readonly hazardTypeCode: string;
  readonly title: string;
  readonly description: string;
  readonly severity: SeverityLevel;
  readonly target: TargetArea;
  readonly validFrom: Date;
  readonly validUntil: Date;
  readonly issuedBy: string;
  readonly eventId?: string;
  readonly supportingReportIds?: readonly string[];
}

/**
 * Official hazard warning. Holds alert data and its lifecycle only (Single
 * Responsibility fix): targeting lives in TargetArea and delivery in
 * AlertBroadcaster, instead of createWarning()/broadcast() on this class.
 */
export class HazardAlert {
  readonly id: string;
  readonly hazardTypeCode: string;
  readonly title: string;
  readonly description: string;
  readonly target: TargetArea;
  readonly validFrom: Date;
  readonly validUntil: Date;
  readonly issuedBy: string;
  readonly eventId?: string;

  private _severity: SeverityLevel;
  private _status = AlertStatus.DRAFT;
  private _issuedAt?: Date;
  private _resolvedAt?: Date;
  private readonly _escalations: EscalationEntry[] = [];
  private readonly _supportingReportIds: Set<string>;

  private constructor(props: HazardAlertProps) {
    if (props.validUntil <= props.validFrom) {
      throw new DomainError('Warning validity must end after it starts');
    }
    this.id = props.id;
    this.hazardTypeCode = props.hazardTypeCode;
    this.title = props.title;
    this.description = props.description;
    this.target = props.target;
    this.validFrom = props.validFrom;
    this.validUntil = props.validUntil;
    this.issuedBy = props.issuedBy;
    this.eventId = props.eventId;
    this._severity = props.severity;
    this._supportingReportIds = new Set(props.supportingReportIds ?? []);
  }

  static draft(props: HazardAlertProps): HazardAlert {
    return new HazardAlert(props);
  }

  get severity(): SeverityLevel {
    return this._severity;
  }

  get status(): AlertStatus {
    return this._status;
  }

  get issuedAt(): Date | undefined {
    return this._issuedAt;
  }

  get resolvedAt(): Date | undefined {
    return this._resolvedAt;
  }

  get escalations(): readonly EscalationEntry[] {
    return [...this._escalations];
  }

  get supportingReportIds(): readonly string[] {
    return [...this._supportingReportIds];
  }

  /** Confirms a draft and makes it an official, broadcastable warning. */
  activate(at: Date): void {
    if (this._status !== AlertStatus.DRAFT) {
      throw new DomainError(`Only draft warnings can be issued (current status: ${this._status})`);
    }
    this._status = AlertStatus.ACTIVE;
    this._issuedAt = at;
  }

  escalate(to: SeverityLevel, reason: string, escalatedBy: string, at: Date, supportingReportIds: readonly string[] = []): void {
    if (!this.isLive()) {
      throw new DomainError('Only active warnings can be escalated');
    }
    if (!isHigherSeverity(to, this._severity)) {
      throw new DomainError(`Escalation must raise the level above ${this._severity}`);
    }
    if (reason.trim().length === 0) {
      throw new DomainError('A reason is required to escalate a warning');
    }
    this._escalations.push({ from: this._severity, to, reason: reason.trim(), escalatedBy, at, supportingReportIds });
    supportingReportIds.forEach((id) => this._supportingReportIds.add(id));
    this._severity = to;
    this._status = AlertStatus.ESCALATED;
  }

  resolve(at: Date): void {
    if (!this.isLive()) {
      throw new DomainError('Only active warnings can be resolved');
    }
    this._status = AlertStatus.RESOLVED;
    this._resolvedAt = at;
  }

  /** True while the warning is official and inside its validity window. */
  isActiveAt(at: Date): boolean {
    return this.isLive() && this.validFrom <= at && at < this.validUntil;
  }

  private isLive(): boolean {
    return this._status === AlertStatus.ACTIVE || this._status === AlertStatus.ESCALATED;
  }
}
