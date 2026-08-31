const L = require("./lib");
(async () => {
  const browser = await L.launch();
  const page = await L.newPage(browser);
  const errs = [];
  page.on("console", m => { if (m.type()==="error") errs.push(m.text()); });
  page.on("pageerror", e => errs.push("PAGEERR: "+e.message));
  await page.goto(L.BASE + "/", { waitUntil: "commit", timeout: 60000 }).catch(e=>console.log("goto", e.message));
  await page.waitForSelector('[data-agent]', { timeout: 20000 }).catch(()=>{});
  await page.waitForTimeout(3000);
  const s = await page.evaluate(() => {
    const h = document.body.innerText.match(/Agent Swarm[\s\S]{0,60}/)?.[0]?.replace(/\s+/g," ").trim() || "";
    return h;
  });
  console.log("agent panel:", s);
  // after replay, expect Director progressed past idle
  await page.waitForTimeout(12000);
  const s2 = await page.evaluate(() => {
    const h = document.body.innerText.match(/Agent Swarm[\s\S]{0,60}/)?.[0]?.replace(/\s+/g," ").trim() || "";
    return h;
  });
  console.log("after replay:", s2);
  console.log("console errors:", errs.length ? errs.slice(0,5) : "none");
  await browser.close().catch(()=>{});
})();
