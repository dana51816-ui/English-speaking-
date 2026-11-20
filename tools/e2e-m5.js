// M5 end-to-end on an iPhone-size viewport. Serves app-m4 first, falls back to app/ for shared engine, content and images.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const D = process.argv[2], FB = process.argv[3], OUT = process.argv[4], THREE = process.argv[5], VW = +(process.argv[6] || 390), VH = +(process.argv[7] || 844), SEED = process.argv[8];
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, hasTouch: true });
  const html = fs.readFileSync(D + '/index.html', 'utf8');
  await ctx.route('**/three.min.js', r => r.fulfill({ path: THREE, contentType: 'application/javascript' }));
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('http://local.test/**', r => {
    const u = new URL(r.request().url());
    if (u.pathname === '/') return r.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + html + '</body></html>' });
    const rel = decodeURIComponent(u.pathname);
    for (const base of [D, FB]) { const f = path.join(base, rel); if (fs.existsSync(f)) return r.fulfill({ path: f }); }
    return r.fulfill({ status: 404, body: 'nf' });
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  if (SEED) await p.addInitScript(s => { try { if (!localStorage.getItem('wordplay:v1')) localStorage.setItem('wordplay:v1', s); } catch (e) {} }, fs.readFileSync(SEED, 'utf8'));
  await p.goto('http://local.test/', { waitUntil: 'networkidle' }); await p.waitForTimeout(2200);
  await p.screenshot({ path: OUT + '/01-home.png' });
  const types = {}; const timings = []; let thinks = 0;
  const playSession = async (tag, start) => {
    await p.click(start || '[data-act="go"]', { force: true });
    await p.waitForTimeout(800); // the dive transition plus the first-question tap guard
    let n = 0; const shots = {};
    for (let i = 0; i < 90; i++) {
      await p.waitForTimeout(420);
      if (await p.$('.e5')) break;
      n++;
      const cls = await p.$eval('#stage', e => e.className).catch(() => 'x');
      const t = (cls.match(/t-(\w+)/) || [])[1] || 'x'; types[t] = (types[t] || 0) + 1;
      if (!shots[t]) { shots[t] = 1; await p.screenshot({ path: OUT + '/' + tag + '-' + t + '.png' }); }
      if (await p.$('[data-act="introdone"]')) { await p.click('[data-act="introdone"]', { force: true }); continue; }
      if (await p.$('[data-act="think-yes"]')) { thinks++; if (!shots.think) { shots.think = 1; await p.screenshot({ path: OUT + '/' + tag + '-think.png' }); } await p.click(Math.random() < .6 ? '[data-act="think-yes"]' : '[data-act="think-no"]', { force: true }); await p.waitForTimeout(420); }
      if (await p.$('[data-act="reveal"]')) { await p.click('[data-act="reveal"]', { force: true }); await p.waitForTimeout(600); await p.click('[data-act="self"][data-v="yes"]', { force: true }); }
      else if (await p.$('[data-act="pick"]')) { const o = await p.$$('[data-act="pick"]'); const t0 = Date.now(); await o[Math.floor(Math.random() * o.length)].click({ force: true }); timings.push(Date.now() - t0); }
      else if (await p.$('.tile')) { const tl = await p.$$('.tile'); await tl[Math.floor(Math.random() * tl.length)].click({ force: true }); await p.waitForTimeout(450); }
      else if (await p.$('.mt')) { const ids = await p.$$eval('.mt[data-side="en"]', es => es.map(e => e.dataset.id)); for (const id of ids) { await p.click('.mt[data-side="en"][data-id="' + id + '"]', { force: true }); await p.click('.mt[data-side="he"][data-id="' + id + '"]', { force: true }); await p.waitForTimeout(90); } }
      else if (await p.$('.hs')) { const hs = await p.$$('.hs'); for (const h of hs) { if (await p.$('[data-act="next"]')) break; await h.click({ force: true }); await p.waitForTimeout(90); } }
      if (!shots['fb' + t]) { shots['fb' + t] = 1; await p.waitForTimeout(350); await p.screenshot({ path: OUT + '/' + tag + '-' + t + '-fb.png' }); }
      try { await p.waitForSelector('[data-act="next"]:not([disabled])', { timeout: 4000 }); }
      catch (e) { const info = await p.evaluate(() => ({ stage: (document.getElementById('stage') || {}).className, actions: (document.getElementById('actions') || {}).innerHTML.slice(0, 300) })); await p.screenshot({ path: OUT + '/FAIL-' + tag + '-' + i + '.png' }); console.error('STUCK', JSON.stringify(info)); throw e; }
      await p.click('[data-act="next"]', { force: true });
    }
    await p.waitForTimeout(2200); await p.screenshot({ path: OUT + '/' + tag + '-end0.png' }); await p.waitForTimeout(3800); await p.screenshot({ path: OUT + '/' + tag + '-end.png' });
    return n;
  };
  const n1 = await playSession('s1');
  const endText = await p.$eval('.end5 .kick5', e => e.textContent).catch(() => null);
  const built = await p.$eval('.lead5', e => e.textContent).catch(() => null);
  await p.click('.btns5 [data-act="home"]', { force: true }); await p.waitForTimeout(1500);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2200);
  await p.screenshot({ path: OUT + '/02-home-after.png' });
  const metaAfter = await p.$eval('.cta5', e => e.textContent);
  await p.click('#sync', { force: true }); await p.waitForTimeout(400); await p.screenshot({ path: OUT + '/03-settings.png' });
  await p.click('[data-act="skipday"]', { force: true }); await p.waitForTimeout(800); await p.click('[data-act="closesheet"]', { force: true }); await p.waitForTimeout(1500);
  const metaNext = await p.$eval('.cta5', e => e.textContent);
  const n2 = await playSession('s2');
  await p.click('.btns5 [data-act="home"]', { force: true }); await p.waitForTimeout(1800);
  await p.screenshot({ path: OUT + '/04-home-day2.png' });
  // drag the world up to look at the next islands
  const box = await p.$eval('.world5', e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * .45]; }).catch(() => null);
  if (box) { await p.mouse.move(box[0], box[1]); await p.mouse.down(); await p.mouse.move(box[0] + 260, box[1] + 10, { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(1600); await p.screenshot({ path: OUT + '/05-world-drag.png' }); }
  await p.click('.links5 [data-act="quests"]', { force: true }); await p.waitForTimeout(400); await p.screenshot({ path: OUT + '/06-quests.png' }); await p.click('[data-act="closesheet"]', { force: true });
  
  await p.click('.links5 [data-act="progress"]', { force: true }); await p.waitForTimeout(400); await p.screenshot({ path: OUT + '/07-progress.png' }); await p.click('[data-act="closesheet"]', { force: true }); await p.waitForTimeout(200);
  await p.click('.links5 [data-act="bank"]', { force: true }); await p.waitForTimeout(500); await p.screenshot({ path: OUT + '/08-bank.png' });
  const bankN = await p.$$eval('.bw', e => e.length);
  await p.click('[data-act="home"]', { force: true }); await p.waitForTimeout(1500);
  await p.click('.wm5', { force: true }); await p.waitForTimeout(400); await p.screenshot({ path: OUT + '/09-wardrobe.png' });
  await p.click('[data-act="wear"][data-id="beret-teal"]', { force: true }); await p.waitForTimeout(300);
  const wNote = await p.$eval('.wr-top .peek-sub', e => e.textContent).catch(() => null);
  await p.click('[data-act="closesheet"]', { force: true }); await p.waitForTimeout(300);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2000);
  const saved = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('wordplay:v1')); return { stars: d.profile.stars, sessions: d.profile.sessions, wardrobe: d.profile.wardrobe, items: Object.keys(d.items).length, learnedLvl2: Object.values(d.items).filter(s => s.ivl >= 1).length }; });
  // tap island -> chapter sheet
  const isl = await p.$$eval('.hz svg .st:not(.ghost)', es => { for (const e of es) { const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height * .3; const h = document.elementFromPoint(x, y); if (x > 0 && x < innerWidth && h && h.closest('[data-stage]')) return [x, y]; } return null; }).catch(() => null);
  if (isl) { await p.mouse.click(isl[0], isl[1]); await p.waitForTimeout(500); await p.screenshot({ path: OUT + '/10-chapter.png' }); }
  const chapterSheet = !!(await p.$('.peek-list'));
  await p.click('[data-act="closesheet"]', { force: true }).catch(() => {});
  let weakStarted = false;
  if (await p.$('[data-act="weak"]')) { await p.click('[data-act="weak"]', { force: true }); await p.waitForTimeout(800); weakStarted = !!(await p.$('#stage')); await p.screenshot({ path: OUT + '/11-weak.png' }); }
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  const mem = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('wordplay:v1')); const ev = Object.values(d.items).filter(s => s.ev); return { engine: d.profile.engine, withEv: ev.length, rclDays: ev.reduce((n, s) => n + s.ev.rcl.d.length, 0), mlog: d.profile.mlog, backup: !!localStorage.getItem('wordplay:v1:pre-engine2') }; });
  console.log(JSON.stringify({ thinks, mem, n1, n2, endText, built, metaAfter, metaNext, bankN, wNote, saved, chapterSheet, weakStarted, overflow, types, avgTapMs: Math.round(timings.reduce((a, b) => a + b, 0) / Math.max(1, timings.length)), errors: errs }));
  await b.close();
})();
