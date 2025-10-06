const puppeteer = require('puppeteer');
const fs = require('fs');

const ZIGBEE_URL = 'https://app.headspamartina.hr/zigbee';
const results = {
  buttons: [],
  summary: { pass: 0, fail: 0, stub: 0, total: 0 },
  issues: [],
  timestamp: new Date().toISOString()
};

async function testButton(page, idx, label) {
  console.log('Testing button', idx + 1 + ':', label);
  const result = { index: idx + 1, label: label, status: 'UNKNOWN', feedback: 'none', apiCalls: 0, notes: '' };
  
  try {
    await page.screenshot({ path: 'screenshots/before-' + (idx + 1) + '.png' });
    const urlBefore = page.url();
    const requests = [];
    const listener = (req) => {
      const url = req.url();
      if (url.includes('/api/')) requests.push(url);
    };
    page.on('request', listener);
    
    const clicked = await page.evaluate((i) => {
      const elements = document.querySelectorAll('button, [role="button"], a, input[type="submit"], input[type="button"]');
      const visible = Array.from(elements).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && !el.disabled;
      });
      if (visible[i]) { visible[i].click(); return true; }
      return false;
    }, idx);
    
    if (!clicked) {
      result.status = 'FAIL';
      result.notes = 'Could not click';
      page.off('request', listener);
      return result;
    }
    
    await new Promise(r => setTimeout(r, 2500));
    const urlAfter = page.url();
    result.apiCalls = requests.length;
    
    const feedback = await page.evaluate(() => {
      const msgs = [];
      ['[role="alert"]', '.toast', '.notification', '.alert'].forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          const txt = el.textContent.trim();
          if (txt) msgs.push(txt);
        });
      });
      return msgs;
    });
    
    if (feedback.length > 0) result.feedback = feedback.join('; ');
    await page.screenshot({ path: 'screenshots/after-' + (idx + 1) + '.png' });
    
    if (requests.length > 0) {
      result.status = 'PASS';
      result.notes = 'API call triggered';
    } else if (result.feedback !== 'none') {
      const lower = result.feedback.toLowerCase();
      if (lower.includes('coming soon') || lower.includes('not available')) {
        result.status = 'STUB';
        result.notes = 'Graceful degradation message';
      } else {
        result.status = 'PASS';
        result.notes = 'User feedback shown';
      }
    } else if (urlBefore !== urlAfter) {
      result.status = 'PASS';
      result.notes = 'Navigation (URL change detected)';
    } else {
      result.status = 'FAIL';
      result.notes = 'SILENT NO-OP - no feedback';
    }
    
    page.off('request', listener);
  } catch (e) {
    result.status = 'ERROR';
    result.notes = e.message;
  }
  return result;
}

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('Navigating to Zigbee page...');
  await page.goto(ZIGBEE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'screenshots/initial.png', fullPage: true });
  
  const buttons = await page.evaluate(() => {
    const found = [];
    document.querySelectorAll('button, [role="button"], a, input[type="submit"], input[type="button"]').forEach((el) => {
      const rect = el.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0;
      const disabled = el.disabled || el.getAttribute('disabled') !== null;
      if (visible && !disabled) {
        found.push({
          text: (el.textContent || '').trim().slice(0, 100),
          ariaLabel: el.getAttribute('aria-label'),
          className: String(el.className)
        });
      }
    });
    return found;
  });
  
  console.log('Found', buttons.length, 'interactive buttons\n');
  
  for (let i = 0; i < buttons.length; i++) {
    const label = buttons[i].text || buttons[i].ariaLabel || 'unnamed';
    const res = await testButton(page, i, label);
    results.buttons.push(res);
    results.summary.total++;
    if (res.status === 'PASS') results.summary.pass++;
    else if (res.status === 'STUB') results.summary.stub++;
    else results.summary.fail++;
    if (res.status === 'FAIL' || res.status === 'ERROR') {
      results.issues.push('Button ' + res.index + ' (' + label + '): ' + res.notes);
    }
    await page.goto(ZIGBEE_URL, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));
  }
  
  await browser.close();
  
  fs.writeFileSync('artifacts/results.json', JSON.stringify(results, null, 2));
  const csv = ['Index,Label,Status,Feedback,API_Calls,Notes'];
  results.buttons.forEach(b => {
    csv.push([
      b.index,
      '"' + (b.label || '').replace(/"/g, '""') + '"',
      b.status,
      '"' + (b.feedback || 'none').replace(/"/g, '""') + '"',
      b.apiCalls,
      '"' + (b.notes || '').replace(/"/g, '""') + '"'
    ].join(','));
  });
  fs.writeFileSync('buttons.csv', csv.join('\n'));
  
  console.log('\n=== RESULTS ===');
  console.log('Total:', results.summary.total);
  console.log('Pass:', results.summary.pass);
  console.log('Stub:', results.summary.stub);
  console.log('Fail:', results.summary.fail);
  console.log('\nZigbee:', results.summary.total, 'buttons tested —', 
    results.summary.pass, 'PASS /', results.summary.fail, 'FAIL /', 
    results.summary.stub, 'STUB (graceful). Notable issues:', 
    results.issues.length > 0 ? results.issues[0] : 'None');
}

run().catch(console.error);
