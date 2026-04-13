import { test, expect } from "@playwright/test";

test.describe("PWA: Service Worker", () => {
  test("should register and activate a service worker", async ({ page }) => {
    // given
    await page.goto("/");

    // when - wait for SW to register and become active
    const swState = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const sw = registration.active;
      if (!sw) return null;

      // If already activated, return immediately
      if (sw.state === "activated") return sw.state;

      // Otherwise wait for the statechange event
      return new Promise<string>((resolve) => {
        sw.addEventListener("statechange", () => {
          if (sw.state === "activated") resolve(sw.state);
        });
      });
    });

    // then
    expect(swState).toBe("activated");
  });

  test("should precache application assets", async ({ page }) => {
    // given
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);

    // when - check that key assets are cached
    const cacheNames = await page.evaluate(async () => {
      return await caches.keys();
    });

    // then - at least one workbox precache should exist
    expect(cacheNames.length).toBeGreaterThan(0);
    expect(cacheNames.some((name) => name.includes("precache"))).toBe(true);
  });
});

test.describe("PWA: Offline", () => {
  test("should serve the app shell when offline", async ({ context, page }) => {
    // given - load the page first to populate the cache
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(2000);

    // when - go offline and reload
    await context.setOffline(true);
    await page.reload();

    // then - the React app shell should still render
    const root = page.locator("#root");
    await expect(root).toBeAttached();
    // Verify actual content rendered (not just empty div)
    await expect(root).not.toBeEmpty();
  });

  test("should serve app shell for unknown routes when offline", async ({ context, page }) => {
    // given - load the page first to populate the cache
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(2000);

    // when - go offline and navigate to an uncached route
    await context.setOffline(true);
    await page.goto("/non-existent-page");

    // then - the app shell (index.html) should still render via navigation fallback
    const root = page.locator("#root");
    await expect(root).toBeAttached();
  });
});

test.describe("PWA: Web App Manifest", () => {
  const fetchManifest = async (page: import("@playwright/test").Page) => {
    return page.evaluate(async () => {
      const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (!link) return null;
      const response = await fetch(link.href);
      return await response.json();
    });
  };

  test("should have name and short_name", async ({ page }) => {
    await page.goto("/");
    const manifest = await fetchManifest(page);
    expect(manifest).not.toBeNull();
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
  });

  test("should have valid start_url and display mode", async ({ page }) => {
    await page.goto("/");
    const manifest = await fetchManifest(page);
    expect(manifest).not.toBeNull();
    expect(manifest.start_url).toBeDefined();
    const validDisplayModes = ["fullscreen", "standalone", "minimal-ui", "window-controls-overlay"];
    expect(validDisplayModes).toContain(manifest.display);
  });

  test("should have 192px and 512px icons (Lighthouse requirement)", async ({ page }) => {
    await page.goto("/");
    const manifest = await fetchManifest(page);
    expect(manifest).not.toBeNull();
    expect(manifest.icons).toBeDefined();
    const iconSizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(iconSizes).toContain("192x192");
    expect(iconSizes).toContain("512x512");
  });

  test("should have a maskable icon for adaptive icon support", async ({ page }) => {
    await page.goto("/");
    const manifest = await fetchManifest(page);
    expect(manifest).not.toBeNull();
    const hasMaskable = manifest.icons.some((icon: { purpose?: string }) =>
      icon.purpose?.includes("maskable"),
    );
    expect(hasMaskable).toBe(true);
  });

  test("should not prefer related applications over PWA", async ({ page }) => {
    await page.goto("/");
    const manifest = await fetchManifest(page);
    expect(manifest).not.toBeNull();
    expect(manifest.prefer_related_applications).not.toBe(true);
  });

  test("should have theme-color meta tags for light and dark modes", async ({ page }) => {
    await page.goto("/");
    const themeColors = await page.evaluate(() => {
      const metas = document.querySelectorAll('meta[name="theme-color"]');
      return Array.from(metas).map((meta) => ({
        content: meta.getAttribute("content"),
        media: meta.getAttribute("media"),
      }));
    });
    expect(themeColors.length).toBeGreaterThanOrEqual(2);
    expect(themeColors.some((tc) => tc.media?.includes("dark"))).toBe(true);
    expect(themeColors.some((tc) => tc.media?.includes("light"))).toBe(true);
  });
});

test.describe("PWA: Navigation", () => {
  test("should navigate from home to about and back", async ({ page }) => {
    // given
    await page.goto("/");

    // when - click "Navigate to About"
    await page.getByText("Welcome!").waitFor();
    const aboutButton = page.locator('wa-button[variant="primary"]');
    await aboutButton.click();

    // then - about page should render
    await page.getByText("About Page").waitFor();
    await expect(page.getByText("Did you know?")).toBeVisible();

    // when - click "Back"
    const backButton = page.locator("header wa-button");
    await backButton.click();

    // then - should be back on home
    await page.getByText("Welcome!").waitFor();
  });
});
