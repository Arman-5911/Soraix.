import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
const fixture = JSON.parse(fs.readFileSync(new URL("../fixtures/live.json", import.meta.url)));
for (const theme of ["midnight", "dim", "glass"]) {
  test(`homepage accessibility: ${theme} desktop and mobile`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(t => localStorage.setItem("soraix-theme", JSON.stringify(t)), theme);
    await page.route("**/api/**", route => route.fulfill({ json: route.request().url().includes("/home") ? fixture.home : { items: [], episodes: [] } }));
    await page.goto("/");
    await expect(page.locator(".schedule-banner")).toBeVisible();
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:900});
      const result = await new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
      expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
    }
  });
}
test("landing HTML works without JS and retains distinct genre metadata", async ({ browser, request }) => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, "Requires production prerender output");
  const context = await browser.newContext({ javaScriptEnabled:false });
  const page = await context.newPage();
  await page.goto(process.env.PLAYWRIGHT_BASE_URL + "/genre/action");
  await expect(page.getByRole("heading",{name:"Action anime on SoraiX"})).toBeVisible();
  await expect(page.getByRole("link",{name:"Anime movies",exact:true})).toBeVisible();
  const action = await (await request.get("/genre/action")).text();
  const comedy = await (await request.get("/genre/comedy")).text();
  expect(action).toContain('Explore action anime'); expect(comedy).toContain('Explore comedy anime');
  expect(action).toContain('application/ld+json');
  const watch = await (await request.get("/watch/one-piece-21")).text();
  expect(watch).not.toContain('class="landing-overview"');
  expect((await request.get("/genre/not-a-real-genre")).status()).toBe(404);
  await context.close();
});
