import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportsDir = path.resolve(__dirname, '../../reports/acceptance');

await fs.mkdir(reportsDir, { recursive: true });

async function readJson(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function summarizePlaywright(data) {
  if (!data) return null;
  const counts = { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 };

  function visitSuite(suite) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        counts.total += 1;
        const outcomeRaw =
          test.status || test.outcome || test.results?.[0]?.status || spec.status || '';
        const outcome = String(outcomeRaw).toLowerCase();
        if (outcome === 'expected' || outcome === 'passed') {
          counts.passed += 1;
        } else if (outcome === 'flaky') {
          counts.flaky += 1;
          counts.passed += 1;
        } else if (outcome === 'skipped') {
          counts.skipped += 1;
        } else if (outcome === 'timedout' || outcome === 'failed' || outcome === 'unexpected' || outcome === 'interrupted') {
          counts.failed += 1;
        } else {
          counts.passed += 1;
        }
      }
    }
    for (const child of suite.suites ?? []) {
      visitSuite(child);
    }
  }

  for (const suite of data.suites ?? []) {
    visitSuite(suite);
  }

  const status = counts.failed > 0 ? 'fail' : counts.flaky > 0 ? 'warn' : 'pass';
  return { status, counts };
}

const audioSummary = await readJson(path.join(reportsDir, 'audio-summary.json'));
const playwrightData = await readJson(path.join(reportsDir, 'playwright-summary.json'));
const playwrightSummary = summarizePlaywright(playwrightData);

const aggregate = { pass: 0, warn: 0, fail: 0 };

if (audioSummary?.counts) {
  aggregate.pass += Number(audioSummary.counts.pass || 0);
  aggregate.warn += Number(audioSummary.counts.warn || 0);
  aggregate.fail += Number(audioSummary.counts.fail || 0);
}

if (playwrightSummary) {
  aggregate.pass += Number(playwrightSummary.counts.passed || 0);
  aggregate.fail += Number(playwrightSummary.counts.failed || 0);
  aggregate.warn += Number(playwrightSummary.counts.flaky || 0);
}

const finalStatus = aggregate.fail > 0 ? 'fail' : aggregate.warn > 0 ? 'warn' : 'pass';

const summary = {
  status: finalStatus,
  counts: aggregate,
  components: {
    audio: audioSummary,
    playwright: playwrightSummary,
  },
};

await fs.writeFile(path.join(reportsDir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
