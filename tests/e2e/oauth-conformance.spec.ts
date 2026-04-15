/**
 * OAuth 2.0 / OIDC Conformance Tests using oauth4webapi (panva)
 *
 * Validates that the dummy OAuth server follows:
 * - RFC 8414: OAuth 2.0 Authorization Server Metadata (Discovery)
 * - RFC 6749: OAuth 2.0 Authorization Framework
 * - RFC 7636: Proof Key for Code Exchange (PKCE)
 * - OIDC Core 1.0: ID Token, UserInfo Endpoint
 */
import { test, expect } from "@playwright/test";
import * as oauth from "oauth4webapi";

const ISSUER_URL = "http://localhost:3001";
const CLIENT_ID = "notifoo";
const REDIRECT_URI = "http://localhost:4173/auth";

// Helper: fetch discovery document and create AuthorizationServer
async function getAuthorizationServer(): Promise<oauth.AuthorizationServer> {
  const url = new URL("/.well-known/openid-configuration", ISSUER_URL);
  const res = await fetch(url.href);
  return res.json();
}

test.describe("OIDC Discovery (RFC 8414)", () => {
  test("should serve /.well-known/openid-configuration", async () => {
    const as = await getAuthorizationServer();

    expect(as.issuer).toBe(ISSUER_URL);
    expect(as.authorization_endpoint).toBeTruthy();
    expect(as.token_endpoint).toBeTruthy();
    expect(as.userinfo_endpoint).toBeTruthy();
  });

  test("should declare code as supported response_type", async () => {
    const as = await getAuthorizationServer();
    expect(as.response_types_supported).toContain("code");
  });

  test("should declare authorization_code as supported grant_type", async () => {
    const as = await getAuthorizationServer();
    expect(as.grant_types_supported).toContain("authorization_code");
  });

  test("should declare S256 as supported code_challenge_method", async () => {
    const as = await getAuthorizationServer();
    expect(as.code_challenge_methods_supported).toContain("S256");
  });

  test("should declare openid, profile, email in scopes_supported", async () => {
    const as = await getAuthorizationServer();
    expect(as.scopes_supported).toContain("openid");
    expect(as.scopes_supported).toContain("profile");
    expect(as.scopes_supported).toContain("email");
  });

  test("should declare none in token_endpoint_auth_methods_supported (public client)", async () => {
    const as = await getAuthorizationServer();
    expect(as.token_endpoint_auth_methods_supported).toContain("none");
  });
});

test.describe("Authorization Endpoint (RFC 6749 Section 4.1.1)", () => {
  test("should reject missing response_type", async ({ request }) => {
    const res = await request.get(
      `${ISSUER_URL}/api/auth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}`,
    );
    const body = await res.json();
    expect(body.error).toBe("unsupported_response_type");
  });

  test("should reject invalid response_type", async ({ request }) => {
    const res = await request.get(
      `${ISSUER_URL}/api/auth/authorize?response_type=token&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}`,
    );
    const body = await res.json();
    expect(body.error).toBe("unsupported_response_type");
  });

  test("should reject unknown client_id", async ({ request }) => {
    const res = await request.get(
      `${ISSUER_URL}/api/auth/authorize?response_type=code&client_id=unknown&redirect_uri=${REDIRECT_URI}`,
    );
    const body = await res.json();
    expect(body.error).toBe("invalid_client");
  });

  test("should require PKCE with S256", async ({ request }) => {
    const res = await request.get(
      `${ISSUER_URL}/api/auth/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}`,
    );
    const body = await res.json();
    expect(body.error).toBe("invalid_request");
    expect(body.error_description).toContain("PKCE");
  });

  test("should return consent HTML when all params valid", async ({ request }) => {
    const codeVerifier = oauth.generateRandomCodeVerifier();
    const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "openid profile email",
      state: "test-state",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const res = await request.get(`${ISSUER_URL}/api/auth/authorize?${params}`);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain("Sign in as");
    expect(html).toContain("PKCE: S256");
  });
});

