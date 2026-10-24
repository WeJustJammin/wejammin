import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const R='/home/rob/.codex/worktrees/phase2-slice12/WeJammin';
const require=createRequire(R+'/');
const { chromium } = require('@playwright/test');
const OUT=process.cwd()+'/out'; let delayMs=0; const log=[];
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://x'); let p=url.pathname==='/'?'/index.html':url.pathname;
  const file=path.join(OUT,p); if(!fs.existsSync(file)){res.statusCode=404;res.end();return;}
  log.push(p);
  const send=()=>{res.setHeader('content-type',p.endsWith('.html')?'text/html':'text/javascript');res.end(fs.readFileSync(file));};
  if(p.includes('GateForm')&&delayMs>0) setTimeout(send,delayMs); else send();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r)); const port=server.address().port;
const browser=await chromium.launch({channel:'chrome'});
const results=[]; const check=(name,ok,extra='')=>{results.push([ok?'PASS':'FAIL',name,extra]);};
const gate=(l)=>l.filter(x=>x.includes('GateForm'));
async function fresh(viewport){ const ctx=await browser.newContext({viewport}); const page=await ctx.newPage(); log.length=0; await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'load'}); await page.waitForTimeout(500); return {ctx,page}; }

// 1. Tall viewport region 'top' is visible; 'below' is far below. Short viewport => top visible only.
{ const {ctx,page}=await fresh({width:1000,height:700});
  const requested=gate(log).length;
  check('visible region loads at once (IntersectionObserver)', requested>=1, 'requests='+requested);
  check('top hydrated', await page.evaluate(()=>window.__hydrated===true));
  const belowReadonly=await page.locator('#below-reason').evaluate(e=>e.hasAttribute('readonly'));
  check('below-the-fold text control is still read-only (server lock)', belowReadonly);
  const topReadonly=await page.locator('#top-reason').evaluate(e=>e.hasAttribute('readonly'));
  check('hydrated region released its lock', !topReadonly);
  const before=gate(log).length;
  await page.locator('#below-reason').scrollIntoViewIfNeeded().catch(()=>{});
  await page.waitForTimeout(400);
  check('scrolling the second region into view arms it', await page.locator('#below-reason').evaluate(e=>!e.hasAttribute('readonly')), 'requests '+before+'->'+gate(log).length);
  await page.locator('#below-reason').fill('typed after load');
  await page.getByRole('button',{name:'Send'}).nth(1).click();
  const sent=await page.evaluate(()=>window.__submitted);
  check('typed value reaches the form state', JSON.stringify(sent)===JSON.stringify(['typed after load']), JSON.stringify(sent));
  await ctx.close(); }

// 2. Pointer over arms before it is visible: use a tiny viewport so 'top' is hidden? Use hover on the section with element not in viewport impossible; test intent with IO disabled.
{ const ctx=await browser.newContext({viewport:{width:1000,height:700}}); await ctx.addInitScript(()=>{ window.IntersectionObserver=undefined; });
  const page=await ctx.newPage(); log.length=0; await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'load'}); await page.waitForTimeout(500);
  check('without visibility, no chunk before intent', gate(log).length===0, 'requests='+gate(log).length);
  check('locked while waiting', await page.locator('#top-reason').evaluate(e=>e.hasAttribute('readonly')));
  await page.locator('#top-reason').hover();
  await page.waitForTimeout(400);
  check('pointer over arms the region', gate(log).length>=1 && await page.evaluate(()=>window.__hydrated===true), 'requests='+gate(log).length);
  check('locks released', await page.locator('#top-reason').evaluate(e=>!e.hasAttribute('readonly')));
  await ctx.close(); }

// 3. Submit pressed before hydration: slow chunk; no navigation; replay once.
{ delayMs=1200; const ctx=await browser.newContext({viewport:{width:1000,height:700}}); await ctx.addInitScript(()=>{ window.IntersectionObserver=undefined; });
  const page=await ctx.newPage(); log.length=0; await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'load'}); await page.waitForTimeout(300);
  const urlBefore=page.url();
  await page.getByRole('button',{name:'Send'}).first().click({force:true});
  await page.waitForTimeout(200);
  check('early submit did not navigate', page.url()===urlBefore, page.url());
  check('early submit armed the region', gate(log).length>=1, 'requests='+gate(log).length);
  await page.waitForFunction(()=>window.__hydrated===true,null,{timeout:8000});
  await page.waitForTimeout(400);
  const sent=await page.evaluate(()=>window.__submitted);
  check('held submit replayed exactly once after hydration', Array.isArray(sent)&&sent.length===1, JSON.stringify(sent));
  await ctx.close(); delayMs=0; }

// 4. Playwright fill on read-only waits for release (no deadlock) when visibility arms.
{ delayMs=600; const {ctx,page}=await fresh({width:1000,height:700}); delayMs=0;
  await page.locator('#top-reason').fill('robot text',{timeout:8000});
  await page.getByRole('button',{name:'Send'}).first().click();
  const sent=await page.evaluate(()=>window.__submitted);
  check('fill on a locked field waits, then its value is in the form state', Array.isArray(sent)&&sent.at(-1)==='robot text', JSON.stringify(sent));
  await ctx.close(); }

await browser.close(); server.close();
for(const r of results) console.log(r.join(' | '));
