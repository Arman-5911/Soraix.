import { test, expect } from "@playwright/test";
import { READ_LISTEN_ENABLED } from "../../src/features.js";
const item = {
  id: 1,
  anilistId: 30104,
  slug: "book-1",
  mode: "manga",
  title: { english: "A New World" },
  poster: "/fallback.svg",
  banner: "/fallback.svg",
  description: "A story across worlds.",
  genres: ["Fantasy"],
  year: 2020,
  score: 8,
  chapters: 2,
  status: "Finished",
};
const chapters = [
  { id: "chapter-a", title: "Chapter 1", number: "1" },
  { id: "chapter-b", title: "Chapter 2", number: "2" },
];
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    let data;
    if (u.pathname === "/api/universe")
      data = {
        items: [{ ...item, mode: u.searchParams.get("mode") }],
        pageInfo: { hasNextPage: false },
      };
    else if (u.pathname.startsWith("/api/universe/"))
      data = {
        item: u.pathname.endsWith("/99")
          ? { ...item, anilistId: 99, mode: "donghua" }
          : item,
        related: [
          {
            ...item,
            anilistId: 99,
            mode: "donghua",
            title: { english: "Animated World" },
          },
        ],
        recommendations: [item],
      };
    else if (u.pathname.startsWith("/api/chapters/")) data = { item, chapters };
    else if (u.pathname.startsWith("/api/pages/"))
      data = {
        pages: [
          "/test-page.svg?1",
          "/test-page.svg?2",
          "/test-page.svg?3",
          "/test-page.svg?4",
        ],
      };
    else data = { items: [], trending: [], popular: [] };
    return route.fulfill({ json: data });
  });
  await page.route("**/test-page.svg?*", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="700" height="1000"><rect width="700" height="1000" fill="#ddd"/><text x="40" y="100" font-size="50">Reader test page</text></svg>',
    }),
  );
  await page.addInitScript(() => {
    if (!localStorage.getItem("soraix-content-mode"))
      localStorage.setItem("soraix-content-mode", '"manga"');
  });
});
test("missing MangaDex thumbnail retries the original cover, then shows a local fallback", async ({ page }) => {
  const resized = "https://uploads.mangadex.org/covers/aa6c76f7-5f5f-46b6-a800-911145f81b9b/cover.jpg.256.jpg";
  const original = resized.slice(0, -8);
  let originalRequests = 0;
  await page.route("**/api/universe?**", (route) => route.fulfill({
    json: { items: [{ ...item, poster: resized }], pageInfo: { hasNextPage: false } },
  }));
  await page.route(resized, (route) => route.fulfill({ status: 404 }));
  await page.route(original, (route) => {
    originalRequests += 1;
    return route.fulfill({ status: 404 });
  });
  await page.goto("/search");
  const cover = page.locator(".universe-card img").first();
  await expect(cover).toHaveAttribute("src", "/fallback.svg");
  await expect.poll(() => cover.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(originalRequests).toBeGreaterThan(0);
});
test("source selection loads provider chapters and keeps the source in reader navigation", async ({
  page,
}) => {
  const id = "wc_01J76XYXYZGGRVGEGATYQWFTD8";
  await page.route("**/api/chapters/**", (route) => {
    const source = new URL(route.request().url()).searchParams.get("source");
    return route.fulfill({
      json: {
        item,
        source: source === "weebcentral" ? source : "mangadex",
        chapters:
          source === "weebcentral"
            ? [{ id, number: "0", title: "Chapter 0" }]
            : chapters,
      },
    });
  });
  await page.goto("/media/30104");
  await page.getByLabel("Reading source").selectOption("weebcentral");
  await expect(
    page.getByRole("link", { name: "Read now", exact: true }),
  ).toHaveAttribute("href", `/read/30104/${id}?language=en&source=weebcentral`);
  await page.getByRole("link", { name: "Read now", exact: true }).click();
  await expect(page).toHaveURL(/source=weebcentral/);
  await expect(page.getByLabel("Select chapter", { exact: true })).toHaveValue(
    id,
  );
});

test("combined reader switches editions and continues to a chapter from another source", async ({
  page,
}) => {
  const alternative = {
    id: "wc_01J76XYXYZGGRVGEGATYQWFTD8",
    number: "1",
    title: "Chapter 1",
    provider: "WeebCentral",
  };
  const next = {
    id: "wc_01J76XZ666GREP4DQDKEP1YDZG",
    number: "2",
    title: "Chapter 2",
    provider: "WeebCentral",
  };
  await page.route("**/api/chapters/**", (route) =>
    route.fulfill({
      json: {
        item,
        source: "auto",
        provider: "Combined sources",
        chapters: [
          { ...chapters[0], provider: "MangaDex", alternatives: [alternative] },
          next,
        ],
      },
    }),
  );
  await page.goto("/read/30104/chapter-a?language=en&source=auto");
  await page
    .getByLabel("Chapter source", { exact: true })
    .selectOption(alternative.id);
  await expect(page.getByLabel("Select chapter", { exact: true })).toHaveValue(
    "chapter-a",
  );
  await expect(page.getByLabel("Chapter source", { exact: true })).toHaveValue(
    alternative.id,
  );
  await page.getByRole("button", { name: "Next chapter", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(next.id + ".*source=auto"));
});

test("global mode changes catalogue and survives refresh on mobile", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Trending Manga" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Content mode", exact: true })
    .selectOption("manhwa");
  await expect(
    page.getByRole("heading", { name: "Trending Manhwa" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Content mode", exact: true }),
  ).toHaveValue("manhwa");
  await page.setViewportSize({ width: 375, height: 812 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});
test("SoraiX mode label stays bold and readable across content modes", async ({ page }) => {
  await page.goto("/");
  const label = page.locator(".soraix-brand .brand-mode").first();
  await expect(label).toHaveText("Manga");
  await expect(label).toHaveCSS("font-weight", "800");
  await expect(label).toHaveCSS("font-family", 'Manrope, sans-serif');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("combobox", { name: "Content mode", exact: true }).selectOption("manhwa");
  await expect(label).toHaveText("Manhwa");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("footer stays after the overview and at the end on desktop and mobile", async ({ page }) => {
  await page.goto("/watchlist");
  await expect(page.locator(".app-shell > footer")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.querySelector("#site-overview")?.parentElement?.id)).toBe("overview-slot");
  await expect.poll(() => page.evaluate(() => document.querySelector("#overview-slot")?.nextElementSibling?.tagName)).toBe("FOOTER");
  await expect.poll(() => page.evaluate(() => Math.round(document.querySelector(".app-shell > footer").getBoundingClientRect().bottom) >= innerHeight)).toBe(true);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("combobox", { name: "Content mode", exact: true }).selectOption("manga");
  await expect(page.locator(".app-shell > footer.universe-footer")).toBeVisible();
  await expect(page.locator(".universe-footer nav a")).toHaveCount(3);
});
test("anime guide stays directly above the footer after route navigation", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("soraix-content-mode", '"anime"'));
  await page.reload();
  await expect(page.locator("#site-overview .landing-overview")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.querySelector("#overview-slot")?.previousElementSibling?.id)).toBe("main");
  await page.locator(".footer-top").getByRole("link", { name: "Movies" }).click();
  await expect(page).toHaveURL(/\/movies$/);
  await expect(page.locator("#site-overview .landing-overview")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.querySelector("#overview-slot")?.nextElementSibling?.tagName)).toBe("FOOTER");
});
test("anime category bar stays below header without page overflow", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("soraix-content-mode", '"anime"'));
  await page.reload();
  for (const theme of ["dim", "glass", "pearl"]) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    for (const width of [1440, 1024, 375]) {
      await page.setViewportSize({ width, height: 812 });
      const layout = await page.evaluate(() => {
        const header = document.querySelector(".app-shell > .header").getBoundingClientRect();
        const bar = document.querySelector(".app-shell > .subnav").getBoundingClientRect();
        return { gap: bar.top - header.bottom, barWidth: bar.width, pageWidth: document.documentElement.scrollWidth };
      });
      expect(layout.gap).toBeGreaterThanOrEqual(-1);
      expect(layout.gap).toBeLessThanOrEqual(12);
      expect(layout.barWidth).toBeLessThanOrEqual(width + 1);
      expect(layout.pageWidth).toBeLessThanOrEqual(width + 1);
      await expect(page.locator(".subnav nav").getByRole("link", { name: "TV Series" })).toBeVisible();
    }
  }
});
test("reader saves progress, supports layouts, chapter navigation and library", async ({
  page,
}) => {
  await page.goto("/media/30104");
  await page.getByRole("button", { name: "Save to library" }).click();
  await expect(
    page.getByRole("link", { name: "Read now", exact: true }),
  ).toHaveAttribute(
    "href",
    "/read/30104/chapter-a?language=en&source=mangadex",
  );
  await page.getByRole("link", { name: "Chapter 1 Read" }).click();
  await page.getByLabel("Reading layout").selectOption("single");
  await expect(page.locator(".reader-pages img")).toHaveCount(1);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator(".reader-bottom")).toContainText("2 / 4");
  await page.reload();
  await expect(page.locator(".reader-bottom")).toContainText("2 / 4");
  await page.getByLabel("Reading layout").selectOption("double");
  await expect(page.locator(".reader-pages img")).toHaveCount(2);
  await page.getByLabel("Reading direction").selectOption("rtl");
  await expect(page.locator(".reader-pages")).toHaveCSS("direction", "rtl");
  await page.getByRole("button", { name: "Next chapter", exact: true }).click();
  await expect(page).toHaveURL(/chapter-b/);
  await expect(page.locator(".reader-toolbar strong")).toHaveText("Chapter 2");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("soraix-reading-history"))[0].chapter
            .id,
      ),
    )
    .toBe("chapter-b");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Continue Reading" }),
  ).toBeVisible();
  await expect(page.locator(".reading-history").first()).toContainText(
    "Chapter 2",
  );
  await page.goto("/watchlist");
  await expect(page.locator(".universe-card")).toContainText("A New World");
});
test("reader fullscreen hides controls and restores them on page tap", async ({ page }) => {
  await page.goto("/read/30104/chapter-a");
  await page.getByRole("button", { name: "Enter reader fullscreen" }).click();
  await expect(page.locator(".reader")).toHaveClass(/reader-immersive/);
  await expect(page.locator(".reader")).toHaveClass(/reader-controls-hidden/, { timeout: 6000 });
  await page.mouse.move(300, 300);
  await expect(page.locator(".reader")).toHaveClass(/reader-controls-hidden/);
  await page.locator(".reader-pages img").first().click();
  await expect(page.locator(".reader")).not.toHaveClass(/reader-controls-hidden/);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator(".reader-bottom")).toContainText("2 / 4");
  await page.getByRole("button", { name: "Exit reader fullscreen" }).click();
  await expect(page.locator(".reader")).not.toHaveClass(/reader-immersive/);
});
test("reader Fill page uses available width without cropping or excessive upscaling", async ({ page }) => {
  await page.goto("/read/30104/chapter-a");
  await page.getByLabel("Reading layout").selectOption("single");
  await page.getByRole("button", { name: "Fill reader page" }).click();
  const image = page.locator(".reader-pages img");
  await expect(page.locator(".reader-pages")).toHaveClass(/reader-pages-fill/);
  await expect.poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  const sizes = await image.evaluate((img) => ({ width: img.getBoundingClientRect().width, natural: img.naturalWidth, fit: getComputedStyle(img).objectFit }));
  expect(sizes.width).toBeLessThanOrEqual(sizes.natural * 1.25 + 1);
  expect(sizes.fit).toBe("contain");
  await page.getByRole("button", { name: "Fit reader page" }).click();
  await expect(page.locator(".reader-pages")).not.toHaveClass(/reader-pages-fill/);
});
test("reader full-window fallback fits mobile and exits with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/read/30104/chapter-a");
  await expect(page.locator(".reader")).toBeVisible();
  await page.evaluate(() => {
    document.querySelector(".reader").requestFullscreen = () => Promise.reject(new Error("Unavailable"));
  });
  await page.getByRole("button", { name: "Enter reader fullscreen" }).click();
  await expect(page.locator(".reader")).toHaveClass(/reader-fullwindow/);
  await expect.poll(() => page.locator(".reader").evaluate((el) => Math.round(el.getBoundingClientRect().height))).toBe(812);
  await page.keyboard.press("Escape");
  await expect(page.locator(".reader")).not.toHaveClass(/reader-fullwindow/);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
});
test("adaptation links switch content mode", async ({ page }) => {
  await page.goto("/media/30104");
  await page.getByRole("link", { name: /Animated World/ }).click();
  await expect(page).toHaveURL("/media/99");
  await expect(
    page.getByRole("combobox", { name: "Content mode", exact: true }),
  ).toHaveValue("donghua");
  await expect(
    page.getByRole("link", { name: "Watch episodes", exact: true }),
  ).toBeVisible();
});

