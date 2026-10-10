import { test, expect } from "@playwright/test";
import fs from "node:fs";
const fixture = JSON.parse(fs.readFileSync(new URL("../fixtures/live.json", import.meta.url)));

test("audit layout fixes retain readable footer and accessible desktop filter", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", route => route.fulfill({ json: route.request().url().includes("/home") ? fixture.home : { items: [], episodes: [] } }));
  await page.goto("/");
  await expect(page.locator(".schedule-banner")).toBeVisible();
  const target = await page.locator(".header-filter").boundingBox();
  expect(target.width).toBeGreaterThanOrEqual(44);
  expect(target.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator(".footer-top h4")).toHaveCount(0);
  await expect(page.locator(".footer-top > div:first-child > p")).toHaveCSS("color", "rgb(188, 179, 202)");
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const fits = await page.locator(".schedule-banner").evaluate(e => {
      const box = e.getBoundingClientRect();
      return [...e.querySelectorAll("h3,p,.schedule-link")].every(child => {
        const r = child.getBoundingClientRect();
        return r.left >= box.left && r.right <= box.right + 1 && r.bottom <= box.bottom + 1;
      });
    });
    expect(fits).toBe(true);
  }
  await expect(page.locator("#website-schema")).toHaveCount(1);
});

test("production returns real 404 while known application deep links remain reachable", async ({ request }) => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, "Requires standalone production server, not Vite dev fallback.");
  expect((await request.get("/audit-missing-2026")).status()).toBe(404);
  for (const path of ["/genre/action", "/watch/one-piece-21", "/read/123/chapter-1", "/media/123"]) expect((await request.get(path)).status()).toBe(200);
});
