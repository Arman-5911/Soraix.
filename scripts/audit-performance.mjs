import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const fixtures = JSON.parse(await fs.readFile(new URL("../tests/fixtures/live.json", import.meta.url)));
const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:5183";
const results = [];
const browser = await chromium.launch();
try {
  for (let run = 0; run < 3; run++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem("soraix-theme", '"glass"');
      window.auditMetrics = { lcp: 0, cls: 0, element: "" };
      new PerformanceObserver(list => { for (const e of list.getEntries()) { window.auditMetrics.lcp = e.startTime; window.auditMetrics.element = e.element?.className || e.element?.tagName || ""; } }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.auditMetrics.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    // Stable catalogue removes upstream timing/content changes from the comparison.
    await page.route("**/api/**", async route => {
      if (route.request().url().includes("/api/artwork")) return route.continue();
      await new Promise(resolve => setTimeout(resolve, 700));
      return route.fulfill({ json: route.request().url().includes("/api/home") ? fixtures.home : { items: [], episodes: [] } });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(12000);
    results.push(await page.evaluate(() => ({ ...window.auditMetrics, overflow: document.documentElement.scrollWidth > innerWidth })));
    await context.close();
  }
} finally { await browser.close(); }
await fs.mkdir("test-results", { recursive: true });
const report = { base, conditions: "3 cold Chromium mobile runs; CPU 4x; 1.6 Mbps/150ms; fixed API fixtures delayed 700ms; live artwork/fonts; splash enabled. Synthetic, not Lighthouse/CrUX.", results };
await fs.writeFile(`test-results/performance-${process.argv[2] || "current"}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
