import { test, expect } from "@playwright/test";
import fs from "node:fs";
const fixtures = JSON.parse(
  fs.readFileSync(new URL("../fixtures/live.json", import.meta.url), "utf8"),
);
const titles = [
  ...new Map(
    [
      ...Object.values(fixtures.home).filter(Array.isArray).flat(),
      fixtures.detail.anime,
    ].map((a) => [a.id, a]),
  ).values(),
];
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url()),
      p = url.searchParams;
    let body;
    if (url.pathname === "/api/home") body = fixtures.home;
    else if (url.pathname.startsWith("/api/anime/")) body = fixtures.detail;
    else if (url.pathname.startsWith("/api/media/"))
      body = { episodes: [], configured: false };
    else if (url.pathname === "/api/random")
      body = { anime: fixtures.detail.anime };
    else if (url.pathname === "/api/schedule")
      body = {
        items: [
          {
            id: 1,
            episode: 7,
            airingAt: Number(p.get("from")) + 3600,
            anime: fixtures.detail.anime,
          },
        ],
        fetchedAt: new Date().toISOString(),
      };
    else {
      let items = titles.filter(
        (a) =>
          (!p.get("q") ||
            Object.values(a.title)
              .join(" ")
              .toLowerCase()
              .includes(p.get("q").toLowerCase())) &&
          (!p.get("type") || a.type === p.get("type")) &&
          (!p.get("rating") || a.score >= Number(p.get("rating"))),
      );
      const pageNo = Number(p.get("page")) || 1;
      const limit = Number(p.get("limit")) || 18;
      body = {
        items: items.slice((pageNo - 1) * limit, pageNo * limit),
        pageInfo: {
          currentPage: pageNo,
          total: items.length,
          lastPage: Math.ceil(items.length / limit),
          hasNextPage: pageNo * limit < items.length,
        },
        fetchedAt: new Date().toISOString(),
      };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
});
test("search, details, watchlist persistence and title preferences", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Show spotlight 1", exact: true })
    .click();
  await expect(page.locator("h1")).toBeVisible();
  await page.keyboard.press("/");
  await page
    .getByRole("textbox", { name: "Search anime", exact: true })
    .fill("Frieren");
  await expect(page.locator(".search-results a").first()).toContainText(
    "Frieren",
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/anime\/frieren/);
  await expect(page.locator(".detail-copy h1")).toContainText("Frieren");
  await page
    .getByRole("button", { name: "Add to watchlist", exact: true })
    .click();
  await page.goto("/watchlist");
  await expect(page.locator(".catalogue-grid")).toContainText("Frieren");
  await page.reload();
  await expect(page.locator(".catalogue-grid")).toContainText("Frieren");
  await page.locator(".language-toggle").click();
  await expect(page.locator(".catalogue-grid")).toContainText(
    "Sousou no Frieren",
  );
  await page.getByRole("button", { name: /Remove Sousou/ }).click();
  await expect(page.getByText("Your SoraiX Watchlist is empty.")).toBeVisible();
  expect(errors).toEqual([]);
});
test("catalogue filters, query pagination and empty state", async ({
  page,
}) => {
  await page.goto("/filter");
  await page.getByLabel("type", { exact: true }).selectOption("Movie");
  await expect(
    page.locator(".catalogue-grid .anime-card").first(),
  ).toBeVisible();
  await expect(page).toHaveURL(/type=Movie/);
  await page.getByLabel("Minimum score").selectOption("9");
  await expect(page).toHaveURL(/rating=9/);
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search catalogue" })
    .fill("no-title-exists-12345");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("No anime found.")).toBeVisible();
  await page.goto("/tv?sort=Score");
  await page.getByRole("button", { name: "2", exact: true }).click();
  await expect(page).toHaveURL(/sort=Score&page=2/);
  await expect(page.locator(".anime-card").first()).toBeVisible();
});
test("watch page episode navigation and local discussion", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/watch/frieren-beyond-journey-s-end-52991?ep=1", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".watch-title h1")).toContainText("Frieren");
  await expect(
    page.getByText("No in-site episode source available yet"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Browse playable episodes" }),
  ).toHaveAttribute("href", "/watchable");
  await expect(page.locator('.player-column a[target="_blank"]')).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Lights off", exact: true }).click();
  await expect(page.locator("body")).toHaveClass(/theater-mode/);
  await page.getByRole("button", { name: "Lights on", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nickname", exact: true })
    .fill("Traveler");
  await page
    .getByRole("textbox", { name: "Comment", exact: true })
    .fill("<img src=x onerror=alert(1)> A wonderful journey.");
  await page.getByLabel("Contains spoilers").check();
  await page.getByRole("button", { name: "Post locally" }).click();
  await page.getByText("Spoiler — click to reveal").click();
  await expect(page.locator(".comment p")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator(".comment img")).toHaveCount(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".comment strong")).toHaveText("Traveler");
  expect(errors).toEqual([]);
});
test("responsive home, navigation and no horizontal overflow", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  for (const width of [1920, 1440, 1024, 768, 480, 375, 320]) {
    await page.setViewportSize({ width, height: 950 });
    await expect(page.locator(".hero")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `overflow at ${width}`,
    ).toBeTruthy();
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .locator(".drawer")
    .getByRole("link", { name: "Movies", exact: true })
    .click();
  await expect(page).toHaveURL(/\/movies/);
  await expect(page.locator(".drawer")).toHaveCount(0);
  await page.goto("/unknown-path");
  await expect(
    page.getByText("A little lost in another dimension."),
  ).toBeVisible();
});

test("API failures are visible and retry replaces the error with live content", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/home", async (route) => {
    calls++;
    await route.fulfill({
      status: calls === 1 ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        calls === 1
          ? { error: "The live provider is temporarily unavailable." }
          : fixtures.home,
      ),
    });
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".hero h1")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("schedule day selection queries real timestamp bounds", async ({
  page,
}) => {
  await page.goto("/schedule");
  await expect(page.locator(".schedule-list")).toContainText("Episode 7");
  const request = page.waitForRequest((r) =>
    r.url().includes("/api/schedule?"),
  );
  await page.locator(".week-tabs button:not(.active)").first().click();
  const url = new URL((await request).url());
  expect(
    Number(url.searchParams.get("to")) - Number(url.searchParams.get("from")),
  ).toBeGreaterThan(0);
  await expect(page.locator(".schedule-list a")).toHaveCount(1);
});

