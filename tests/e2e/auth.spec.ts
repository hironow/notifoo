import { test, expect } from "@playwright/test";

const API_URL = "http://localhost:3001";

test.describe("OAuth: Redirect Flow", () => {
  test("should complete redirect-based login and receive a token", async ({ page }) => {
    // given
    await page.goto("/auth");
    await page.locator("main h2").waitFor();

    // verify initially not logged in
    await expect(page.getByText("Not logged in")).toBeVisible();

    // when - click "Login (Redirect)"
    await page.locator('wa-button:has-text("Login (Redirect)")').click();

    // then - should land on consent page (served by push server)
    await expect(page).toHaveURL(/\/api\/auth\/authorize/);
    await expect(page.getByText("Sign in as")).toBeVisible();
    await expect(page.getByText("demo@notifoo.example.com")).toBeVisible();

    // when - click "Allow" on consent page
    await page.getByText("Allow").click();

    // then - should redirect back to /auth with code, and exchange for token
    await page.waitForURL(/\/auth/);
    // Wait for token exchange to complete
    await expect(page.getByText("Demo User")).toBeVisible({ timeout: 10000 });
    // Log should show the exchange
    await expect(page.locator("pre")).toContainText("Token received");
    await expect(page.locator("pre")).toContainText("demo@notifoo.example.com");
  });

  test("should verify token via GET /me", async ({ page }) => {
    // given - complete login first
    await page.goto("/auth");
    await page.locator('wa-button:has-text("Login (Redirect)")').click();
    await page.getByText("Allow").click();
    await page.waitForURL(/\/auth/);
    await expect(page.getByText("Demo User")).toBeVisible({ timeout: 10000 });

    // when - click "Verify Token"
    await page.locator('wa-button:has-text("Verify Token")').click();

    // then - log should show verification success
    await expect(page.locator("pre")).toContainText("Verified: Demo User");
  });

  test("should logout and clear session", async ({ page }) => {
    // given - complete login first
    await page.goto("/auth");
    await page.locator('wa-button:has-text("Login (Redirect)")').click();
    await page.getByText("Allow").click();
    await page.waitForURL(/\/auth/);
    await expect(page.getByText("Demo User")).toBeVisible({ timeout: 10000 });

    // when - click "Logout"
    await page.locator('wa-button:has-text("Logout")').click();

    // then - should return to logged-out state
    await expect(page.getByText("Not logged in")).toBeVisible();
    await expect(page.locator("pre")).toContainText("Logged out");
  });

  test("should handle Cancel on consent page", async ({ page }) => {
    // given
    await page.goto("/auth");

    // when - click login, then cancel on consent page
    await page.locator('wa-button:has-text("Login (Redirect)")').click();
    await expect(page).toHaveURL(/\/api\/auth\/authorize/);
    await page.getByText("Cancel").click();

    // then - should redirect back to /auth without code (no login)
    await page.waitForURL(/\/auth/);
    await expect(page.getByText("Not logged in")).toBeVisible();
  });
});

test.describe("OAuth: Popup Flow", () => {
  test("should complete popup-based login and receive a token", async ({ page }) => {
    // given
    await page.goto("/auth");
    await page.locator("main h2").waitFor();

    // when - click "Login (Popup)" and handle the popup
    const popupPromise = page.waitForEvent("popup");
    await page.locator('wa-button:has-text("Login (Popup)")').click();
    const popup = await popupPromise;

    // then - popup should show consent page (on push server origin)
    await popup.waitForLoadState();
    await expect(popup.getByText("Sign in as")).toBeVisible();

    // when - click "Allow" in popup
    // This redirects to PWA origin /auth?code=xxx, which the main page polls
    await popup.getByText("Allow").click();

    // Wait for popup to navigate to PWA origin and be detected by main page
    await popup.waitForURL(/\/auth\?code=/);

    // then - main page should eventually receive the token via polling
    await expect(page.getByText("Demo User")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("pre")).toContainText("Token received");
  });
});

test.describe("OAuth: API Endpoints", () => {
  test("should return VAPID public key", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/vapid-public-key`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.publicKey).toBeTruthy();
  });

  test("should reject invalid auth code", async ({ request }) => {
    const res = await request.post(`${API_URL}/api/auth/token`, {
      data: { code: "invalid-code" },
    });
    expect(res.status()).toBe(400);
  });

  test("should reject unauthorized /me request", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/auth/me`);
    expect(res.status()).toBe(401);
  });

  test("should reject invalid token on /me", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: "Bearer invalid-token" },
    });
    expect(res.status()).toBe(401);
  });
});
