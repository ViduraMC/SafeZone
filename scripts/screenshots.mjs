/**
 * Captures the UI screenshots used in the Assignment 02 report.
 * Usage: npm run build && npx vite preview --port 4173 & node scripts/screenshots.mjs
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SAFEZONE_URL ?? 'http://localhost:4173/';
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Asia/Colombo', locale: 'en-LK' });
const page = await context.newPage();
page.on('pageerror', (error) => console.error('PAGE ERROR', error.message));

async function open(persona, route = '/') {
  await page.goto(`${BASE}?persona=${persona}#${route}`);
  await page.waitForSelector('.phone, .takeover');
}
async function go(route) {
  await page.evaluate((r) => (window.location.hash = r), route);
  await page.waitForTimeout(150);
}
async function shot(name, fullPage = true) {
  await page.waitForTimeout(150);
  // Full-page captures: keep the tab bar at the end of the page instead of floating mid-image.
  if (fullPage) await page.addStyleTag({ content: '.tabbar{position:static!important}' });
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage });
  console.log('saved', name);
}

// ---------- UC01 Issue Hazard Warning ----------
await open('USR-DMC', '/warnings');
await shot('uc01-01-warning-dashboard');
await go('/warnings/new');
await page.getByRole('button', { name: 'Validate & Review' }).click();
await shot('uc01-02-form-validation-errors');
await page.selectOption('#hazard', 'FLOOD');
await page.getByRole('tab', { name: 'Critical' }).click();
await page.getByRole('tab', { name: 'By River Basin' }).click();
await page.selectOption('select[aria-label="River basin"]', 'KALU');
await page.fill('#title', 'Kalu Ganga flood warning - Ratnapura');
await page.fill('#desc', 'Kalu Ganga has exceeded the major flood level at Ratnapura. Residents in low-lying areas must evacuate to designated shelters immediately.');
await page.fill('#validity', '24');
await shot('uc01-03-form-filled');
await page.getByRole('button', { name: 'Validate & Review' }).click();
await shot('uc01-04-review-confirm');
await page.getByRole('button', { name: 'Issue Warning' }).click();
await page.waitForSelector('text=Official hazard warning issued');
await shot('uc01-05-issued-delivery-summary');
await page.getByRole('link', { name: 'Monitor delivery' }).click();
await shot('uc01-06-monitor-and-escalate');
await open('USR-CITIZEN', '/');
await shot('uc01-07-citizen-critical-alert', false);
await go('/alerts');
await shot('uc01-08-citizen-active-warnings');
await page.locator('.list-card').first().click();
await shot('uc01-09-citizen-warning-detail');

// ---------- UC02 Submit & Verify Hazard Report ----------
await open('USR-VOLUNTEER', '/report');
await page.getByRole('button', { name: 'Submit Urgent Report' }).click();
await shot('uc02-01-report-missing-fields');
await page.selectOption('#hazard-type', 'FLOOD');
await page.getByRole('button', { name: 'Use my GPS location' }).click();
await page.waitForSelector('text=GPS Locked');
await page.fill('#description', 'Water level near Kaduwela bridge has risen about one metre in the last hour; the road is closing.');
await page.getByRole('tab', { name: 'High / Critical' }).click();
await page.setInputFiles('input[type=file]', { name: 'bridge.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') });
await page.setInputFiles('input[type=file]', { name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
await shot('uc02-02-report-form-invalid-photo');
await page.getByRole('button', { name: 'Submit Urgent Report' }).click();
await shot('uc02-03-report-submitted');
await page.click('.pill');
await go('/report');
await page.reload();
await page.waitForSelector('.phone');
await page.click('.pill');
await page.selectOption('#hazard-type', 'LANDSLIDE');
await page.getByRole('button', { name: 'Use my GPS location' }).click();
await page.waitForSelector('text=GPS Locked');
await page.fill('#description', 'Small landslide blocking the footpath behind the school.');
await page.getByRole('tab', { name: 'Medium' }).click();
await page.setInputFiles('input[type=file]', { name: 'slope.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') });
await page.getByRole('button', { name: 'Submit Urgent Report' }).click();
await shot('uc02-04-offline-pending-sync');
await go('/hub');
await shot('uc02-05-hub-offline-outbox');
await open('USR-CITIZEN', '/my-reports');
await page.locator('.list-card').first().click();
await shot('uc02-06-citizen-more-info-requested');
await open('USR-DUTY', '/review');
await shot('uc02-07-duty-review-queue');
await page.locator('.list-card').first().click();
await shot('uc02-08-duty-review-verify');
await page.getByRole('tab', { name: 'Reject' }).click();
await page.getByRole('button', { name: 'Reject Report' }).click();
await shot('uc02-09-duty-reject-reason-required');

// ---------- UC03 Coordinate Emergency Shelters ----------
await open('USR-DISTRICT', '/coordination');
await shot('uc03-01-coordination-overview');
await go('/coordination/shelters');
await shot('uc03-02-shelter-list');
await go('/coordination/shelters/SHL-KADU-CH');
await page.fill('#people', '45');
await page.getByRole('button', { name: 'Confirm allocation' }).click();
await shot('uc03-03-shelter-near-capacity');
await page.fill('#people', '40');
await page.getByRole('button', { name: 'Confirm allocation' }).click();
await shot('uc03-04-shelter-capacity-exceeded-alternatives');
await page.fill('#reason', 'Flood water entered the hall');
await page.getByRole('button', { name: 'Mark unavailable' }).click();
await shot('uc03-05-shelter-unavailable');
await open('USR-CITIZEN', '/shelters');
await shot('uc03-06-citizen-nearest-shelters');
await go('/shelters/SHL-KADU-CH');
await shot('uc03-07-citizen-shelter-detail');

// ---------- UC04 Dispatch Rescue Teams & Relief Resources ----------
await open('USR-DISTRICT', '/coordination/teams');
await shot('uc04-01-rescue-teams');
await page.getByRole('button', { name: /Search teams/ }).click();
await page.locator('.card', { hasText: 'SL Navy Boat Team - Kalutara' }).getByRole('button', { name: 'Select for dispatch' }).click();
await page.fill('#loc', 'Kolonnawa market - shops flooded');
await shot('uc04-02-dispatch-cross-organisation');
await go('/coordination/relief');
await page.locator('.stock', { hasText: 'Essential medicine packs' }).click();
await page.fill('#qty', '60');
await page.getByRole('button', { name: 'Confirm allocation' }).click();
await shot('uc04-03-relief-insufficient-stock');
await open('USR-RESCUE', '/rescue');
await shot('uc04-04-rescue-team-status');
await page.getByRole('button', { name: 'Confirm: En Route' }).click();
await page.getByRole('button', { name: 'Confirm: On Scene' }).click();
await page.fill('#rescued', '6');
await page.fill('#notes', 'Two families moved to Hanwella Central College');
await shot('uc04-05-rescue-mission-outcome');

// ---------- UC05 Generate Disaster Response Reports ----------
await open('USR-OFFICIAL', '/reports');
await page.selectOption('#event', 'EVT-SOUTHERN-FLOODS-2026');
await shot('uc05-01-report-criteria');
await page.getByRole('button', { name: 'Generate report' }).click();
await page.waitForSelector('text=Report generated');
await shot('uc05-02-generated-report');
await page.getByRole('button', { name: 'Change criteria' }).click();
await page.fill('input[aria-label=From]', '2026-06-10');
await page.fill('input[aria-label=To]', '2026-06-01');
await page.getByRole('button', { name: 'Generate report' }).click();
await shot('uc05-03-invalid-period');
await open('USR-DONOR', '/reports');
await page.getByRole('button', { name: 'Shelter Occupancy' }).click();
await page.getByRole('button', { name: 'Generate report' }).click();
await shot('uc05-04-donor-unauthorised');
await page.getByRole('button', { name: 'Shelter Occupancy' }).click();
await page.getByRole('button', { name: 'Generate report' }).click();
await page.waitForSelector('text=Report generated');
await shot('uc05-05-donor-specific-report');

await browser.close();
