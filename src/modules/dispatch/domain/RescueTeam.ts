import { DomainError } from '@/core/shared/errors';

/**
 * Operational status. Aligns the class diagram (STANDBY / DISPATCHED /
 * ON_SITE / RETURNING) with the dispatch scenario, which uses "En Route" and
 * "On Scene".
 */
export enum RescueTeamStatus {
  STANDBY = 'STANDBY',
  DISPATCHED = 'DISPATCHED',
  EN_ROUTE = 'EN_ROUTE',
  ON_SCENE = 'ON_SCENE',
  RETURNING = 'RETURNING',
}

const NEXT_STATUSES: Readonly<Record<RescueTeamStatus, readonly RescueTeamStatus[]>> = {
  [RescueTeamStatus.STANDBY]: [RescueTeamStatus.DISPATCHED],
  [RescueTeamStatus.DISPATCHED]: [RescueTeamStatus.EN_ROUTE, RescueTeamStatus.STANDBY],
  [RescueTeamStatus.EN_ROUTE]: [RescueTeamStatus.ON_SCENE],
  [RescueTeamStatus.ON_SCENE]: [RescueTeamStatus.RETURNING],
  [RescueTeamStatus.RETURNING]: [RescueTeamStatus.STANDBY],
};

export function nextStatuses(status: RescueTeamStatus): readonly RescueTeamStatus[] {
  return NEXT_STATUSES[status];
}

export interface RescueAssignment {
  readonly districtId: string;
  readonly locationDescription: string;
  readonly assignedBy: string;
  readonly assignedAt: Date;
  readonly eventId?: string;
  /** UC04 A1: team borrowed from another district or organisation. */
  readonly crossOrganisation: boolean;
}

/** Outcome of a finished mission (feeds the UC05 rescue operations report). */
export interface MissionRecord {
  readonly assignment: RescueAssignment;
  readonly onSceneAt?: Date;
  readonly completedAt: Date;
  readonly peopleRescued: number;
  readonly notes: string;
}

export interface StatusLogEntry {
  readonly status: RescueTeamStatus;
  readonly at: Date;
}

export interface RescueTeamProps {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly homeDistrictId: string;
  readonly specialisation: string;
  readonly members: number;
}

export class RescueTeam {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly homeDistrictId: string;
  readonly specialisation: string;
  readonly members: number;

  private _status = RescueTeamStatus.STANDBY;
  private _assignment?: RescueAssignment;
  private readonly _log: StatusLogEntry[] = [];
  private readonly _missions: MissionRecord[] = [];
  private _onSceneAt?: Date;

  constructor(props: RescueTeamProps) {
    this.id = props.id;
    this.name = props.name;
    this.ownerId = props.ownerId;
    this.homeDistrictId = props.homeDistrictId;
    this.specialisation = props.specialisation;
    this.members = props.members;
  }

  get status(): RescueTeamStatus {
    return this._status;
  }

  get assignment(): RescueAssignment | undefined {
    return this._assignment;
  }

  get statusLog(): readonly StatusLogEntry[] {
    return [...this._log];
  }

  get missions(): readonly MissionRecord[] {
    return [...this._missions];
  }

  get isAvailable(): boolean {
    return this._status === RescueTeamStatus.STANDBY;
  }

  dispatch(assignment: RescueAssignment): void {
    if (!this.isAvailable) throw new DomainError(`${this.name} is not on standby`);
    if (assignment.locationDescription.trim().length === 0) throw new DomainError('Describe where the team should go');
    this._assignment = assignment;
    this.changeStatus(RescueTeamStatus.DISPATCHED, assignment.assignedAt);
  }

  updateStatus(next: RescueTeamStatus, at: Date): void {
    if (next === RescueTeamStatus.RETURNING) {
      throw new DomainError('Record the mission outcome to finish the mission');
    }
    this.requireTransition(next);
    this.changeStatus(next, at);
    if (next === RescueTeamStatus.ON_SCENE) this._onSceneAt = at;
    if (next === RescueTeamStatus.STANDBY) {
      this._assignment = undefined;
      this._onSceneAt = undefined;
    }
  }

  /** Finishes the mission on scene, records how many people were rescued, and starts the return. */
  completeMission(peopleRescued: number, notes: string, at: Date): MissionRecord {
    this.requireTransition(RescueTeamStatus.RETURNING);
    if (!Number.isInteger(peopleRescued) || peopleRescued < 0) {
      throw new DomainError('People rescued must be a whole number of zero or more');
    }
    const record: MissionRecord = {
      assignment: this._assignment as RescueAssignment,
      onSceneAt: this._onSceneAt,
      completedAt: at,
      peopleRescued,
      notes: notes.trim(),
    };
    this._missions.push(record);
    this.changeStatus(RescueTeamStatus.RETURNING, at);
    return record;
  }

  private requireTransition(next: RescueTeamStatus): void {
    if (!NEXT_STATUSES[this._status].includes(next)) {
      throw new DomainError(`Cannot change team status from ${this._status} to ${next}`);
    }
  }

  private changeStatus(status: RescueTeamStatus, at: Date): void {
    this._status = status;
    this._log.push({ status, at });
  }
}
