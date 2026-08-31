const L = require("./lib");
(async () => {
  const browser = await L.launch();
  const page = await L.newPage(browser);
  await page.goto(L.BASE + "/", { waitUntil: "commit", timeout: 60000 }).catch(e=>console.log("goto err", e.message));
  // Wait until agent rows render
  await page.waitForSelector('[data-agent]', { timeout: 15000 }).catch(()=>{});
  const out = [];
  for (let i = 0; i < 22; i++) {
    const s = await page.evaluate(() => {
      const header = document.body.innerText.match(/Agent Swarm[\s\S]{0,80}/)?.[0]?.replace(/\s+/g," ").trim() || "";
      const rows = [...document.querySelectorAll('[data-agent]')].map(el => {
        const label = el.querySelector('[class*="text-\\[13px\\]"]')?.textContent?.trim();
        const pill = [...el.querySelectorAll('span')].find(sp => /Idle|Working|Planning|Done|Error|Waiting/.test(sp.textContent||""))?.textContent?.trim();
        const msgptext = el.querySelector('p')?.textContent?.trim();
        return `[${label}->${pill}]`;
      });
      return header + " || " + rows.join(" ");
    }).catch(e=>"ERR "+e.message);
    out.push(s);
    await page.waitForTimeout(900);
  }
  // only print meaningful (non-idle-all) rows compactly
  out.forEach((s,i)=>{ if(/Working|Planning|Done|\|0?[1-9]\/10|\|[1-9] active/.test(s)) console.log(`${String(i).padStart(2)}: ${s}`); });
  console.log("--- final ---");
  console.log(out[out.length-1]);
  await browser.close().catch(()=>{});
})();
