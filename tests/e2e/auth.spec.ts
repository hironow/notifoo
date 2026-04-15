import { test, expect } from "@playwright/test";

const API_URL = "http://localhost:3001";

test.describe("OAuth: Redirect Flow (Authorization Code + PKCE)", () => {
  test("should complete redirect-based login and receive a token", async ({ page }) => {
    // given
    await page.goto("/auth");
    await page.locator("main h2").waitFor();

    // verify initially not logged in
    await expect(page.getByText("Not logged in")).toBeVisible();

    // when - click "Login (Redirect)"
    await page.locator('wa-button:has-text("Login (Redirect)")').click();

    // then - should land on consent page with PKCE info
    await expect(page).toHaveURL(/\/api\/auth\/authorize/);
    await expect(page.getByText("Sign in as")).toBeVisible();
    await expect(page.getByText("demo@notifoo.example.com")).toBeVisible();
    await expect(page.getByText("scope: openid profile email")).toBeVisible();
    await expect(page.getByText("PKCE: S256")).toBeVisible();

    // when - click "Allow" on consent page
    await page.getByText("Allow").click();

    // then - should redirect back to /auth with code, exchange with PKCE, and fetch userinfo
    await page.waitForURL(/\/auth/);
    await expect(page.getByText("Demo User")).toBeVisible({ timeout: 10000 });
    // Log should show PKCE exchange and userinfo fetch
    await expect(page.locator("pre")).toContainText("grant_type=authorization_code");
    await expect(page.locator("pre")).toContainText("access_token");
    await expect(page.locator("pre")).toContainText("id_token");
    await expect(page.locator("pre")).toContainText("Fetching userinfo");
    await expect(page.locator("pre")).toContainText("demo@notifoo.example.com");
  });

  test("should verify token via GET /userinfo", async ({ page }) => {
    // given - complete login first
    await page.goto("/auth");
    await page.locator('wa-button:has-text("Login (Redirect)")').click();
    await page.getByText("Allow").click();
    await page.waitForURL(/\/auth/);
    await expect(page.getByText("Demo User")).toBeVisible({ timeout: 10000 });

    // when - click "Verify Token"
    await page.locator('wa-button:has-text("Verify Token")').click();

    // then - log should show verification success via userinfo
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

test.describe("OAuth: Popup Flow (Authorization Code + PKCE)", () => {
  test("should complete popup-based login and receive a token", async ({ page }) => {
    // given
    await page.goto("/auth");
    await page.locator("main h2").waitFor();

    // when - click "Login (Popup)" and handle the popup
    const popupPromise = page.waitForEvent("popup");
    await page.locator('wa-button:has-text("Login (Popup)")').click();
    const popup = await popupPromise;

    // then - popup should show consent page with PKCE info
    await popup.waitForLoadState();
    await expect(popup.getByText("Sign in as")).toBeVisible();
    await expect(popup.getByText("PKCE: S256")).toBeVisible();

    // when - click "Allow" in popup
    await popup.getByText("Allow").click();

    // Wait for popup to navigate to PWA origin and be detected by main page
    await popup.waitForURL(/\/auth\?code=/);

    // then - main page should receive token via PKCE exchange
    await expect(page.getByText("Demo User")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("pre")).toContainText("access_token");
    await expect(page.locator("pre")).toContainText("id_token");
    await expect(page.locator("pre")).toContainText("Fetching userinfo");
  });
});

test.describe("OAuth: API Endpoints (RFC Compliance)", () => {
  test("should return VAPID public key", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/vapid-public-key`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.publicKey).toBeTruthy();
  });

  test("should reject token exchange without grant_type", async ({ request }) => {
    const res = await request.post(`${API_URL}/api/auth/token`, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: "code=invalid-code",
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("unsupported_grant_type");
  });

  test("should reject token exchange with invalid code", async ({ request }) => {
    const res = await request.post(`${API_URL}/api/auth/token`, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: "grant_type=authorization_code&code=invalid&redirect_uri=http://localhost&client_id=notifoo&code_verifier=dummy",
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_grant");
  });

  test("should reject token exchange with wrong client_id", async ({ request }) => {
    const res = await request.post(`${API_URL}/api/auth/token`, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: "grant_type=authorization_code&code=abc&redirect_uri=http://localhost&client_id=wrong&code_verifier=dummy",
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_client");
  });

  test("should reject unauthorized /userinfo request", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/auth/userinfo`);
    expect(res.status()).toBe(401);
  });

  test("should reject invalid token on /userinfo", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/auth/userinfo`, {
      headers: { Authorization: "Bearer invalid-token" },
    });
    expect(res.status()).toBe(401);
  });
});
