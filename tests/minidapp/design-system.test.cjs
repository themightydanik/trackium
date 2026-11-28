const test=require('node:test');const assert=require('node:assert/strict');const {chromium}=require('playwright');const {spawn}=require('node:child_process');const path=require('node:path');
let server,browser;const origin='http://127.0.0.1:4179';
test.before(async()=>{server=spawn('python3',['-m','http.server','4179','--bind','127.0.0.1','--directory',path.resolve(__dirname,'../..')],{stdio:'ignore'});for(let i=0;i<60;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']})});
test.after(async()=>{if(browser)await browser.close();if(server)server.kill()});
test('DS1 exposes system and manual scheme mappings without changing auth or data mode',async()=>{const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark'});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const page=await context.newPage();await page.goto(origin);const role=()=>page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--tc-canvas').trim());assert.equal(await role(),'#0B1220');await page.emulateMedia({colorScheme:'light'});assert.equal(await role(),'#F5F8FC');await page.evaluate(()=>document.documentElement.dataset.tcTheme='dark');assert.equal(await role(),'#0B1220');assert.equal(await page.locator('#demo-toggle').getAttribute('aria-checked'),'false');assert.match(await page.locator('#main').innerText(),/Gateway not paired/);await context.close()});
test('owner logo and favicon resolve at compact and desktop sizes',async()=>{for(const width of [320,1440]){const page=await browser.newPage({viewport:{width,height:900}});await page.goto(origin);const logo=page.locator('.brand-mark img');await logo.evaluate(img=>img.decode());assert.equal(await logo.getAttribute('alt'),'');assert.ok(await logo.evaluate(img=>img.naturalWidth>300));const favicon=await page.locator('link[rel=icon]').getAttribute('href');assert.ok((await page.request.get(origin+'/'+favicon)).ok());assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.close()}});

test('D3 serves responsive authentication photos locally without moving the form', async () => {
  const http = require('node:http');
  const { createWebHandler } = await import('../../services/gateway/src/cargo/web.js');
  const web = createWebHandler({webEnabled:true, customerMail:{}});
  const local = http.createServer((req,res) => {
    if (req.url.startsWith('/app/')) return web(req,res);
    res.writeHead(401,{'content-type':'application/json'}).end('{"error":"SESSION_EXPIRED"}');
  });
  await new Promise(resolve => local.listen(0,'127.0.0.1',resolve));
  const url = 'http://127.0.0.1:' + local.address().port;
  try {
    for (const [width,scheme,expected] of [[320,'dark',480],[1440,'light',960]]) {
      const context = await browser.newContext({viewport:{width,height:900},colorScheme:scheme,reducedMotion:'reduce'});
      try {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror',error => errors.push(error.message));
        let release;
        const pending = new Promise(resolve => { release = resolve; });
        await page.route('**/visual/terminal-*.webp',async route => {
          await pending;
          await route.continue();
        });
        await page.goto(url + '/app/',{waitUntil:'domcontentloaded'});
        const heading = page.getByRole('heading',{name:'Sign in to Trackium'});
        await heading.waitFor();
        const before = await heading.boundingBox();
        release();
        const photo = page.locator('.lite-auth-art img');
        const photoURL = await photo.evaluate(async img => { await img.decode(); return img.currentSrc; });
        assert.equal(photoURL,url + '/app/assets/v2/visual/terminal-' + expected + '.webp');
        assert.equal((await page.request.get(photoURL)).headers()['content-type'],'image/webp');
        assert.equal((await page.request.get(url + '/app/assets/v2/visual/not-allowed.webp')).status(),404);
        assert.deepEqual(await heading.boundingBox(),before);
        await page.locator('html').evaluate(el => { el.style.fontSize = '200%'; });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.getByRole('button',{name:'Create account'}).press('Enter');
        await page.getByRole('heading',{name:'Create your account'}).waitFor();
        assert.match(await photo.evaluate(async img => { await img.decode(); return img.currentSrc; }),/\/warehouse-\d+\.webp$/);
        await page.getByRole('textbox',{name:'Work email'}).focus();
        assert.ok(await page.getByRole('textbox',{name:'Work email'}).evaluate(el => getComputedStyle(el).outlineStyle === 'solid'));
        assert.deepEqual(errors,[]);
      } finally {
        await context.close();
      }
    }
  } finally {
    await new Promise(resolve => local.close(resolve));
  }
});
