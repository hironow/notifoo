import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createHash, createHmac, randomUUID } from "node:crypto";
import webpush from "web-push";

const app = new Hono();

// =============================================================================
// Push Notification (VAPID / web-push)
// =============================================================================

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@notifoo.example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const subscriptions = new Map<string, webpush.PushSubscription>();

app.use("/*", cors());

app.get("/", (c) => c.json({ status: "ok", subscriptions: subscriptions.size }));

app.get("/api/vapid-public-key", (c) => c.json({ publicKey: VAPID_PUBLIC_KEY }));

app.post("/api/subscribe", async (c) => {
  const subscription = await c.req.json<webpush.PushSubscription>();
  if (!subscription?.endpoint) {
    return c.json({ error: "Invalid subscription" }, 400);
  }
  subscriptions.set(subscription.endpoint, subscription);
  return c.json({ ok: true, total: subscriptions.size });
});

app.delete("/api/subscribe", async (c) => {
  const { endpoint } = await c.req.json<{ endpoint: string }>();
  subscriptions.delete(endpoint);
  return c.json({ ok: true, total: subscriptions.size });
});

app.post("/api/notify", async (c) => {
  const { title, body, image } = await c.req.json<{
    title?: string;
    body?: string;
    image?: string;
  }>();

  const payload = JSON.stringify({
    title: title || "notifoo",
    body: body || "You have a new notification!",
    image: image || "",
  });

  const results = await Promise.allSettled(
    Array.from(subscriptions.values()).map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload);
        return { endpoint: sub.endpoint, status: "sent" };
      } catch (err: unknown) {
        const error = err as { statusCode?: number };
        if (error.statusCode === 410 || error.statusCode === 404) {
          subscriptions.delete(sub.endpoint);
        }
        return { endpoint: sub.endpoint, status: "failed", code: error.statusCode };
      }
    }),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return c.json({ sent, total: subscriptions.size });
});

// =============================================================================
// OAuth 2.0 Authorization Code Flow + PKCE (RFC 6749, RFC 7636, OIDC Core)
// =============================================================================

const CLIENT_ID = process.env.OAUTH_CLIENT_ID || "notifoo";
const JWT_SECRET = process.env.JWT_SECRET || process.env.VAPID_PRIVATE_KEY!;

const DUMMY_USER = {
  sub: "demo-user-12345",
  email: "demo@notifoo.example.com",
  name: "Demo User",
  picture: "https://ui-avatars.com/api/?name=Demo+User&background=E1477E&color=fff",
};

// In-memory stores
const tokens = new Map<string, typeof DUMMY_USER>();

interface AuthCodeEntry {
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  clientId: string;
}
const authCodes = new Map<string, AuthCodeEntry>();

function generateCode(): string {
  return randomUUID().replace(/-/g, "");
}

function generateToken(): string {
  return `notifoo_tk_${randomUUID().replace(/-/g, "")}`;
}

function createIdToken(user: typeof DUMMY_USER, clientId: string, issuer: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuer,
    sub: user.sub,
    aud: clientId,
    exp: now + 3600,
    iat: now,
    email: user.email,
    name: user.name,
    picture: user.picture,
  };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");
  return `${headerB64}.${payloadB64}.${signature}`;
}

function verifyPkce(codeVerifier: string, codeChallenge: string, method: string): boolean {
  if (method !== "S256") return false;
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  return computed === codeChallenge;
}

