import { test, expect } from "@playwright/test";
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
