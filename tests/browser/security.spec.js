import { test, expect } from "@playwright/test";

test("production CSP blocks injected scripts while app navigation loads", async ({ page }) => {
  const response = await page.goto("/");
  const csp = response.headers()["content-security-policy"];
  test.skip(!csp, "Run against the production Node server to enforce production headers.");
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("script-src 'self'");
  await expect(page.locator("#root")).not.toBeEmpty();
  await page.evaluate(() => {
    window.cspViolations = [];
    document.addEventListener("securitypolicyviolation", e => window.cspViolations.push(e.effectiveDirective));
    const script = document.createElement("script");
    script.textContent = "window.injectedScriptRan = true";
    document.head.append(script);
    const button = document.createElement("button");
    button.setAttribute("onclick", "window.injectedHandlerRan = true");
    document.body.append(button);
    button.click();
    button.remove();
  });
  await expect.poll(() => page.evaluate(() => window.cspViolations)).toContain("script-src-elem");
  await expect.poll(() => page.evaluate(() => window.cspViolations)).toContain("script-src-attr");
  expect(await page.evaluate(() => !!window.injectedScriptRan || !!window.injectedHandlerRan)).toBe(false);
});
