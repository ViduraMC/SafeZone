import type { Clock } from '@/core/shared/Clock';
import { AuthorizationError, NotFoundError } from '@/core/shared/errors';
import type { GeoDirectory } from '@/core/geo/GeoDirectory';
import type { InboxService } from '@/core/notifications/Inbox';
import type { Repository } from '@/core/shared/Repository';
import { hasRole, Role, requireRole, type UserAccount } from '@/core/users/UserAccount';
import type { UserDirectory } from '@/core/users/UserDirectory';
import type { MissionRecord, RescueTeam, RescueTeamStatus } from '../domain/RescueTeam';
import type { FieldUpdateRecorder } from '@/core/sync/FieldUpdateRecorder';

export interface DispatchRequest {
  readonly districtId: string;
  readonly locationDescription: string;
  readonly eventId?: string;
}

/** UC04 rescue team dispatch: availability, cross-organisation teams (A1), status updates and mission outcome. */
export class RescueDispatchService {
  constructor(
    private readonly teams: Repository<RescueTeam>,
    private readonly updates: FieldUpdateRecorder,
    private readonly inbox: InboxService,
    private readonly users: UserDirectory,
    private readonly geo: GeoDirectory,
    private readonly clock: Clock,
  ) {}

  getTeam(teamId: string): RescueTeam {
    const team = this.teams.findById(teamId);
    if (!team) throw new NotFoundError('Rescue team', teamId);
    return team;
  }

  /** Standby teams based in the district. */
  availableInDistrict(districtId: string): RescueTeam[] {
    return this.teams.findWhere((team) => team.isAvailable && team.homeDistrictId === districtId);
  }

  /** A1: standby teams from other districts or organisations that could be borrowed. */
  availableElsewhere(districtId: string): RescueTeam[] {
    return this.teams.findWhere((team) => team.isAvailable && team.homeDistrictId !== districtId);
  }

  /** Teams currently working in the district (any non-standby status). */
  deployedTo(districtId: string): RescueTeam[] {
    return this.teams.findWhere((team) => team.assignment?.districtId === districtId);
  }

  allTeams(): RescueTeam[] {
    return this.teams.findAll();
  }

  dispatch(teamId: string, request: DispatchRequest, officer: UserAccount): RescueTeam {
    requireRole(officer, Role.DISTRICT_OFFICER);
    const team = this.getTeam(teamId);
    this.geo.getDistrict(request.districtId);
    team.dispatch({
      districtId: request.districtId,
      locationDescription: request.locationDescription.trim(),
      eventId: request.eventId,
      assignedBy: officer.id,
      assignedAt: this.clock.now(),
      crossOrganisation: team.homeDistrictId !== request.districtId,
    });
    this.teams.save(team);
    this.updates.record(team.id, `Dispatched ${team.name} to ${request.locationDescription.trim()}`);
    this.notifyTeamMembers(team, request);
    return team;
  }

  /** Steps 6-7: the team (or the officer on its behalf, A4) reports its progress. */
  updateStatus(teamId: string, status: RescueTeamStatus, actor: UserAccount): RescueTeam {
    requireRole(actor, Role.RESCUE_TEAM_MEMBER, Role.DISTRICT_OFFICER);
    const team = this.getTeam(teamId);
    this.ensureCanUpdate(actor, team);
    team.updateStatus(status, this.clock.now());
    this.teams.save(team);
    this.updates.record(team.id, `${team.name} is now ${status}`);
    return team;
  }

  /** District officers may update any team; a team member only their own team. */
  /** Main flow step 8: the team reports the outcome and starts returning. */
  completeMission(teamId: string, peopleRescued: number, notes: string, actor: UserAccount): MissionRecord {
    requireRole(actor, Role.RESCUE_TEAM_MEMBER, Role.DISTRICT_OFFICER);
    const team = this.getTeam(teamId);
    this.ensureCanUpdate(actor, team);
    const record = team.completeMission(peopleRescued, notes, this.clock.now());
    this.teams.save(team);
    this.updates.record(team.id, `${team.name} completed its mission (${peopleRescued} rescued)`);
    return record;
  }

  private ensureCanUpdate(actor: UserAccount, team: RescueTeam): void {
    if (!hasRole(actor, Role.DISTRICT_OFFICER) && actor.rescueTeamId !== team.id) {
      throw new AuthorizationError('You can only update the status of your own team');
    }
  }

  private notifyTeamMembers(team: RescueTeam, request: DispatchRequest): void {
    this.users
      .findByRole(Role.RESCUE_TEAM_MEMBER)
      .filter((member) => member.rescueTeamId === team.id)
      .forEach((member) =>
        this.inbox.deliver({
          userId: member.id,
          kind: 'TASK',
          title: 'New rescue assignment',
          body: `${team.name}: proceed to ${request.locationDescription.trim()} (${this.geo.districtName(request.districtId)}).`,
          link: '/rescue',
        }),
      );
  }
}
