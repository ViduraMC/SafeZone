import type { Clock } from '@/core/shared/Clock';
import { isEventOngoing, type DisasterEvent } from '@/core/events/DisasterEvent';
import type { Repository } from '@/core/shared/Repository';
import type { ReliefCategory, ReliefDistribution } from '@/modules/dispatch/domain/Relief';
import { RescueTeamStatus, type RescueTeam } from '@/modules/dispatch/domain/RescueTeam';
import { ShelterStatus, type Shelter } from '../domain/Shelter';

export interface ShelterTotals {
  readonly count: number;
  readonly capacity: number;
  readonly occupancy: number;
  readonly byStatus: Readonly<Record<ShelterStatus, number>>;
}

export interface OperationalOverview {
  readonly districtId: string;
  readonly shelters: ShelterTotals;
  readonly teamsByStatus: Readonly<Record<RescueTeamStatus, number>>;
  readonly suppliesDistributed: Readonly<Partial<Record<ReliefCategory, number>>>;
}

/** Combined operational picture for a district (UC03 steps 1-3 and the combined view postcondition). */
export class OperationalOverviewService {
  constructor(
    private readonly events: Repository<DisasterEvent>,
    private readonly shelters: Repository<Shelter>,
    private readonly teams: Repository<RescueTeam>,
    private readonly distributions: Repository<ReliefDistribution>,
    private readonly clock: Clock,
  ) {}

  /** Step 2: active disaster events and the districts they affect. */
  activeEvents(): DisasterEvent[] {
    const now = this.clock.now();
    return this.events.findWhere((event) => isEventOngoing(event, now));
  }

  overview(districtId: string): OperationalOverview {
    const shelters = this.shelters.findWhere((s) => s.districtId === districtId);
    const byStatus = countBy(Object.values(ShelterStatus), shelters.map((s) => s.status));
    const teams = this.teams.findWhere((t) => t.assignment?.districtId === districtId || (t.isAvailable && t.homeDistrictId === districtId));
    const teamsByStatus = countBy(Object.values(RescueTeamStatus), teams.map((t) => t.status));

    const suppliesDistributed: Partial<Record<ReliefCategory, number>> = {};
    this.distributions
      .findWhere((d) => d.districtId === districtId)
      .forEach((d) => {
        suppliesDistributed[d.category] = (suppliesDistributed[d.category] ?? 0) + d.quantity;
      });

    return {
      districtId,
      shelters: {
        count: shelters.length,
        capacity: sum(shelters.map((s) => s.capacity)),
        occupancy: sum(shelters.map((s) => s.occupancy)),
        byStatus,
      },
      teamsByStatus,
      suppliesDistributed,
    };
  }
}

function countBy<K extends string>(keys: readonly K[], values: readonly K[]): Record<K, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  values.forEach((value) => {
    counts[value] += 1;
  });
  return counts;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