test("vertical reader restores the last visible page", async ({ page }) => {
  await page.goto("/read/30104/chapter-a");
  await page.getByLabel("Reading layout").selectOption("vertical");
  await page
    .locator('[data-reader-page="2"]')
    .evaluate((e) => e.scrollIntoView());
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("soraix-reading-history") || "[]")[0]
            ?.page,
      ),
    )
    .toBe(2);
  await page.reload();
  await expect(page.locator(".reader-bottom")).toContainText("3 / 4");
  await expect(page.locator('[data-reader-page="2"]')).toBeInViewport();
});

test('branding follows every content mode with distinct colors', async ({page}) => {
  await page.goto('/');
  const colors = new Set();
  for (const mode of ['anime','manga','manhwa','manhua','donghua']) {
    await page.getByLabel('Content mode').first().selectOption(mode);
    await expect(page.locator('html')).toHaveAttribute('data-content-mode', mode);
    const brand=page.locator('.soraix-brand').first();
    await expect(brand).toHaveAttribute('data-brand-mode', mode);
    await expect(brand.locator('.brand-mode')).toHaveText(new RegExp(mode,'i'));
    colors.add(await brand.evaluate(el=>getComputedStyle(el).getPropertyValue('--brand-color').trim()));
    await expect(brand.locator('.soraix-wordmark')).toHaveCSS('font-family', /SoraiX Display/);
  }
  expect(colors.size).toBe(5);
});