// Local WPT fixture tests the native player without relying on a live CDN.
test("direct playback, progress, next episode, audio availability and retry", async ({
  page,
}) => {
  await page.route("**/api/media/**", (route) =>
    route.fulfill({
      json: {
        provider: "Test provider",
        episodes: [
          {
            number: 1,
            title: "First episode",
            provider: "direct",
            availableLanguages: ["sub"],
          },
          {
            number: 2,
            title: "Second episode",
            provider: "direct",
            availableLanguages: ["sub"],
          },
        ],
      },
    }),
  );
  const clip = fs.readFileSync(
    new URL("../fixtures/playback.mp4", import.meta.url),
  );
  await page.route("**/test-episode.mp4*", (route) =>
    route.fulfill({ status: 200, contentType: "video/mp4", body: clip }),
  );
  let streamRequests = 0;
  await page.route("**/api/stream/**", (route) => {
    streamRequests++;
    const ep = Number(
      new URL(route.request().url()).pathname.split("/").at(-1),
    );
    return route.fulfill({
      json: {
        provider: "Test provider",
        resolvedAt: String(streamRequests),
        episode: ep,
        media: {
          provider: "direct",
          sources: [
            {
              url: "/test-episode.mp4?episode=" + ep,
              type: "file",
              quality: "Original",
              language: "SUB",
            },
          ],
          captions: [],
        },
      },
    });
  });
  await page.goto("/watch/frieren-beyond-journey-s-end-52991?ep=1");
  await expect(
    page.getByRole("button", { name: "DUB", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.waitForFunction(
    () => document.querySelector("video")?.readyState >= 2,
  );
  await page.locator("video").evaluate((v) => {
    v.muted = true;
    return v.play();
  });
  await page.waitForFunction(
    () => document.querySelector("video")?.currentTime > 1,
  );
  await page.locator("video").evaluate((v) => v.pause());
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("soraix-history"))[0],
    ),
  ).toMatchObject({ source: "direct", episode: 1 });
  await page.getByRole("button", { name: "Next episode", exact: true }).click();
  await expect(page.locator(".watch-title p")).toContainText("Second episode");
  await page.waitForFunction(() =>
    document.querySelector("video")?.currentSrc.includes("episode=2"),
  );
  await expect(page).toHaveURL(/ep=2/);
  await expect(page.locator(".episode-buttons .active")).toHaveText("02");
  const before = streamRequests;
  await page
    .locator("video")
    .evaluate((v) => v.dispatchEvent(new Event("error")));
  await page
    .getByRole("button", { name: "Retry playback", exact: true })
    .click();
  await expect.poll(() => streamRequests).toBeGreaterThan(before);
  await expect(page.locator(".player-message")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 850 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.reload();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("soraix-history"))[0].source,
    ),
  ).toBe("direct");
});
