const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const evidenceDir = process.env.DASHBOARD_EVIDENCE_DIR || path.resolve('dist/dashboard-evidence');
fs.mkdirSync(evidenceDir, { recursive: true });
(async () => {
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined, headless:true, args:['--no-sandbox']});
 try {
 const page = await browser.newPage({viewport:{width:1440,height:1100}, timezoneId:'America/Sao_Paulo'});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.DASHBOARD_BASE_URL || 'http://127.0.0.1:5173');
 await page.getByText('12 of 24 observations reviewed').waitFor();
 await page.screenshot({path:path.join(evidenceDir, 'operations.png'),fullPage:true});
 await page.getByRole('button',{name:'Functional intelligence',exact:true}).click();
 await page.getByRole('heading',{name:'Reviewed functional domains',exact:true}).waitFor();
 assert.equal(await page.locator('tbody tr').count(),6);
 await page.getByRole('button',{name:'Transitions',exact:true}).click();
 await page.getByRole('heading',{name:'Reviewed observations · Transitions',exact:true}).waitFor();
 await page.getByRole('button',{name:/View evidence/}).first().click();
 const evidence=page.getByRole('region',{name:'Evidence drill-down'});
 await evidence.getByText('Exact match in persisted session notes').first().waitFor();
 await evidence.getByText(/Audit event:/).first().waitFor();
 await page.screenshot({path:path.join(evidenceDir, 'functional.png'),fullPage:true});
 await page.getByRole('button',{name:'Open session workspace',exact:true}).click();
 await page.getByRole('heading',{name:'Functional observation review',exact:true}).waitFor();
 await page.locator('.history-item.selected').waitFor();
 await page.getByRole('button',{name:'AI governance',exact:true}).click();
 await page.getByRole('heading',{name:'Inference telemetry',exact:true}).waitFor();
 assert.equal(await page.getByText('Unavailable',{exact:true}).count(),3);
 await page.getByRole('button',{name:/Trace decision & evidence/}).first().click();
 await page.getByRole('region',{name:'Evidence drill-down'}).getByText(/Audit event:/).first().waitFor();
 await page.getByRole('button',{name:'Close evidence',exact:true}).click();
 await page.screenshot({path:path.join(evidenceDir, 'governance.png'),fullPage:true});
 for(const width of [390,768,1440]) {
   await page.setViewportSize({width,height:1000});
   for(const name of ['Operations','Functional intelligence','AI governance']) {
     await page.getByRole('button',{name,exact:true}).click();
     await page.getByRole('button',{name:'Refresh dashboard',exact:true}).waitFor();
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth),true, `${name} overflow at ${width}`);
   }
 }
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Operations',exact:true}).click();
 await page.getByText('12 of 24 observations reviewed').waitFor();
 await page.screenshot({path:path.join(evidenceDir, 'mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: all dashboards, domain drill-down, source excerpts, persisted audit decisions, session workspace navigation, telemetry unavailable, no horizontal overflow at 390/768/1440px, no browser runtime errors');
 } finally {
   await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
