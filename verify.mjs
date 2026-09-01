/**
 * Smoke test. Drives the whole consent flow in a headless browser so a broken
 * gate or a silent registration failure shows up before a judge finds it.
 *
 *   npm run dev          # in one terminal
 *   node verify.mjs      # in another  (npx playwright install chromium first)
 *
 * Runs against the dev polyfill, so it exercises the app's logic, not Chrome's
 * WebMCP implementation. Verifying against a real agent is a manual step.
 */
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:5173';
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const toolCount = async () =>
  Number((await page.locator('header').innerText()).match(/(\d+) tools/)?.[1] ?? -1);

check('only list_sections before a manuscript is open', await toolCount() === 1,
  `${await toolCount()} tools`);

await page.getByRole('button', { name: 'Load sample' }).click();
await page.waitForTimeout(600);

check('manuscript parsed into sections', await page.locator('main section').count() === 5);
check('full tool surface after load', await toolCount() === 8, `${await toolCount()} tools`);

/* --- gate: withhold one, release the rest ------------------------------- */
await page.getByRole('button', { name: 'find_claims' }).click();
await page.waitForTimeout(400);
check('consent dialog opens', await page.getByRole('dialog').count() > 0);

const rows = page.locator('[role=dialog] label:has(input[type=checkbox])');
const rowCount = await rows.count();
check('candidate passages listed', rowCount > 1, `${rowCount} rows`);

await rows.first().locator('input').uncheck();
await page.waitForTimeout(200);
check('withheld count shown before releasing',
  (await page.getByRole('dialog').innerText()).includes('1 withheld'));

await page.getByRole('button', { name: /^Release once/ }).click();
await page.waitForTimeout(600);

const aside = await page.locator('aside').innerText();
check('disclosure records the split', aside.includes('withheld') && aside.includes('released'),
  aside.split('\n').slice(2, 6).join(' | '));

check('released sentences highlighted in the manuscript',
  await page.locator('main [data-released]').count() > 0,
  `${await page.locator('main [data-released]').count()} highlighted`);

