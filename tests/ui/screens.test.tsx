import { afterEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createSafeZone, type SafeZoneApp } from '@/app/container';
import { PERSONA_IDS } from '@/app/demo/personas';
import { seedDemoData } from '@/app/demo/seed';
import { App } from '@/ui/App';
import { AppProvider } from '@/ui/AppContext';

const NOW = new Date('2026-10-06T06:30:00Z');
const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

let current: SafeZoneApp | undefined;

/** Renders the real app, seeded with the demo data, as a persona on a given screen. */
async function renderAs(persona: string, path: string): Promise<SafeZoneApp> {
  const app = createSafeZone();
  await seedDemoData(app, NOW);
  app.clock.freezeAt(NOW);
  current = app;
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <AppProvider app={app} initialUserId={persona}>
        <App initialPath={path} />
      </AppProvider>
    </SafeAreaProvider>,
  );
  return app;
}

const press = (name: string | RegExp) => fireEvent.press(screen.getAllByRole('button', { name })[0]);

describe('React Native screens (presentation layer smoke tests)', () => {
  afterEach(() => current?.dispose());

  it('shows the critical alert takeover to a citizen in an affected district (UC01)', async () => {
    await renderAs(PERSONA_IDS.citizen, '/');
    expect(screen.getByText('CRITICAL ALERT')).toBeTruthy();
    expect(screen.getByText('Kelani River Basin Spillover')).toBeTruthy();
    await press('Dismiss Alert');
    expect(screen.getByText('Hello, Nimali')).toBeTruthy();
  });

  it('highlights missing fields on the hazard warning form and clears them on input (UC01 E1)', async () => {
    await renderAs(PERSONA_IDS.dmcOfficer, '/warnings/new');
    await press('Validate & Review');
    expect(screen.getByText('Select a hazard type')).toBeTruthy();
    expect(screen.getByText('Enter a headline')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Headline'), 'Flash flood in Colombo');
    expect(screen.queryByText('Enter a headline')).toBeNull();
  });

  it('lists the duty officer review queue and verifies a report (UC02)', async () => {
    const app = await renderAs(PERSONA_IDS.dutyOfficer, '/review');
    const queue = screen.getAllByRole('link', { name: /^Review / });
    expect(queue).toHaveLength(2);

    await fireEvent.press(queue[0]);
    await press('Verify Report');
    expect(app.reportVerification.pendingQueue()).toHaveLength(1);
  });

  it('warns the district officer when a shelter is near capacity (UC03 A1)', async () => {
    await renderAs(PERSONA_IDS.districtOfficer, '/coordination/shelters/SHL-KADU-CH');
    await fireEvent.changeText(screen.getByLabelText('Allocate evacuees'), '45');
    await press('Confirm allocation');
    expect(screen.getByText(/is approaching capacity/)).toBeTruthy();
    expect(screen.getByText('Alternative shelters')).toBeTruthy();
  });

  it('shows a shortage message when relief stock is insufficient (UC04 E1)', async () => {
    await renderAs(PERSONA_IDS.districtOfficer, '/coordination/relief');
    await press(/^Essential medicine packs/);
    await fireEvent.changeText(screen.getByLabelText('Quantity'), '500');
    await press('Confirm allocation');
    expect(screen.getByText(/Only \d+ available/)).toBeTruthy();
  });

  it('stops a donor from requesting restricted statistics (UC05 E3)', async () => {
    await renderAs(PERSONA_IDS.donor, '/reports');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Shelter Occupancy' }));
    await press('Generate report');
    expect(screen.getByText(/Donor organisations can only view/)).toBeTruthy();
  });
});