test('Read and Listen discovery, AI transcript, audio sync and key isolation', async ({page}) => {
 test.skip(!READ_LISTEN_ENABLED, 'Read & Listen is temporarily closed.');
 await page.addInitScript(()=>{
   const voice={name:'English test voice',lang:'en-US',voiceURI:'test-en'};
   window.__spoken=[];
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[voice],addEventListener(){},removeEventListener(){},speak(u){window.__spoken.push(u.text);u.onstart?.();},cancel(){window.__cancelled=(window.__cancelled||0)+1;},pause(){},resume(){}}});
   window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 });
 let requests=0;
 await page.route('https://generativelanguage.googleapis.com/**',route=>{
   requests++;
   expect(route.request().headers()['x-goog-api-key']).toBe('test-session-secret');
   const body=route.request().postDataJSON();
   expect(body.contents[0].parts[1].inline_data.data.length).toBeGreaterThan(0);
   return route.fulfill({json:{candidates:[{content:{parts:[{text:'A traveller discovers a new world.'}]}}]}});
 });
 await page.goto('/');
 await page.getByLabel('Content mode').selectOption('listen');
 await expect(page).toHaveURL(/read-listen/);
 await page.getByLabel('Find a story').fill('A New World');
 await page.getByRole('button',{name:'Find chapters'}).click();
 await page.getByRole('link',{name:/A New World/}).first().click();
 await page.getByRole('link',{name:'Read now',exact:true}).click();
 await expect(page.getByRole('region',{name:'Read and listen controls'})).toBeVisible();
 await page.getByLabel('Narration mode').selectOption('ai');
 await page.getByLabel('Gemini API key').fill('test-session-secret');
 expect(requests).toBe(0);
 await page.getByRole('button',{name:'Prepare this page',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Preparation finished'})).toBeVisible();
 expect(requests).toBe(1);
 await page.getByText(/Page 1 transcript/).click();
 await expect(page.getByLabel('Page narration transcript')).toHaveValue('A traveller discovers a new world.');
 await page.getByRole('button',{name:'Listen to page',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__spoken.length)).toBeGreaterThan(0);
 await expect(page.getByLabel('Reading layout')).toHaveValue('single');
 expect(await page.evaluate(()=>JSON.stringify(localStorage).includes('test-session-secret'))).toBe(false);
 await page.getByRole('button',{name:'Prepare this page',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Preparation finished'})).toBeVisible();
 expect(requests).toBe(1);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.getByLabel('Select chapter').selectOption('chapter-b');
 await expect(page).toHaveURL(/listen=1/);
 await expect(page.getByLabel('Gemini API key')).toHaveValue('');
 await page.getByText(/Page 1 transcript/).click();
 await expect(page.getByLabel('Page narration transcript')).toHaveValue('');
 await page.reload();
 await expect(page.getByRole('region',{name:'Read and listen controls'})).toBeVisible();
 await page.evaluate(()=>localStorage.setItem('soraix-reader-listen','true'));
 await page.getByLabel('Content mode').selectOption('manga');
 await page.goto('/media/30104');
 await page.getByRole('link',{name:'Read now',exact:true}).click();
 await expect(page.getByLabel('Select chapter')).toBeVisible();
 await expect(page.getByRole('button',{name:'Read & Listen',exact:true})).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Read and listen controls'})).toHaveCount(0);
});

test('Read and Listen coming soon gates dropdown and old links', async ({page}) => {
 test.skip(READ_LISTEN_ENABLED, 'Feature is open.');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');
 await page.getByLabel('Content mode').selectOption('listen');
 await expect(page.getByRole('dialog',{name:'Read & Listen is on its way'})).toBeVisible();
 await page.getByRole('button',{name:'Got it'}).click();
 await expect(page).toHaveURL(/\/$/);
 await expect(page.getByLabel('Content mode')).toHaveValue('manga');
 await page.goto('/read-listen');
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page).toHaveURL(/\/$/);
 await page.goto('/read/30104/chapter-a?listen=1');
 await expect(page.getByLabel('Select chapter')).toBeVisible();
 await expect(page.getByRole('region',{name:'Read and listen controls'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Read & Listen',exact:true})).toHaveCount(0);
});