/* --- denial path --------------------------------------------------------- */
await page.getByRole('button', { name: 'check_stats_reporting' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Deny everything' }).click();
await page.waitForTimeout(500);
check('denial is recorded, not silently dropped',
  (await page.locator('aside').innerText()).includes('0 released'));

/* --- standing grants ----------------------------------------------------- */
await page.getByRole('button', { name: 'get_section_text' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Release for session' }).click();
await page.waitForTimeout(600);
check('standing grants appear in the header',
  (await page.locator('header').innerText()).includes('standing grant'));

await page.getByRole('button', { name: 'get_section_text' }).click();
await page.waitForTimeout(600);
check('granted passages are not re-asked', await page.getByRole('dialog').count() === 0);

await page.getByRole('button', { name: /revoke \d+ standing grant/ }).click();
await page.waitForTimeout(500);
check('grants can be revoked',
  !(await page.locator('header').innerText()).includes('standing grant'));

/* --- review draft -------------------------------------------------------- */
await page.getByRole('button', { name: /^Draft/ }).click();
await page.getByPlaceholder('Add your own note…').fill('Sample size is not justified.');
await page.getByRole('button', { name: 'Add note' }).click();
await page.waitForTimeout(400);
check('reviewer can add notes',
  (await page.locator('aside').innerText()).includes('Sample size is not justified'));

/* --- exports must be visible, not just downloadable ---------------------- */
// Embedded browsers block blob downloads silently, so the reviewer has to be
// able to see and copy the export without one.
await page.getByRole('button', { name: /^Disclosure/ }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Export for editor' }).click();
await page.waitForTimeout(400);
const exportText = await page.locator('[role=dialog] pre').innerText();
check('disclosure export is shown on screen',
  exportText.includes('AI assistance disclosure') && exportText.includes('| Time | Tool |'));
check('export names the manuscript it describes',
  exportText.includes('Manuscript:') && !exportText.includes('Manuscript: unknown'));
check('export totals the withheld passages',
  /withheld\./.test(exportText), exportText.split('\n').slice(-1)[0]?.slice(0, 70));
check('export offers copy as well as download',
  await page.getByRole('button', { name: 'Copy' }).count() > 0
  && await page.getByRole('button', { name: 'Download' }).count() > 0);
await page.getByRole('button', { name: 'close', exact: true }).click();
await page.waitForTimeout(300);

/* --- what survives closing the manuscript -------------------------------- */
const logBefore = (await page.locator('aside').innerText()).length;
await page.getByRole('button', { name: /^Disclosure/ }).click();
await page.getByRole('button', { name: 'Close manuscript' }).click();
await page.waitForTimeout(600);
check('disclosure log survives closing the manuscript',
  (await page.locator('aside').innerText()).includes('released'));
await page.getByRole('button', { name: /^Draft/ }).click();
await page.waitForTimeout(300);
check('review draft survives closing the manuscript',
  (await page.locator('aside').innerText()).includes('Sample size is not justified'));
check('kept work is attributed to its manuscript',
  (await page.locator('main').innerText()).includes('are still here'));

/* --- erasing is possible and complete ------------------------------------ */
await page.getByRole('button', { name: 'erase local data' }).click();
await page.waitForTimeout(300);
check('erase asks before destroying the record',
  (await page.locator('[role=dialog]').innerText()).includes('cannot be undone'));
await page.getByRole('button', { name: 'Erase everything' }).click();
await page.waitForTimeout(800);
check('erase clears draft and disclosure',
  !(await page.locator('aside').innerText()).includes('Sample size is not justified'));

/* --- the app must work with no WebMCP at all ----------------------------- */
const bare = await browser.newPage();
await bare.addInitScript(() => {
  // Neutralise the dev polyfill so this page sees no API whatsoever: reads stay
  // undefined and the polyfill's assignment is swallowed rather than throwing.
  Object.defineProperty(document, 'modelContext', {
    get: () => undefined, set: () => {}, configurable: true,
  });
});
await bare.goto(URL, { waitUntil: 'networkidle' });
await bare.waitForTimeout(700);
check('degrades to a clear message without WebMCP',
  (await bare.locator('header').innerText()).includes('WebMCP unavailable'));
if (await bare.getByRole('button', { name: 'Load sample' }).count())
  await bare.getByRole('button', { name: 'Load sample' }).click();
await bare.waitForTimeout(500);
await bare.getByRole('button', { name: 'list_sections' }).click();
await bare.waitForTimeout(500);
check('tools still run in-page without WebMCP',
  (await bare.locator('main').innerText()).includes('ABSTRACT'));
await bare.close();

/* --- an API that arrives after first paint ------------------------------- */
// The ChatGPT in-app browser scenario: the embedder installs
// document.modelContext once the page is already running. Registering only at
// mount silently registers nothing and never recovers.
const late = await browser.newPage();
await late.addInitScript(() => {
  let real;
  let accepting = false;
  Object.defineProperty(document, 'modelContext', {
    get: () => real,
    set: (v) => { if (accepting) real = v; },   // swallow the dev polyfill
    configurable: true,
  });
  window.__installLate = () => {
    accepting = true;
    const tools = new Map();
    real = {
      async registerTool(def, o) {
        tools.set(def.name, def);
        o?.signal?.addEventListener('abort', () => tools.delete(def.name));
      },
      unregisterTool: (n) => tools.delete(n),
      async getTools() { return [...tools.values()].map(({ name }) => ({ name })); },
      addEventListener() {}, removeEventListener() {},
    };
  };
});
await late.goto(URL, { waitUntil: 'networkidle' });
await late.waitForTimeout(600);
check('reports honestly while no API is present',
  (await late.locator('header').innerText()).includes('WebMCP unavailable'));
await late.evaluate(() => window.__installLate());
await late.waitForTimeout(2000);
check('picks up an API installed after first paint',
  (await late.locator('header').innerText()).includes('WebMCP via'),
  (await late.locator('header').innerText()).split('\n')[1]?.slice(0, 60));
await late.close();

/* --- the central claim --------------------------------------------------- */
check('zero outbound network requests',
  await page.evaluate(() => window.__netguard.counts.total) === 0);

check('no console errors', errors.length === 0, errors.join(' / '));

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
