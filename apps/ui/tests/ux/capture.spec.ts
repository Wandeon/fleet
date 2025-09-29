import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import testConfig from '../../test.config.js';

const routes = [
  { slug: 'dashboard', path: '/' },
  { slug: 'audio', path: '/audio' },
  { slug: 'video', path: '/video' },
  { slug: 'zigbee', path: '/zigbee' },
  { slug: 'camera', path: '/camera' },
  { slug: 'fleet', path: '/fleet' },
  { slug: 'fleet-device-sample', path: '/fleet/pi-audio-01' },
  { slug: 'logs', path: '/logs' },
  { slug: 'settings', path: '/settings' },
  { slug: 'health', path: '/health' },
];

const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const baseDir = `/opt/fleet/ux-audit/${timestamp}`;
const screenshotDir = path.join(baseDir, 'screenshots');
const logDir = path.join(baseDir, 'logs');

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir(screenshotDir);
ensureDir(logDir);

function normaliseText(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

test.describe('UX capture', () => {
  for (const route of routes) {
    test(`capture ${route.slug}`, async ({ page }) => {
      const target = new URL(
        route.path,
        test.info().project.use?.baseURL ?? testConfig.uiBaseUrl
      );
      await page.goto(target.toString(), { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const screenshotPath = path.join(screenshotDir, `${route.slug}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      const controls = await page.evaluate(() => {
        const entries = Array.from(
          document.querySelectorAll<HTMLElement>(
            'button, [role="button"], input, select, textarea, a[href], [role="link"], [role="switch"], [role="checkbox"], [role="radio"]'
          )
        );

        return entries.map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName,
            type: element.getAttribute('type'),
            text: element.innerText,
            role: element.getAttribute('role'),
            ariaLabel: element.getAttribute('aria-label'),
            disabled: element.hasAttribute('disabled'),
            href: element instanceof HTMLAnchorElement ? element.href : null,
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
          };
        });
      });

      const headings = await page.evaluate(() => ({
        title: document.title,
        h1: Array.from(document.querySelectorAll('h1')).map((el) => el.textContent),
        h2: Array.from(document.querySelectorAll('h2')).map((el) => el.textContent),
      }));

      const logPath = path.join(logDir, `${route.slug}.json`);
      fs.writeFileSync(
        logPath,
        JSON.stringify(
          {
            route,
            title: headings.title,
            headings: {
              h1: headings.h1?.map((value) => normaliseText(value)),
              h2: headings.h2?.map((value) => normaliseText(value)),
            },
            controls: controls.map((control) => ({
              ...control,
              text: normaliseText(control.text),
              ariaLabel: normaliseText(control.ariaLabel ?? undefined),
            })),
          },
          null,
          2
        )
      );

      test.info().attachments.push({
        name: `${route.slug}-screenshot`,
        contentType: 'image/png',
        path: screenshotPath,
      });
    });
  }
});
