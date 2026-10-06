import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { createSafeZone, type SafeZoneApp } from '@/app/container';
import { PERSONA_IDS } from '@/app/demo/personas';
import { seedDemoData } from '@/app/demo/seed';
import { AppRoutes } from '@/ui/App';
import { AppProvider } from '@/ui/AppContext';

const NOW = new Date('2026-10-06T06:30:00Z');

async function renderAs(persona: string, route: string): Promise<SafeZoneApp> {
  window.localStorage.clear();
  const app = createSafeZone();
  await seedDemoData(app, NOW);
  app.clock.freezeAt(NOW);
  render(
    <AppProvider app={app} initialUserId={persona}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProvider>,
  );
  return app;
}

describe('UI screens (presentation layer smoke tests)', () => {
  afterEach(() => window.localStorage.clear());

  it('shows the critical alert takeover to a citizen in an affected district', async () => {
    await renderAs(PERSONA_IDS.citizen, '/');
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Kelani River Basin Spillover');
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss Alert' }));
    expect(screen.getByRole('heading', { name: 'Hello, Nimali' })).toBeInTheDocument();
  });

  it('highlights missing fields on the hazard warning form (UC01 E1)', async () => {
    await renderAs(PERSONA_IDS.dmcOfficer, '/warnings/new');
    await userEvent.click(screen.getByRole('button', { name: 'Validate & Review' }));
    expect(screen.getByText('Select a hazard type')).toBeInTheDocument();
    expect(screen.getByText('Enter a headline')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Headline'), 'Flash flood in Colombo');
    expect(screen.queryByText('Enter a headline')).not.toBeInTheDocument();
  });

  it('lists the duty officer review queue and verifies a report (UC02)', async () => {
    const app = await renderAs(PERSONA_IDS.dutyOfficer, '/review');
    const queue = screen.getAllByRole('link').filter((link) => link.className.includes('list-card'));
    expect(queue).toHaveLength(2);

    await userEvent.click(queue[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Verify Report' }));
    expect(app.reportVerification.pendingQueue()).toHaveLength(1);
  });

  it('shows a shortage message when relief stock is insufficient (UC03 E3)', async () => {
    await renderAs(PERSONA_IDS.districtOfficer, '/coordination/relief');
    await userEvent.click(screen.getByRole('button', { name: /Essential medicine packs/ }));
    const quantity = screen.getByLabelText(/Quantity/);
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '999');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm allocation' }));
    expect(screen.getByText(/Only 40 available/)).toBeInTheDocument();
  });

  it('generates a post-event report for a DMC official (UC04)', async () => {
    await renderAs(PERSONA_IDS.dmcOfficial, '/reports');
    await userEvent.selectOptions(screen.getByLabelText('Disaster event'), 'EVT-SOUTHERN-FLOODS-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Generate report' }));
    expect(screen.getByRole('heading', { name: 'Report generated' })).toBeInTheDocument();
    const reach = screen.getByText('Citizens reached').closest('.section-title')?.nextElementSibling as HTMLElement;
    expect(within(reach).getByText('100%')).toBeInTheDocument();
  });
});