// OIDC Discovery (RFC 8414)
app.get("/.well-known/openid-configuration", (c) => {
  const origin = new URL(c.req.url).origin;
  return c.json({
    issuer: origin,
    authorization_endpoint: `${origin}/api/auth/authorize`,
    token_endpoint: `${origin}/api/auth/token`,
    userinfo_endpoint: `${origin}/api/auth/userinfo`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["HS256"],
    scopes_supported: ["openid", "profile", "email"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
  });
});

// GET /api/auth/authorize — Authorization Endpoint (RFC 6749 Section 4.1.1)
app.get("/api/auth/authorize", (c) => {
  const responseType = c.req.query("response_type");
  const clientId = c.req.query("client_id");
  const redirectUri = c.req.query("redirect_uri") || "/";
  const scope = c.req.query("scope") || "";
  const state = c.req.query("state") || "";
  const codeChallenge = c.req.query("code_challenge") || "";
  const codeChallengeMethod = c.req.query("code_challenge_method") || "";
  const mode = c.req.query("mode") || "redirect";

  // Validate required parameters
  if (responseType !== "code") {
    return c.json(
      {
        error: "unsupported_response_type",
        error_description: "Only response_type=code is supported",
      },
      400,
    );
  }
  if (clientId !== CLIENT_ID) {
    return c.json(
      { error: "invalid_client", error_description: `Unknown client_id: ${clientId}` },
      400,
    );
  }
  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return c.json(
      {
        error: "invalid_request",
        error_description: "PKCE with code_challenge_method=S256 is required",
      },
      400,
    );
  }

  const code = generateCode();
  authCodes.set(code, { redirectUri, codeChallenge, codeChallengeMethod, clientId });
  setTimeout(() => authCodes.delete(code), 5 * 60 * 1000);

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", code);
  if (state) callbackUrl.searchParams.set("state", state);

  const scopeDisplay = scope || "openid profile email";

  const html = `<!DOCTYPE html>
<html><head><title>Sign in to notifoo</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
  .card { background: white; border-radius: 12px; padding: 32px; max-width: 360px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .avatar { width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 16px; }
  h2 { margin: 0 0 8px; }
  p { color: #666; font-size: 14px; }
  .scope { background: #f0f0f0; border-radius: 6px; padding: 8px; font-family: monospace; font-size: 12px; color: #333; margin: 8px 0; }
  .btn { display: inline-block; padding: 12px 32px; background: #E1477E; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; text-decoration: none; margin: 8px; }
  .btn:hover { background: #c73a6a; }
  .btn-cancel { background: #888; }
  .btn-cancel:hover { background: #666; }
  .info { font-size: 12px; color: #999; margin-top: 16px; }
</style></head><body>
<div class="card">
  <img class="avatar" src="${DUMMY_USER.picture}" alt="avatar">
  <h2>Sign in as</h2>
  <p><strong>${DUMMY_USER.name}</strong><br>${DUMMY_USER.email}</p>
  <p>notifoo wants to access your account</p>
  <div class="scope">scope: ${scopeDisplay}</div>
  <div>
    <a class="btn" href="${callbackUrl.toString()}">Allow</a>
    <a class="btn btn-cancel" href="${redirectUri}">Cancel</a>
  </div>
  <p class="info">Mode: ${mode} | PKCE: S256 | This is a simulated OAuth consent page</p>
</div>
</body></html>`;

  return c.html(html);
});

// POST /api/auth/token — Token Endpoint (RFC 6749 Section 4.1.3, RFC 7636 Section 4.6)
app.post("/api/auth/token", async (c) => {
  const contentType = c.req.header("Content-Type") || "";

  let grantType: string;
  let code: string;
  let redirectUri: string;
  let clientId: string;
  let codeVerifier: string;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = await c.req.parseBody();
    grantType = String(body.grant_type || "");
    code = String(body.code || "");
    redirectUri = String(body.redirect_uri || "");
    clientId = String(body.client_id || "");
    codeVerifier = String(body.code_verifier || "");
  } else if (contentType.includes("application/json")) {
    const body = await c.req.json<Record<string, string>>();
    grantType = body.grant_type || "";
    code = body.code || "";
    redirectUri = body.redirect_uri || "";
    clientId = body.client_id || "";
    codeVerifier = body.code_verifier || "";
  } else {
    return c.json({ error: "invalid_request", error_description: "Unsupported Content-Type" }, 400);
  }

  // Validate grant_type
  if (grantType !== "authorization_code") {
    return c.json(
      {
        error: "unsupported_grant_type",
        error_description: "Only grant_type=authorization_code is supported",
      },
      400,
    );
  }

  // Validate client_id
  if (clientId !== CLIENT_ID) {
    return c.json({ error: "invalid_client", error_description: "Unknown client_id" }, 400);
  }

  // Validate authorization code
  const entry = authCodes.get(code);
  if (!entry) {
    return c.json(
      { error: "invalid_grant", error_description: "Invalid or expired authorization code" },
      400,
    );
  }

  // Validate redirect_uri matches the one used in authorize
  if (entry.redirectUri !== redirectUri) {
    return c.json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
  }

  // Validate client_id matches the one used in authorize
  if (entry.clientId !== clientId) {
    return c.json({ error: "invalid_client", error_description: "client_id mismatch" }, 400);
  }

  // Validate PKCE code_verifier (RFC 7636 Section 4.6)
  if (!verifyPkce(codeVerifier, entry.codeChallenge, entry.codeChallengeMethod)) {
    return c.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
  }

  // Code is single-use
  authCodes.delete(code);

  const token = generateToken();
  tokens.set(token, DUMMY_USER);
  setTimeout(() => tokens.delete(token), 60 * 60 * 1000);

  const origin = new URL(c.req.url).origin;
  const idToken = createIdToken(DUMMY_USER, clientId, origin);

  return c.json({
    access_token: token,
    token_type: "Bearer",
    expires_in: 3600,
    id_token: idToken,
    scope: "openid profile email",
  });
});

// GET /api/auth/userinfo — UserInfo Endpoint (OIDC Core Section 5.3)
app.get("/api/auth/userinfo", (c) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const token = auth.slice(7);
  const user = tokens.get(token);
  if (!user) {
    return c.json({ error: "invalid_token" }, 401);
  }
  return c.json(user);
});

// =============================================================================
// Server
// =============================================================================

const port = parseInt(process.env.PORT || "8080", 10);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`notifoo push server listening on port ${info.port}`);
});