test.describe("Token Endpoint (RFC 6749 Section 4.1.3 + RFC 7636)", () => {
  // Helper: get a valid auth code by simulating the authorize flow
  async function getAuthCode(codeVerifier: string): Promise<string> {
    const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "openid profile email",
      state: "test",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const res = await fetch(`${ISSUER_URL}/api/auth/authorize?${params}`);
    const html = await res.text();

    // Extract the code from the Allow link
    const match = html.match(/href="[^"]*[?&]code=([^&"]+)/);
    if (!match) throw new Error("Could not extract auth code from consent page");
    return match[1];
  }

  test("should exchange code with valid PKCE verifier", async () => {
    const codeVerifier = oauth.generateRandomCodeVerifier();
    const code = await getAuthCode(codeVerifier);

    const res = await fetch(`${ISSUER_URL}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: codeVerifier,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    // RFC 6749 Section 5.1: required fields
    expect(body.access_token).toBeTruthy();
    expect(body.token_type).toBe("Bearer");
    expect(typeof body.expires_in).toBe("number");

    // OIDC Core: id_token
    expect(body.id_token).toBeTruthy();
    // id_token should be a JWT (3 dot-separated parts)
    expect(body.id_token.split(".")).toHaveLength(3);

    // scope
    expect(body.scope).toBe("openid profile email");

    // Should NOT include user info directly (OIDC: use /userinfo instead)
    expect(body.user).toBeUndefined();
  });

  test("should reject wrong PKCE verifier", async () => {
    const codeVerifier = oauth.generateRandomCodeVerifier();
    const code = await getAuthCode(codeVerifier);

    const res = await fetch(`${ISSUER_URL}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: "wrong-verifier-that-does-not-match",
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_grant");
    expect(body.error_description).toContain("PKCE");
  });

  test("should reject redirect_uri mismatch", async () => {
    const codeVerifier = oauth.generateRandomCodeVerifier();
    const code = await getAuthCode(codeVerifier);

    const res = await fetch(`${ISSUER_URL}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: "http://evil.example.com/callback",
        client_id: CLIENT_ID,
        code_verifier: codeVerifier,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_grant");
    expect(body.error_description).toContain("redirect_uri");
  });

  test("should reject code reuse (single-use enforcement)", async () => {
    const codeVerifier = oauth.generateRandomCodeVerifier();
    const code = await getAuthCode(codeVerifier);

    // First exchange — should succeed
    const res1 = await fetch(`${ISSUER_URL}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: codeVerifier,
      }),
    });
    expect(res1.status).toBe(200);

    // Second exchange with same code — should fail
    const res2 = await fetch(`${ISSUER_URL}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: codeVerifier,
      }),
    });
    expect(res2.status).toBe(400);
    const body = await res2.json();
    expect(body.error).toBe("invalid_grant");
  });

  test("should reject unsupported grant_type", async () => {
    const res = await fetch(`${ISSUER_URL}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: CLIENT_ID,
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("unsupported_grant_type");
  });
});

test.describe("UserInfo Endpoint (OIDC Core Section 5.3)", () => {
  async function getAccessToken(): Promise<string> {
    const codeVerifier = oauth.generateRandomCodeVerifier();
    const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "openid profile email",
      state: "test",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authRes = await fetch(`${ISSUER_URL}/api/auth/authorize?${params}`);
    const html = await authRes.text();
    const match = html.match(/href="[^"]*[?&]code=([^&"]+)/);
    if (!match) throw new Error("Could not extract auth code");
    const code = match[1];

    const tokenRes = await fetch(`${ISSUER_URL}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: codeVerifier,
      }),
    });
    const body = await tokenRes.json();
    return body.access_token;
  }

  test("should return user claims with valid token", async () => {
    const token = await getAccessToken();

    const res = await fetch(`${ISSUER_URL}/api/auth/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);

    const user = await res.json();
    // OIDC Core Section 5.3.2: sub is REQUIRED
    expect(user.sub).toBeTruthy();
    // Profile scope claims
    expect(user.name).toBeTruthy();
    expect(user.picture).toBeTruthy();
    // Email scope claims
    expect(user.email).toBeTruthy();
  });

  test("should reject request without Authorization header", async () => {
    const res = await fetch(`${ISSUER_URL}/api/auth/userinfo`);
    expect(res.status).toBe(401);
  });

  test("should reject request with invalid token", async () => {
    const res = await fetch(`${ISSUER_URL}/api/auth/userinfo`, {
      headers: { Authorization: "Bearer expired-or-invalid-token" },
    });
    expect(res.status).toBe(401);
  });
});

test.describe("ID Token (OIDC Core Section 2)", () => {
  test("should contain required JWT claims", async () => {
    const codeVerifier = oauth.generateRandomCodeVerifier();
    const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "openid profile email",
      state: "test",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authRes = await fetch(`${ISSUER_URL}/api/auth/authorize?${params}`);
    const html = await authRes.text();
    const match = html.match(/href="[^"]*[?&]code=([^&"]+)/);
    if (!match) throw new Error("Could not extract auth code");

    const tokenRes = await fetch(`${ISSUER_URL}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: match[1],
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: codeVerifier,
      }),
    });
    const body = await tokenRes.json();

    // Decode JWT payload (middle part)
    const [headerB64, payloadB64, signature] = body.id_token.split(".");
    expect(headerB64).toBeTruthy();
    expect(payloadB64).toBeTruthy();
    expect(signature).toBeTruthy();

    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
    expect(header.alg).toBe("HS256");
    expect(header.typ).toBe("JWT");

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    // OIDC Core Section 2: required claims
    expect(payload.iss).toBe(ISSUER_URL);
    expect(payload.sub).toBeTruthy();
    expect(payload.aud).toBe(CLIENT_ID);
    expect(typeof payload.exp).toBe("number");
    expect(typeof payload.iat).toBe("number");
    expect(payload.exp).toBeGreaterThan(payload.iat);

    // Profile + email claims
    expect(payload.email).toBeTruthy();
    expect(payload.name).toBeTruthy();
  });
});
