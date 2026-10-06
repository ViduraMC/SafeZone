import type { Clock } from '@/core/shared/Clock';
import { DomainError, NotFoundError } from '@/core/shared/errors';
import type { IdGenerator } from '@/core/shared/IdGenerator';
import type { Repository } from '@/core/shared/Repository';
import { Role, requireRole, type UserAccount } from '@/core/users/UserAccount';
import type { ReliefDistribution, ReliefStock } from '../domain/Relief';
import type { OrganisationDirectory, OwnerType, ResourceOwner } from '@/core/organisations/ResourceOwner';
import type { Shelter } from '@/modules/shelters/domain/Shelter';
import type { FieldUpdateRecorder } from '@/core/sync/FieldUpdateRecorder';

export interface DistributionRequest {
  readonly stockId: string;
  readonly quantity: number;
  readonly districtId: string;
  readonly shelterId?: string;
  readonly eventId?: string;
}

export interface StockView {
  readonly stock: ReliefStock;
  readonly owner: ResourceOwner;
}

/** UC04 relief supplies: pooled stock across owners (A2) and recorded distributions (steps 9-12, E1). */
export class ReliefDistributionService {
  constructor(
    private readonly stocks: Repository<ReliefStock>,
    private readonly organisations: OrganisationDirectory,
    private readonly distributions: Repository<ReliefDistribution>,
    private readonly shelters: Repository<Shelter>,
    private readonly updates: FieldUpdateRecorder,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** Available stock with its owner, optionally limited to some owner types. */
  availableStock(ownerTypes?: readonly OwnerType[]): StockView[] {
    return this.stocks
      .findWhere((stock) => stock.available > 0)
      .map((stock) => ({ stock, owner: this.organisations.get(stock.ownerId) }))
      .filter((view) => !ownerTypes || ownerTypes.includes(view.owner.type))
      .sort((a, b) => a.stock.category.localeCompare(b.stock.category) || b.stock.available - a.stock.available);
  }

  distribute(request: DistributionRequest, officer: UserAccount): ReliefDistribution {
    requireRole(officer, Role.DISTRICT_OFFICER);
    const stock = this.stocks.findById(request.stockId);
    if (!stock) throw new NotFoundError('Relief stock', request.stockId);
    if (request.shelterId) this.requireShelterInDistrict(request.shelterId, request.districtId);

    stock.withdraw(request.quantity);
    this.stocks.save(stock);
    const distribution = this.distributions.save({
      id: this.ids.next('DST'),
      stockId: stock.id,
      ownerId: stock.ownerId,
      category: stock.category,
      itemName: stock.itemName,
      unit: stock.unit,
      quantity: request.quantity,
      districtId: request.districtId,
      shelterId: request.shelterId,
      eventId: request.eventId,
      distributedBy: officer.id,
      distributedAt: this.clock.now(),
    });
    this.updates.record(distribution.id, `Distributed ${request.quantity} ${stock.unit} of ${stock.itemName}`);
    return distribution;
  }

  distributionsTo(districtId: string): ReliefDistribution[] {
    return this.distributions
      .findWhere((d) => d.districtId === districtId)
      .sort((a, b) => b.distributedAt.getTime() - a.distributedAt.getTime());
  }

  private requireShelterInDistrict(shelterId: string, districtId: string): void {
    const shelter = this.shelters.findById(shelterId);
    if (!shelter) throw new NotFoundError('Shelter', shelterId);
    if (shelter.districtId !== districtId) throw new DomainError('The shelter is not in the selected district');
  }
}
