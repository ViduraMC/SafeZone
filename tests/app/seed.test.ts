import { createSafeZone } from '@/app/container';
import { CURRENT_EVENT_ID, PAST_EVENT_ID, seedDemoData } from '@/app/demo/seed';
import { PERSONA_IDS } from '@/app/demo/personas';
import { ReportCategory } from '@/modules/analytics/domain/ReportCriteria';

describe('demo world (integration of all five use cases)', () => {
  const now = new Date('2026-10-06T12:00:00+05:30');

  it('seeds every module through the real services without errors', async () => {
    const app = createSafeZone();
    await seedDemoData(app, now);
    app.clock.freezeAt(now);

    expect(app.alerts.listActive().length).toBeGreaterThanOrEqual(3);
    expect(app.reportVerification.pendingQueue().length).toBe(2);
    expect(app.reportVerification.listVerified()).toHaveLength(1);
    expect(app.overview.activeEvents().map((e) => e.id)).toContain(CURRENT_EVENT_ID);
    app.dispose();
  });

  it('produces a complete post-event report for the past event', async () => {
    const app = createSafeZone();
    await seedDemoData(app, now);
    app.clock.freezeAt(now);
    const report = app.reportGenerator.generate(
      {
        eventId: PAST_EVENT_ID,
        categories: Object.values(ReportCategory),
        districtIds: [],
        from: new Date('2026-05-19T00:00:00+05:30'),
        to: new Date('2026-05-29T00:00:00+05:30'),
      },
      app.users.get(PERSONA_IDS.dmcOfficial),
    );
    expect(report.sections).toHaveLength(5);
    expect(report.notices).toEqual([]);
    app.dispose();
  });
});
