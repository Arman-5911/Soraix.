import assert from "node:assert/strict";
import { chromium } from "playwright";
import fs from "node:fs/promises";

const base = process.env.TEST_URL || "http://localhost:5173";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/watch/frieren-beyond-journey-s-end-52991?ep=1", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => document.querySelector("video")?.readyState >= 2,
    null,
    { timeout: 60000 },
  );
  assert.equal(await page.locator(".episode-buttons button").count(), 28);
  assert.equal(await page.locator(".player-column iframe").count(), 0);
  await page.locator("video").evaluate((v) => {
    v.muted = true;
    return v.play();
  });
  await page.waitForFunction(
    () => document.querySelector("video")?.currentTime > 6,
    null,
    { timeout: 30000 },
  );
  const playing = await page
    .locator("video")
    .evaluate((v) => ({
      time: v.currentTime,
      duration: v.duration,
      width: v.videoWidth,
      height: v.videoHeight,
    }));
  assert.ok(playing.duration > 1200 && playing.width >= 640);
  assert.ok(await page.getByLabel("Streaming quality").count());
  await page.waitForFunction(
    () =>
      [...document.querySelector("video").textTracks].some(
        (t) => t.language === "en" && t.cues?.length > 0,
      ),
    null,
    { timeout: 15000 },
  );
  console.log(
    "PASS: real HLS playback, quality selector and English subtitles",
    playing,
  );
  await page.locator("video").evaluate((v) => {
    v.currentTime = 60;
  });
  await page.waitForFunction(
    () => document.querySelector("video")?.currentTime > 61,
    null,
    { timeout: 20000 },
  );
  await page.locator("video").evaluate((v) => v.pause());
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("soraix-history"))[0],
  );
  assert.equal(saved.source, "direct");
  assert.ok(saved.position >= 60);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.querySelector("video")?.currentTime >= 60,
    null,
    { timeout: 45000 },
  );
  console.log("PASS: seek and resume from real playback progress");
  await page.getByRole("button", { name: "Next episode", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector(".episode-buttons .active")?.textContent === "02",
  );
  await page.waitForFunction(
    () => document.querySelector("video")?.readyState >= 2,
    null,
    { timeout: 45000 },
  );
  assert.ok(page.url().endsWith("ep=2"));
  await page.locator("video").evaluate((v) => {
    v.muted = true;
    return v.play();
  });
  await page.waitForFunction(
    () => document.querySelector("video")?.currentTime > 1,
    null,
    { timeout: 20000 },
  );
  console.log("PASS: second episode plays without leaving SoraiX");
  await fs.mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({ path: "docs/screenshots/direct-stream-playing.png" });
  for (const width of [768, 375, 320]) {
    await page.setViewportSize({ width, height: 950 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow at ${width}`,
    );
  }
  await page.screenshot({ path: "docs/screenshots/direct-stream-mobile.png" });
  assert.deepEqual(errors, []);
  console.log("PASS: responsive player, no page errors");
} finally {
  await browser.close();
}
