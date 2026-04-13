import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import webpush from "web-push";

const app = new Hono();

// VAPID keys from environment variables
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@notifoo.example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// In-memory subscription store (replaced by a database in production)
const subscriptions = new Map<string, webpush.PushSubscription>();

app.use("/*", cors());

// Health check
app.get("/", (c) => c.json({ status: "ok", subscriptions: subscriptions.size }));

// Get VAPID public key (so frontend doesn't need to hardcode it)
app.get("/api/vapid-public-key", (c) => c.json({ publicKey: VAPID_PUBLIC_KEY }));

// Store a push subscription
app.post("/api/subscribe", async (c) => {
  const subscription = await c.req.json<webpush.PushSubscription>();
  if (!subscription?.endpoint) {
    return c.json({ error: "Invalid subscription" }, 400);
  }
  subscriptions.set(subscription.endpoint, subscription);
  return c.json({ ok: true, total: subscriptions.size });
});

// Remove a push subscription
app.delete("/api/subscribe", async (c) => {
  const { endpoint } = await c.req.json<{ endpoint: string }>();
  subscriptions.delete(endpoint);
  return c.json({ ok: true, total: subscriptions.size });
});

// Send a notification to all subscribers
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
        // Remove expired/invalid subscriptions
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
// Dummy OAuth2 endpoints (simulates Firebase Auth / Google Login callback flow)
// =============================================================================

const DUMMY_USER = {
  sub: "demo-user-12345",
  email: "demo@notifoo.example.com",
  name: "Demo User",
  picture: "https://ui-avatars.com/api/?name=Demo+User&background=E1477E&color=fff",
};

// In-memory token store
const tokens = new Map<string, typeof DUMMY_USER>();

function generateCode(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function generateToken(): string {
  return `notifoo_tk_${crypto.randomUUID().replace(/-/g, "")}`;
}

// Temporary auth codes (code -> redirect_uri mapping)
const authCodes = new Map<string, string>();

// GET /api/auth/authorize - Renders a dummy consent page
app.get("/api/auth/authorize", (c) => {
  const redirectUri = c.req.query("redirect_uri") || "/";
  const state = c.req.query("state") || "";
  const mode = c.req.query("mode") || "redirect"; // "redirect" or "popup"

  const code = generateCode();
  authCodes.set(code, redirectUri);

  // Auto-expire code after 5 minutes
  setTimeout(() => authCodes.delete(code), 5 * 60 * 1000);

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", code);
  if (state) callbackUrl.searchParams.set("state", state);

  const html = `<!DOCTYPE html>
<html><head><title>Sign in to notifoo</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
  .card { background: white; border-radius: 12px; padding: 32px; max-width: 360px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .avatar { width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 16px; }
  h2 { margin: 0 0 8px; }
  p { color: #666; font-size: 14px; }
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
  <div>
    <a class="btn" href="${callbackUrl.toString()}">Allow</a>
    <a class="btn btn-cancel" href="${redirectUri}">Cancel</a>
  </div>
  <p class="info">Mode: ${mode} | This is a simulated OAuth consent page</p>
</div>
</body></html>`;

  return c.html(html);
});

// POST /api/auth/token - Exchange authorization code for access token
app.post("/api/auth/token", async (c) => {
  const body = await c.req.json<{ code: string }>();
  if (!body?.code || !authCodes.has(body.code)) {
    return c.json({ error: "invalid_code" }, 400);
  }
  authCodes.delete(body.code);

  const token = generateToken();
  tokens.set(token, DUMMY_USER);

  // Auto-expire token after 1 hour
  setTimeout(() => tokens.delete(token), 60 * 60 * 1000);

  return c.json({
    access_token: token,
    token_type: "Bearer",
    expires_in: 3600,
    user: DUMMY_USER,
  });
});

// GET /api/auth/me - Get current user info (requires Bearer token)
app.get("/api/auth/me", (c) => {
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

const port = parseInt(process.env.PORT || "8080", 10);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`notifoo push server listening on port ${info.port}`);
});
