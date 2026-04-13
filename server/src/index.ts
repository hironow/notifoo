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

const port = parseInt(process.env.PORT || "8080", 10);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`notifoo push server listening on port ${info.port}`);
});
