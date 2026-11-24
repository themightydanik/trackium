const fs = require('node:fs/promises');
const {start, stop, fixturePage} = require('./fixture.cjs');
const path = require('node:path');
const [assets, directory] = process.argv.slice(2);
if (!assets || !directory) throw new Error('Usage: node capture-lite-redesign.cjs <checkout> <output>');
const root = path.resolve(assets), output = path.resolve(directory);
(async () => {
  await fs.mkdir(output, {recursive: true});
  await start(root);
  try {
    for (const width of [1440, 390]) {
      const {page, context} = await fixturePage(width, 'dark', {integritas: true, visual: true});
      await page.emulateMedia({reducedMotion: 'reduce'});
      await page.clock.setFixedTime(new Date('2026-01-01T00:10:00Z'));
      for (const [route, title] of Object.entries({dashboard:'Overview', shipments:'Shipments', devices:'Devices', map:'Routes & reported positions', events:'Event history', proofs:'Proof records', settings:'Gateway settings'})) {
        await page.evaluate(r => { location.hash = r; window.scrollTo(0,0); }, route);
        await page.getByRole('heading',{level:1,name:title,exact:true}).waitFor();
        await page.screenshot({path: output+'/'+route+'-'+width+'.png', animations:'disabled',fullPage:true});
      }
      await page.evaluate(() => { location.hash = 'devices'; });
      await page.getByRole('button',{name:'Device details',exact:true}).click();
      await page.locator('#device-history').waitFor();
      await page.locator('.telemetry-charts').scrollIntoViewIfNeeded();
      await page.screenshot({path: output+'/sensor-charts-'+width+'.png',animations:'disabled',fullPage:true});
      await page.locator('#dialog-title').scrollIntoViewIfNeeded();
      await page.screenshot({path: output+'/device-detail-'+width+'.png',animations:'disabled',fullPage:true});
      await context.close();
    }
  } finally { await stop(); }
})().catch(error => {console.error(error);process.exitCode=1});
