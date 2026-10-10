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
test("Hindi library filter persists through search and opens the available episode in Hindi", async ({
  page,
}) => {
  await page.route("**/api/watchable?**", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            ...fixtures.detail.anime,
            firstEpisode: 3,
            playableEpisodes: 2,
            availableLanguages: ["hi"],
          },
        ],
        pageInfo: { currentPage: 1, hasNextPage: false },
      },
    }),
  );
  await page.goto("/watchable");
  await page.getByRole("button", { name: "Hindi DUB", exact: true }).click();
  await expect(page).toHaveURL(/audio=hi/);
  await page
    .getByRole("textbox", { name: "Search playable anime" })
    .fill("Frieren");
  await page.getByRole("button", { name: "Search library" }).click();
  await expect(page).toHaveURL(/q=Frieren/);
  await expect(page).toHaveURL(/audio=hi/);
  await expect(page.locator(".direct-collection-card").first()).toHaveAttribute(
    "href",
    /ep=3&audio=hi/,
  );
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
  await page.addInitScript(() => localStorage.setItem('soraix-theme', '"glass"'));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  for (const width of [1920, 1440, 1024, 768, 480, 375, 320]) {
    await page.setViewportSize({ width, height: 950 });
    await expect(page.locator(".hero")).toBeVisible();
    await expect.poll(() => page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ), { message: `overflow at ${width}` }).toBeTruthy();
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator('.drawer a[aria-current="page"]')).toHaveCount(1);
  expect(await page.locator('.drawer-modal').evaluate(el => getComputedStyle(el).backgroundImage)).toContain('gradient');
  expect(await page.locator('.modal-backdrop').evaluate(el => getComputedStyle(el).backdropFilter)).toBe('none');
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
test("missing Hindi stream keeps the anime visible and explains audio unavailability", async ({
  page,
}) => {
  await page.route("**/api/media/**", (route) =>
    route.fulfill({
      json: {
        episodes: [
          {
            number: 1,
            title: "First episode",
            provider: "direct",
            availableLanguages: ["hi"],
          },
        ],
      },
    }),
  );
  await page.route("**/api/stream/**", (route) =>
    route.fulfill({
      status: 404,
      json: { error: "Hindi direct playback is unavailable for this episode." },
    }),
  );
  await page.goto("/watch/frieren-beyond-journey-s-end-52991?ep=1&audio=hi");
  await expect(
    page.getByRole("heading", { name: "This audio stream is unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Anime not found" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
});

test("Mirror remains selectable when native Hindi stream is unavailable", async ({
  page,
}) => {
  await page.route("**/api/media/**", (route) =>
    route.fulfill({
      json: {
        episodes: [
          {
            number: 1,
            title: "Episode one",
            provider: "direct",
            availableLanguages: ["hi"],
          },
        ],
      },
    }),
  );
  await page.route("**/api/stream/**", (route) =>
    route.fulfill({
      json: {
        resolvedAt: "now",
        provider: "DesiDubAnime",
        media: {
          provider: "direct",
          audio: "hi",
          sources: [],
          servers: [
            { name: "Mirror", url: "https://filesforever.link/embed/test" },
          ],
        },
      },
    }),
  );
  await page.route("https://filesforever.link/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<p>External player</p>" }),
  );
  await page.goto("/watch/frieren-beyond-journey-s-end-52991?audio=hi&ep=1");
  await expect(page.getByTitle("Dub episode player")).toBeVisible();
  await expect(page.getByRole("status").filter({hasText:"Switched to Mirror"})).toBeVisible();
  await page
    .getByLabel("Dub server")
    .selectOption("https://filesforever.link/embed/test");
  await expect(page.getByTitle("Dub episode player")).toHaveAttribute(
    "src",
    "https://filesforever.link/embed/test",
  );
  await expect(page.getByTitle("Dub episode player")).not.toHaveAttribute(
    "sandbox",
  );
  await page
    .getByRole("checkbox", { name: "Allow external-player ads and pop-ups" })
    .uncheck();
  await expect(page.getByTitle("Dub episode player")).toHaveAttribute(
    "sandbox",
    /allow-scripts/,
  );
  await page
    .getByRole("checkbox", { name: "Allow external-player ads and pop-ups" })
    .check();
  await expect(page.getByTitle("Dub episode player")).not.toHaveAttribute(
    "sandbox",
  );
  for (const fallback of [false, true]) {
    if (fallback) {
      await page.setViewportSize({width:390,height:844});
      await page.evaluate(() => { Element.prototype.requestFullscreen = undefined; Element.prototype.webkitRequestFullscreen = undefined; });
    }
    await page.getByRole("button", {name:"Fullscreen external player",exact:true}).click();
    await page.waitForFunction(() => document.fullscreenElement || document.querySelector(".player-expanded"));
    expect(await page.getByTitle("Dub episode player").boundingBox()).toEqual(await page.locator(".watch-player-session").boundingBox());
    await page.getByRole("button", {name:"Exit fullscreen",exact:true}).click();
    await page.waitForFunction(() => !document.fullscreenElement && !document.querySelector(".player-expanded"));
  }
  await page.getByLabel("Dub server").selectOption("native");
  await expect(page.getByTitle("Dub episode player")).toHaveCount(0);
});

test("liquid glass widgets, player sliders and reduced motion work", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".glass-widget")).toHaveCount(3);
  await page.route("**/api/media/**", (route) =>
    route.fulfill({
      json: {
        episodes: [
          {
            number: 1,
            title: "Test episode",
            provider: "direct",
            availableLanguages: ["sub"],
          },
        ],
      },
    }),
  );
  await page.route("**/api/stream/**", (route) =>
    route.fulfill({
      json: {
        resolvedAt: "test",
        media: {
          provider: "direct",
          sources: [
            {
              url: "/glass-clip.mp4",
              type: "file",
              quality: "Original",
              language: "SUB",
            },
          ],
          captions: [],
        },
      },
    }),
  );
  await page.route("**/glass-clip.mp4", (route) => {
    const clip = fs.readFileSync(
      new URL("../fixtures/playback.mp4", import.meta.url),
    );
    const range = route
      .request()
      .headers()
      .range?.match(/bytes=(\d+)-(\d*)/);
    if (!range)
      return route.fulfill({
        contentType: "video/mp4",
        headers: { "Accept-Ranges": "bytes" },
        body: clip,
      });
    const start = Number(range[1]),
      end = range[2]
        ? Math.min(Number(range[2]), clip.length - 1)
        : clip.length - 1;
    return route.fulfill({
      status: 206,
      contentType: "video/mp4",
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${clip.length}`,
      },
      body: clip.subarray(start, end + 1),
    });
  });
  await page.goto("/watch/frieren-beyond-journey-s-end-52991?ep=1");
  await page.waitForFunction(
    () => document.querySelector("video")?.readyState >= 2,
  );
  const seek = page.getByRole("slider", { name: "Seek video" });
  await expect(seek).toBeEnabled();
  await seek.focus();
  await seek.press("End");
  await expect
    .poll(() => page.locator("video").evaluate((v) => v.currentTime))
    .toBeGreaterThan(0);
  const volume = page.getByRole("slider", { name: "Video volume" });
  await volume.focus();
  await volume.press("Home");
  await expect
    .poll(() => page.locator("video").evaluate((v) => v.volume))
    .toBe(0);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({ path: "docs/screenshots/liquid-glass-player.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".hosted-controls button").first()).toHaveCSS(
    "transition-duration",
    "0s",
  );
});

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
    page.getByRole("button", { name: "English DUB", exact: true }),
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

test("dub switching preserves position, persists choice and never substitutes sub", async ({
  page,
}) => {
  await page.route("**/api/media/**", (route) =>
    route.fulfill({
      json: {
        episodes: [
          {
            number: 1,
            title: "Both audio versions",
            provider: "audio",
            availableLanguages: ["sub", "dub"],
          },
          {
            number: 2,
            title: "Sub only",
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
  await page.route("**/audio-test.mp4*", (route) => {
    const range = route
      .request()
      .headers()
      ["range"]?.match(/bytes=(\d+)-(\d*)/);
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2]
      ? Math.min(Number(range[2]), clip.length - 1)
      : clip.length - 1;
    return route.fulfill({
      status: range ? 206 : 200,
      contentType: "video/mp4",
      headers: {
        "Accept-Ranges": "bytes",
        ...(range
          ? { "Content-Range": `bytes ${start}-${end}/${clip.length}` }
          : {}),
      },
      body: clip.subarray(start, end + 1),
    });
  });
  const requests = [];
  await page.route("**/api/stream/**", (route) => {
    const url = new URL(route.request().url());
    const audio = url.searchParams.get("language");
    requests.push(audio);
    return route.fulfill({
      json: {
        provider: "Configured video library",
        resolvedAt: Date.now(),
        media: {
          provider: "hosted",
          audio,
          sources: [
            {
              url: "/audio-test.mp4?audio=" + audio,
              type: "file",
              quality: "Original",
              language: audio === "dub" ? "English" : "Japanese",
            },
          ],
          captions: [],
        },
      },
    });
  });
  await page.goto("/watch/frieren-beyond-journey-s-end-52991?ep=1");
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
  await page.getByRole("button", { name: "English DUB", exact: true }).click();
  await expect(page).toHaveURL(/audio=dub/);
  await page.waitForFunction(
    () =>
      document.querySelector("video")?.currentSrc.includes("audio=dub") &&
      document.querySelector("video").currentTime >= 0.9,
  );
  expect(await page.locator("video").evaluate((v) => v.paused)).toBe(true);
  await expect(
    page.getByRole("button", { name: "English DUB", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("soraix-audio-version")),
    ),
  ).toBe("dub");
  await page.reload();
  await page.waitForFunction(() =>
    document.querySelector("video")?.currentSrc.includes("audio=dub"),
  );
  await page.getByRole("button", { name: "Next episode", exact: true }).click();
  await expect(
    page.getByText("English DUB is unavailable for this episode", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  expect(requests.at(-1)).toBe("dub");
  await page.getByRole("button", { name: "Watch SUB", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector("video")?.currentSrc.includes("audio=sub"),
  );
  expect(requests.at(-1)).toBe("sub");
});

test("auto intro respects cold open and auto next retains fullscreen", async ({
  page,
}) => {
  await page.route("**/api/media/**", (route) =>
    route.fulfill({
      json: {
        episodes: [1, 2].map((number) => ({
          number,
          title: `Episode ${number}`,
          provider: "direct",
          availableLanguages: ["sub"],
        })),
      },
    }),
  );
  await page.route("**/api/stream/**", async (route) => {
    const number = new URL(route.request().url()).pathname.split("/").at(-1);
    if (number === "2")
      await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      json: {
        resolvedAt: number,
        media: {
          provider: "direct",
          sources: [
            {
              url: `/autonext.mp4?ep=${number}`,
              type: "file",
              quality: "Original",
              language: "Japanese",
            },
          ],
        },
      },
    });
  });
  const clip = fs.readFileSync(
    new URL("../fixtures/playback.mp4", import.meta.url),
  );
  await page.route("**/autonext.mp4*", (route) => {
    const range = route
      .request()
      .headers()
      .range?.match(/bytes=(\d+)-(\d*)/);
    const start = range ? Number(range[1]) : 0,
      end = range?.[2]
        ? Math.min(Number(range[2]), clip.length - 1)
        : clip.length - 1;
    return route.fulfill({
      status: range ? 206 : 200,
      contentType: "video/mp4",
      headers: {
        "Accept-Ranges": "bytes",
        ...(range
          ? { "Content-Range": `bytes ${start}-${end}/${clip.length}` }
          : {}),
      },
      body: clip.subarray(start, end + 1),
    });
  });
  await page.route("https://api.aniskip.com/**", (route) => {
    const duration = Number(
      new URL(route.request().url()).searchParams.get("episodeLength"),
    );
    return route.fulfill({
      json: {
        found: true,
        results: [
          {
            skipType: "op",
            episodeLength: duration,
            interval: { startTime: 0.6, endTime: 1.6 },
          },
        ],
      },
    });
  });
  await page.goto("/watch/frieren-beyond-journey-s-end-52991?ep=1");
  await expect(page.getByText("Intro timing by AniSkip")).toBeVisible();
  await expect(page.getByLabel("Auto skip intro")).toBeChecked();
  await expect(page.getByLabel("Auto next", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Autoplay", { exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
  await page.waitForFunction(() =>
    document.fullscreenElement?.classList.contains("watch-player-session"),
  );
  expect(await page.locator("video").boundingBox()).toEqual(await page.locator(".watch-player-session").boundingBox());
  await page.getByRole("button", {name:"Fill screen",exact:true}).click();
  await expect(page.locator("video")).toHaveCSS("object-fit", "cover");
  await page.getByRole("button", {name:"Fit video",exact:true}).click();
  await expect(page.locator("video")).toHaveCSS("object-fit", "contain");
  await page.evaluate(() => {
    window.originalFullscreen = document.fullscreenElement;
    window.fullscreenExits = 0;
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) window.fullscreenExits++;
    });
  });
  await page.locator("video").evaluate((v) => {
    v.muted = true;
    window.firstVideo = v;
    window.introJump = false;
    v.addEventListener("seeking", () => {
      if (v.currentTime >= 1.6) window.introJump = true;
    });
    return v.play();
  });
  await expect
    .poll(() => page.locator("video").evaluate((v) => v.currentTime))
    .toBeLessThan(0.6);
  await page.waitForFunction(() => window.introJump === true);
  // Rewinding into the opening after a skip should remain possible.
  await page.locator("video").evaluate((v) => {
    v.pause();
    v.currentTime = 0.8;
    v.dispatchEvent(new Event("timeupdate"));
  });
  await expect
    .poll(() => page.locator("video").evaluate((v) => v.currentTime))
    .toBeLessThan(1);
  await page.locator("video").evaluate((v) => {
    v.currentTime = v.duration - 0.25;
    return v.play();
  });
  await expect(page).toHaveURL(/ep=2/);
  await page.waitForFunction(
    () =>
      document.querySelector("video")?.currentSrc.includes("ep=2") &&
      !document.querySelector("video").paused,
  );
  expect(
    await page.evaluate(() => ({
      same: document.fullscreenElement === window.originalFullscreen,
      exits: window.fullscreenExits,
      tag: document.fullscreenElement?.className,
      connected: window.originalFullscreen?.isConnected,
    })),
  ).toEqual({
    same: true,
    exits: 0,
    tag: "watch-player-session",
    connected: true,
  });
  await expect(page.getByLabel("Auto next", { exact: true })).toHaveCount(0);
  await page.locator("video").evaluate((v) => {
    v.currentTime = v.duration - 0.1;
    return v.play();
  });
  await page.waitForFunction(() => document.querySelector("video")?.ended);
  await expect(page).toHaveURL(/ep=2/);
});
for (const failure of ['missing', 'denied']) {
  test(`fullscreen fallback expands and exits when API is ${failure}`, async ({page}) => {
    await page.setViewportSize({width:390,height:844});
    await page.route('**/api/media/**', route=>route.fulfill({json:{episodes:[{number:1,title:'Episode 1',sources:[{url:'/empty.mp4',type:'file'}]}]}}));
    await page.route('**/empty.mp4',route=>route.abort());
    await page.goto('/watch/frieren-beyond-journey-s-end-52991?ep=1');
    await page.evaluate(mode=>{
      Element.prototype.requestFullscreen = mode === 'missing' ? undefined : () => Promise.reject(new Error('Denied'));
      Element.prototype.webkitRequestFullscreen = undefined;
    },failure);
    await page.getByRole('button',{name:'Expand video',exact:true}).click();
    const shell=page.locator('.watch-player-session');
    await expect(shell).toHaveClass(/player-expanded/);
    const box=await shell.boundingBox();
    expect(await page.locator("video").boundingBox()).toEqual(box);
    expect(box.x).toBe(0); expect(box.y).toBe(0);
    expect(box.width).toBe(390); expect(box.height).toBe(844);
    await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();
    await expect(shell).not.toHaveClass(/player-expanded/);
    await page.getByRole('button',{name:'Expand video',exact:true}).click();
    await expect(shell).toHaveClass(/player-expanded/);
    await page.keyboard.press('Escape');
    await expect(shell).not.toHaveClass(/player-expanded/);
    expect(await page.evaluate(()=>document.body.classList.contains('player-fullscreen-open'))).toBe(false);
  });
}

test('Hindi native error switches to external once and respects manual return', async ({page}) => {
  await page.route('**/api/media/**', route=>route.fulfill({json:{episodes:[{number:1,title:'Episode 1',provider:'direct',availableLanguages:['hi']}]}}));
  await page.route('**/api/stream/**', route=>route.fulfill({json:{resolvedAt:'fallback-test',media:{provider:'direct',sources:[{url:'/fallback-test.mp4',type:'file',language:'Hindi',quality:'Original'}],servers:[{name:'Mirror',url:'https://filesforever.link/embed/fallback-test'}]}}}));
  await page.route('**/fallback-test.mp4',route=>route.fulfill({contentType:'video/mp4',body:fs.readFileSync(new URL('../fixtures/playback.mp4',import.meta.url))}));
  await page.route('https://filesforever.link/**',route=>route.fulfill({contentType:'text/html',body:'External player fixture'}));
  await page.goto('/watch/frieren-beyond-journey-s-end-52991?audio=hi&ep=1');
  await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  await page.getByRole('button',{name:'Fullscreen',exact:true}).click();
  await page.waitForFunction(()=>!!document.fullscreenElement);
  await page.locator('video').evaluate(v=>v.dispatchEvent(new Event('error')));
  await expect(page.getByTitle('Dub episode player')).toBeVisible();
  expect(await page.evaluate(()=>document.fullscreenElement?.classList.contains('watch-player-session'))).toBe(true);
  await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();
  await page.getByLabel('Dub server').selectOption('native');
  await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  await page.locator('video').evaluate(v=>v.dispatchEvent(new Event('error')));
  await expect(page.getByRole('button',{name:'Retry playback',exact:true})).toBeVisible();
  await expect(page.getByTitle('Dub episode player')).toHaveCount(0);
});

test('English-only external servers open automatically and remain selectable', async ({page}) => {
  await page.route('**/api/media/**',r=>r.fulfill({json:{episodes:[{number:1,title:'English episode',provider:'audio',availableLanguages:['dub']}]}}));
  await page.route('**/api/stream/**',r=>r.fulfill({json:{resolvedAt:'english',media:{audio:'dub',sources:[],servers:[{name:'Mirror',url:'https://filesforever.link/embed/english-test'},{name:'Abyss',url:'https://play.abyssplayer.com/english-test'}]}}}));
  await page.route('https://filesforever.link/**',r=>r.fulfill({contentType:'text/html',body:'English test player'}));
  await page.route('https://play.abyssplayer.com/**',r=>r.fulfill({contentType:'text/html',body:'English alternate player'}));
  await page.goto('/watch/frieren-beyond-journey-s-end-52991?audio=dub&ep=1');
  await expect(page.getByRole('button',{name:'English DUB',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Hindi DUB',exact:true})).toBeDisabled();
  await expect(page.getByTitle('Dub episode player')).toHaveAttribute('src','https://filesforever.link/embed/english-test');
  await expect(page.getByRole('status').filter({hasText:'Switched to Mirror'})).toContainText('English DUB');
  await page.getByLabel('Dub server').selectOption('https://play.abyssplayer.com/english-test');
  await expect(page.getByTitle('Dub episode player')).toHaveAttribute('src','https://play.abyssplayer.com/english-test');
});

test('SUB subtitles load from local SRT, sync, turn off and stay out of Hindi', async ({page}) => {
 await page.route('**/api/media/**',r=>r.fulfill({json:{episodes:[{number:1,title:'Episode',provider:'audio',availableLanguages:['sub','dub','hi']}]}}));
 await page.route('**/api/stream/**',r=>r.fulfill({json:{resolvedAt:'captions',media:{sources:[{url:'/caption-video.mp4',type:'file'}],captions:[]}}}));
 await page.route('**/caption-video.mp4',r=>r.fulfill({contentType:'video/mp4',body:fs.readFileSync(new URL('../fixtures/playback.mp4',import.meta.url))}));
 await page.route('**/api/subtitles/**',r=>r.fulfill({json:{captions:[]}}));
 await page.goto('/watch/frieren-beyond-journey-s-end-52991?ep=1&audio=sub');
 await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 await page.getByRole('button',{name:'Subtitle settings',exact:true}).click();
 await page.getByLabel('Load subtitle file').setInputFiles({name:'english.srt',mimeType:'text/plain',buffer:Buffer.from('1\n00:00:00,100 --> 00:00:02,000\nHello SoraiX\n')});
 await page.waitForFunction(()=>Array.from(document.querySelector('video').textTracks).some(t=>t.cues?.[0]?.text==='Hello SoraiX'&&t.mode==='showing'));
 await page.getByLabel('Subtitle delay', {exact:true}).fill('0.5');
 await expect.poll(()=>page.locator('video').evaluate(v=>v.textTracks[0].cues[0].startTime)).toBe(0.6);
 await page.getByLabel('Caption track',{exact:true}).selectOption('-1');
 await expect.poll(()=>page.locator('video').evaluate(v=>v.textTracks[0].mode)).toBe('disabled');
 await page.getByRole('button',{name:'Find English subtitles',exact:true}).click();
 await expect(page.getByText('No English subtitle file was found for this episode. You can load your own SRT/VTT.')).toBeVisible();
 await page.getByRole('button',{name:'Hindi DUB',exact:true}).click();
 await expect(page.getByRole('button',{name:'Subtitle settings',exact:true})).toHaveCount(0);
 await page.route('**/api/subtitles/**',r=>r.fulfill({json:{captions:[{url:'/english-auto.vtt',language:'en',label:'English'}]}}));
 await page.route('**/english-auto.vtt',r=>r.fulfill({contentType:'text/vtt',body:'WEBVTT\n\n00:00.100 --> 00:02.000\nAutomatic English caption\n'}));
 await page.getByRole('button',{name:'English DUB',exact:true}).click();
 await expect(page.getByRole('button',{name:'Subtitle settings',exact:true})).toBeVisible();
 await page.waitForFunction(()=>Array.from(document.querySelector('video').textTracks).some(t=>t.cues?.[0]?.text==='Automatic English caption'&&t.mode==='showing'));
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Subtitle settings',exact:true}).click();
 const panel=await page.getByRole('region',{name:'Subtitle settings panel'}).boundingBox();
 const player=await page.locator('.hosted-player').boundingBox();
 expect(panel.y+panel.height).toBeLessThanOrEqual(player.y+player.height);

});

test('missing SUB captions automatically load external VTT and manual search uses external lookup', async ({page}) => {
 await page.route('**/api/media/**',r=>r.fulfill({json:{episodes:[{number:1,title:'Episode',provider:'audio',availableLanguages:['sub']}]}}));
 await page.route('**/api/stream/**',r=>r.fulfill({json:{resolvedAt:'external-captions',media:{audio:'sub',sources:[{url:'/caption-video.mp4',type:'file'}],captions:[]}}}));
 await page.route('**/caption-video.mp4',r=>r.fulfill({contentType:'video/mp4',body:fs.readFileSync(new URL('../fixtures/playback.mp4',import.meta.url))}));
 const requests=[];
 await page.route('**/api/subtitles/**',r=>{requests.push(r.request().url());return r.fulfill({json:{captions:[{vtt:'WEBVTT\n\n00:00.100 --> 00:02.000\nExternal English caption\n',language:'en',label:'English · Jimaku'}]}})});
 await page.goto('/watch/frieren-beyond-journey-s-end-52991?ep=1&audio=sub');
 await page.waitForFunction(()=>Array.from(document.querySelector('video')?.textTracks||[]).some(t=>t.cues?.[0]?.text==='External English caption'&&t.mode==='showing'));
 await page.getByRole('button',{name:'Subtitle settings',exact:true}).click();
 await page.getByRole('button',{name:'Find English subtitles',exact:true}).click();
 await expect.poll(()=>requests.some(url=>url.endsWith('?external=1'))).toBe(true);
});

test('SUB failures advance through backups once and ignore spoofed messages', async ({page}) => {
 await page.setViewportSize({width:390,height:844});
 const first='https://ani.pm/embed/ani/154587/1/sub';
 const second=first+'?hardsub=1';
 await page.route('**/api/media/**',r=>r.fulfill({json:{episodes:[{number:1,title:'Episode',provider:'audio',availableLanguages:['sub']}]}}));
 await page.route('**/api/stream/**',r=>r.fulfill({json:{resolvedAt:'sub-fallback',media:{sources:[{url:'/sub-test.mp4',type:'file'}],servers:[{name:'SUB backup',url:first},{name:'Burned-in SUB',url:second}]}}}));
 await page.route('**/sub-test.mp4',r=>r.fulfill({contentType:'video/mp4',body:fs.readFileSync(new URL('../fixtures/playback.mp4',import.meta.url))}));
 await page.route('https://ani.pm/**',r=>r.fulfill({contentType:'text/html',body:'Backup fixture'}));
 await page.goto('/watch/frieren-beyond-journey-s-end-52991?ep=1&audio=sub');
 await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 await page.locator('video').evaluate(v=>v.dispatchEvent(new Event('error')));
 const player=page.getByTitle('SUB episode player');
 await expect(player).toHaveAttribute('src',first);
 await expect(player).not.toHaveAttribute('sandbox');
 await page.getByLabel('Allow external-player ads and pop-ups').uncheck();
 await expect(player).toHaveAttribute('sandbox', /allow-scripts/);
 await page.getByLabel('Allow external-player ads and pop-ups').check();
 await expect(player).not.toHaveAttribute('sandbox');
 await page.evaluate(()=>window.postMessage({ns:'anipm.player',v:1,event:'error'},'*'));
 await expect(player).toHaveAttribute('src',first);
 const fail=async()=>{
   const child=page.frames().find(f=>f.url().startsWith('https://ani.pm/'));
   await child.evaluate(()=>parent.postMessage({ns:'anipm.player',v:1,event:'error'},'*'));
 };
 await expect.poll(()=>page.frames().some(f=>f.url()===first)).toBe(true);
 await fail();
 await expect(player).toHaveAttribute('src',second);
 await expect.poll(()=>page.frames().some(f=>f.url()===second)).toBe(true);
 await fail();
 await expect(page.getByRole('status').filter({hasText:'Available SUB backups could not load'})).toBeVisible();
 await expect(player).toHaveAttribute('src',second);
 await expect(page.getByRole('button',{name:'Try next SUB server'})).toBeDisabled();
});

test('player episode buttons preserve fullscreen and respect episode boundaries', async ({page}) => {
 await page.route('**/api/media/**',r=>r.fulfill({json:{episodes:[1,2].map(number=>({number,title:`Episode ${number}`,sources:[{url:'/episode-controls.mp4',type:'file'}]}))}}));
 await page.route('**/episode-controls.mp4',r=>r.fulfill({contentType:'video/mp4',body:fs.readFileSync(new URL('../fixtures/playback.mp4',import.meta.url))}));
 await page.goto('/watch/frieren-beyond-journey-s-end-52991?ep=1');
 await expect(page.getByRole('button',{name:'Previous episode in player',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Expand video',exact:true}).click();
 await page.waitForFunction(()=>!!document.fullscreenElement);
 await page.mouse.move(1, 1);
 await expect(page.locator('.watch-player-session')).toHaveClass(/player-controls-hidden/, {timeout:7000});
 await expect(page.locator('video')).not.toHaveAttribute('controls');
 await page.getByRole('button',{name:'Show player controls',exact:true}).click({position:{x:150,y:150}});
 await expect(page.locator('.watch-player-session')).not.toHaveClass(/player-controls-hidden/);
 await expect(page.locator('video')).toHaveAttribute('controls','');
 await page.getByRole('button',{name:'Next episode in player',exact:true}).click();
 await expect(page).toHaveURL(/ep=2/);
 await expect(page.getByRole('button',{name:'Next episode in player',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>document.fullscreenElement?.classList.contains('watch-player-session'))).toBe(true);
 await page.getByRole('button',{name:'Previous episode in player',exact:true}).click();
 await expect(page).toHaveURL(/ep=1/);
 expect(await page.evaluate(()=>document.fullscreenElement?.classList.contains('watch-player-session'))).toBe(true);
});
