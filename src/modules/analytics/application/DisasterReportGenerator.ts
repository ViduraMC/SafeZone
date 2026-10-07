import type { DisasterEvent } from '@/core/events/DisasterEvent';
import type { GeoDirectory } from '@/core/geo/GeoDirectory';
import type { Clock } from '@/core/shared/Clock';
import { AuthorizationError, DomainError, NotFoundError, OperationFailedError, ValidationError } from '@/core/shared/errors';
import type { ErrorLog } from '@/core/shared/ErrorLog';
import type { IdGenerator } from '@/core/shared/IdGenerator';
import type { Repository } from '@/core/shared/Repository';
import type { UserAccount } from '@/core/users/UserAccount';
import { REPORT_CATEGORY_LABELS, ReportingPeriod, type ReportCategory } from '../domain/ReportCriteria';
import type { DisasterResponseReport, ReportSection } from '../domain/ReportSections';
import type { ReportAccessPolicy } from './ReportAccessPolicy';
import type { ReportSectionBuilder, SectionContext } from './SectionBuilders';

/** Raw filter values from the UI. */
export interface ReportRequest {
  readonly eventId: string;
  readonly categories: readonly ReportCategory[];
  readonly districtIds: readonly string[];
  readonly from: Date;
  readonly to: Date;
}

/**
 * Application service for UC05. Validates the criteria, applies the access
 * policy, then asks each registered section builder for its part of the report.
 * Statistics are computed by the builders and formatting by the exporters, so
 * this class only orchestrates (SRP fix for AnalysisReport).
 */
export class DisasterReportGenerator {
  private readonly builders: Map<ReportCategory, ReportSectionBuilder>;

  constructor(
    builders: readonly ReportSectionBuilder[],
    private readonly accessPolicies: readonly ReportAccessPolicy[],
    private readonly events: Repository<DisasterEvent>,
    private readonly geo: GeoDirectory,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly errorLog: ErrorLog,
  ) {
    this.builders = new Map(builders.map((builder) => [builder.category, builder]));
  }

  availableEvents(): DisasterEvent[] {
    return this.events.findAll().sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  supportedCategories(): ReportCategory[] {
    return [...this.builders.keys()];
  }

  generate(request: ReportRequest, user: UserAccount): DisasterResponseReport {
    const event = this.getEvent(request.eventId);
    const period = ReportingPeriod.of(request.from, request.to, this.clock.now());
    this.validateRequest(request, event, period);
    const scope = this.policyFor(user).authorise(request.categories, user);

    const districtIds = request.districtIds.length > 0 ? [...request.districtIds] : [...event.districtIds];
    const context: SectionContext = { eventId: event.id, districtIds, period, ownerId: scope.ownerId };
    const sections = request.categories.map((category) => this.buildSection(category, context));

    return {
      id: this.ids.next('DRR'),
      eventId: event.id,
      eventName: event.name,
      districtIds,
      periodFrom: period.from,
      periodTo: period.to,
      generatedAt: this.clock.now(),
      generatedBy: user.id,
      sections,
      notices: sections
        .filter((section) => !section.hasData)
        .map((section) => `No ${REPORT_CATEGORY_LABELS[section.category].toLowerCase()} data was recorded for the selected districts and period.`),
    };
  }

  private validateRequest(request: ReportRequest, event: DisasterEvent, period: ReportingPeriod): void {
    const errors: Record<string, string> = {};
    if (request.categories.length === 0) errors.categories = 'Select at least one report category';
    if (request.categories.some((category) => !this.builders.has(category))) errors.categories = 'Unsupported report category';
    const unknown = request.districtIds.filter((id) => !this.geo.findDistrict(id));
    if (unknown.length > 0) errors.districtIds = `Unknown district(s): ${unknown.join(', ')}`;
    if (!period.overlaps(event.startedAt, event.endedAt)) errors.period = 'The period does not overlap the selected disaster event';
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  }

  private policyFor(user: UserAccount): ReportAccessPolicy {
    const policy = this.accessPolicies.find((candidate) => candidate.supports(user));
    if (!policy) throw new AuthorizationError('You do not have access to disaster response reports');
    return policy;
  }

  /** E4: unexpected failures are logged and reported as a retryable error. */
  private buildSection(category: ReportCategory, context: SectionContext): ReportSection {
    const builder = this.builders.get(category) as ReportSectionBuilder;
    try {
      return builder.build(context);
    } catch (error) {
      if (error instanceof DomainError) throw error;
      this.errorLog.record(`generateReport:${category}`, error, this.clock.now());
      throw new OperationFailedError('The report could not be generated. Please try again.', error);
    }
  }

  private getEvent(eventId: string): DisasterEvent {
    const event = this.events.findById(eventId);
    if (!event) throw new NotFoundError('Disaster event', eventId);
    return event;
  }
}
