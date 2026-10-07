/**
 * Captures the UI screenshots used in the Assignment 02 report from the web
 * build of the React Native app (react-native-web renders the same screens).
 * Usage: npm run screenshots   (runs "expo export --platform web" first)
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 4173;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.json': 'application/json' };
mkdirSync(OUT, { recursive: true });

// Static server with a single-page-app fallback, so deep links like /review/GR-1 load index.html.
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(DIST, path);
  const target = existsSync(file) && extname(file) ? file : join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[extname(target)] ?? 'application/octet-stream' });
  res.end(readFileSync(target));
}).listen(PORT);

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Asia/Colombo', locale: 'en-LK' });
const page = await context.newPage();
page.on('pageerror', (error) => console.error('PAGE ERROR', error.message));

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function open(persona, route = '/') {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://localhost:${PORT}${route}?persona=${persona}`);
  await page.waitForSelector('[data-testid=screen-scroll], [role=alert]');
  await page.waitForTimeout(400);
}
const tab = (name) => page.getByRole('tab', { name, exact: true }).last().click();
const button = (name) => page.getByRole('button', { name, exact: true }).first().click();
async function select(label, option) {
  await page.getByRole('button', { name: label, exact: true }).first().click();
  await page.getByRole('button', { name: option, exact: true }).last().click();
}
async function upload(name, mimeType, buffer) {
  const chooser = page.waitForEvent('filechooser');
  await button('Upload');
  await (await chooser).setFiles({ name, mimeType, buffer });
  await page.waitForTimeout(300);
}

/** Grows the viewport to the scroll height so the whole screen is in one image. */
async function shot(name, fullPage = true) {
  await page.waitForTimeout(350);
  if (fullPage) {
    const height = await page.evaluate(() => {
      const scroll = [...document.querySelectorAll('[data-testid=screen-scroll]')].pop();
      return scroll ? Math.ceil(window.innerHeight - scroll.clientHeight + scroll.scrollHeight) : window.innerHeight;
    });
    await page.setViewportSize({ width: 390, height: Math.max(844, height) });
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: `${OUT}${name}.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  console.log('saved', name);
}

// ---------- UC01 Issue Hazard Warning ----------
await open('USR-DMC', '/warnings');
await shot('uc01-01-warning-dashboard');
await tab('Issue');
await button('Validate & Review');
await shot('uc01-02-form-validation-errors');
await select('Hazard type', 'Flood (fast-onset)');
await tab('Critical');
await tab('By River Basin');
await select('River basin', 'Kalu Ganga (Ratnapura, Kalutara)');
await page.getByLabel('Headline', { exact: true }).fill('Kalu Ganga flood warning - Ratnapura');
await page.getByLabel('Description and required action').fill('Kalu Ganga has exceeded the major flood level at Ratnapura. Residents in low-lying areas must evacuate to designated shelters immediately.');
await page.getByLabel('Validity (hours)').fill('24');
await shot('uc01-03-form-filled');
await button('Validate & Review');
await shot('uc01-04-review-confirm');
await button('Issue Warning');
await page.getByText('Official hazard warning issued').waitFor();
await shot('uc01-05-issued-delivery-summary');
await button('Monitor delivery');
await shot('uc01-06-monitor-and-escalate');
await open('USR-CITIZEN', '/');
await shot('uc01-07-citizen-critical-alert', false);
await button('Dismiss Alert');
await tab('Alerts');
await shot('uc01-08-citizen-active-warnings');
await page.getByRole('link', { name: 'Kelani River Basin Spillover' }).first().click();
await shot('uc01-09-citizen-warning-detail');

// ---------- UC02 Submit & Verify Hazard Report ----------
await open('USR-VOLUNTEER', '/report');
await button('Submit Urgent Report');
await shot('uc02-01-report-missing-fields');
await select('Incident type', 'Flood');
await button('Use my GPS location');
await page.getByText('GPS Locked').waitFor();
await page.getByLabel('Description', { exact: true }).fill('Water level near Kaduwela bridge has risen about one metre in the last hour; the road is closing.');
await tab('High / Critical');
await upload('bridge.png', 'image/png', PNG);
await upload('notes.pdf', 'application/pdf', Buffer.from('%PDF-1.4'));
await shot('uc02-02-report-form-invalid-photo');
await button('Submit Urgent Report');
await shot('uc02-03-report-submitted');
await page.getByRole('switch', { name: 'Simulate network connectivity' }).click();
await button('Report another hazard');
await select('Incident type', 'Landslide');
await button('Use my GPS location');
await page.getByText('GPS Locked').waitFor();
await page.getByLabel('Description', { exact: true }).fill('Small landslide blocking the footpath behind the school.');
await tab('Medium');
await upload('slope.png', 'image/png', PNG);
await button('Submit Urgent Report');
await shot('uc02-04-offline-pending-sync');
await tab('Hub');
await shot('uc02-05-hub-offline-outbox');
await open('USR-CITIZEN', '/my-reports');
await page.getByRole('link').filter({ hasText: 'Requires Additional' }).first().click();
await shot('uc02-06-citizen-more-info-requested');
await open('USR-DUTY', '/review');
await shot('uc02-07-duty-review-queue');
await page.getByRole('link', { name: /^Review / }).first().click();
await shot('uc02-08-duty-review-verify');
await tab('Reject');
await button('Reject Report');
await shot('uc02-09-duty-reject-reason-required');

// ---------- UC03 Coordinate Emergency Shelters ----------
await open('USR-DISTRICT', '/coordination');
await shot('uc03-01-coordination-overview');
await tab('Shelters');
await shot('uc03-02-shelter-list');
await page.getByRole('link', { name: 'Kaduwela Community Hall', exact: true }).click();
await page.getByLabel('Allocate evacuees').fill('45');
await button('Confirm allocation');
await shot('uc03-03-shelter-near-capacity');
await page.getByLabel('Allocate evacuees').fill('40');
await button('Confirm allocation');
await shot('uc03-04-shelter-capacity-exceeded-alternatives');
await page.getByLabel('Reason the shelter is unavailable').fill('Flood water entered the hall');
await button('Mark unavailable');
await shot('uc03-05-shelter-unavailable');
await open('USR-CITIZEN', '/shelters');
await shot('uc03-06-citizen-nearest-shelters');
await page.getByRole('link', { name: 'Kaduwela Community Hall', exact: true }).click();
await shot('uc03-07-citizen-shelter-detail');

// ---------- UC04 Dispatch Rescue Teams & Relief Resources ----------
await open('USR-DISTRICT', '/coordination/teams');
await shot('uc04-01-rescue-teams');
await page.getByRole('button', { name: /Search teams/ }).click();
await button('Select SL Navy Boat Team - Kalutara for dispatch');
await page.getByLabel('Incident location').fill('Kolonnawa market - shops flooded');
await shot('uc04-02-dispatch-cross-organisation');
await tab('Relief');
await page.getByRole('button', { name: /^Essential medicine packs/ }).click();
await page.getByLabel('Quantity').fill('60');
await button('Confirm allocation');
await shot('uc04-03-relief-insufficient-stock');
await open('USR-RESCUE', '/rescue');
await shot('uc04-04-rescue-team-status');
await button('Confirm: En Route');
await button('Confirm: On Scene');
await page.getByLabel('People rescued').fill('6');
await page.getByLabel('Notes for the district officer').fill('Two families moved to Hanwella Central College');
await shot('uc04-05-rescue-mission-outcome');

// ---------- UC05 Generate Disaster Response Reports ----------
await open('USR-OFFICIAL', '/reports');
await select('Disaster event', 'Southern Monsoon Floods - May 2026 (ended)');
await shot('uc05-01-report-criteria');
await button('Generate report');
await page.getByText('Report generated').first().waitFor();
await shot('uc05-02-generated-report');
await button('Change criteria');
await page.getByLabel('From', { exact: true }).fill('2026-06-10');
await page.getByLabel('To', { exact: true }).fill('2026-06-01');
await button('Generate report');
await shot('uc05-03-invalid-period');
await open('USR-DONOR', '/reports');
await select('Disaster event', 'Southern Monsoon Floods - May 2026 (ended)');
await page.getByRole('checkbox', { name: 'Shelter Occupancy' }).click();
await button('Generate report');
await shot('uc05-04-donor-unauthorised');
await page.getByRole('checkbox', { name: 'Shelter Occupancy' }).click();
await button('Generate report');
await page.getByText('Report generated').first().waitFor();
await shot('uc05-05-donor-specific-report');

await browser.close();
server.close();
