import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { launch as launchChrome } from 'chrome-launcher';
import { chromium } from 'playwright-core';

if (!process.env.VITE_USE_MOCKS) {
  process.env.VITE_USE_MOCKS = '1';
}
import lighthouse from 'lighthouse';

const budgets = {
  performance: 0.9,
  accessibility: 0.95,
  'best-practices': 0.95
};

function run(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

let preview;

async function main() {
  await run('npm', ['run', 'build']);
  preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], {
    stdio: 'inherit',
    shell: false,
    env: { ...process.env }
  });
  await delay(2000);

  const chrome = await launchChrome({
    chromePath: chromium.executablePath(),
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu']
  });

  try {
    const result = await lighthouse('http://127.0.0.1:4173/', {
      port: chrome.port,
      logLevel: 'error',
      output: 'json'
    });
    const scores = result.lhr.categories;
    const summary = {
      performance: scores.performance.score,
      accessibility: scores.accessibility.score,
      'best-practices': scores['best-practices'].score,
      seo: scores.seo.score
    };

    console.log('Lighthouse scores:', summary);

    for (const [category, minimum] of Object.entries(budgets)) {
      const score = summary[category];
      if (score < minimum) {
        throw new Error(`Lighthouse score for ${category} (${score}) is below budget (${minimum})`);
      }
    }
  } finally {
    await chrome.kill();
    if (preview) {
      preview.kill('SIGTERM');
    }
  }
}

main().catch((error) => {
  console.error(error);
  if (preview) {
    preview.kill('SIGTERM');
  }
  process.exit(1);
});
