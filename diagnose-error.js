const { chromium } = require('playwright');
const fs = require('fs');

async function diagnoseError() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let errorDetails = null;

  page.on('pageerror', async (err) => {
    errorDetails = {
      message: err.message,
      stack: err.stack,
      name: err.name
    };

    console.log('💥 JAVASCRIPT ERROR CAUGHT:\n');
    console.log(`Message: ${err.message}`);
    console.log(`\nFull Stack Trace:`);
    console.log(err.stack);
    console.log('\n---\n');

    // Extract the specific file and line
    const match = err.stack.match(/https:\/\/app\.headspamartina\.hr\/([^ ]+):(\d+):(\d+)/);
    if (match) {
      const [, file, line, col] = match;
      console.log(`\n🎯 ERROR LOCATION:`);
      console.log(`   File: ${file}`);
      console.log(`   Line: ${line}, Column: ${col}`);

      // Try to fetch source map
      const sourceMapUrl = `https://app.headspamartina.hr/${file}.map`;
      try {
        const response = await page.context().request.get(sourceMapUrl);
        if (response.ok()) {
          console.log(`\n✅ Found source map at: ${sourceMapUrl}`);
          const sourceMap = await response.json();
          console.log(`   Original sources: ${sourceMap.sources?.slice(0, 5).join(', ')}...`);
        }
      } catch (e) {
        console.log(`\n❌ No source map found at: ${sourceMapUrl}`);
      }
    }
  });

  try {
    await page.goto('https://app.headspamartina.hr/audio?v=' + Date.now(), {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(5000);

    if (!errorDetails) {
      console.log('✅ NO ERRORS DETECTED!');
    }

  } catch (error) {
    console.error('Browser error:', error.message);
  } finally {
    if (errorDetails) {
      fs.writeFileSync('/home/admin/fleet/error-details.json', JSON.stringify(errorDetails, null, 2));
      console.log('\n📝 Error details saved to: /home/admin/fleet/error-details.json');
    }
    await browser.close();
  }
}

diagnoseError().catch(console.error);
