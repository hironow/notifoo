importScripts("https://storage.googleapis.com/workbox-cdn/releases/7.4.0/workbox-sw.js");

// 既存のイベントリスナー
self.addEventListener("widgetinstall", (event) => {
  event.waitUntil(updateWidget(event));
});

self.addEventListener("widgetresume", (event) => {
  event.waitUntil(updateWidget(event));
});

self.addEventListener("widgetclick", (event) => {
  if (event.action == "updateName") {
    event.waitUntil(updateName(event));
  }
});

self.addEventListener("widgetuninstall", (_event) => {});

// Push通知を受信した際に発火するイベントリスナーを追加
self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || "新しい通知があります。",
    icon: "/path/to/icon.png", // 必要に応じてアイコンのパスを指定
    image: data.image || "", // 通知内で表示する画像
    tag: "push-notification",
  };

  // 通知を表示
  event.waitUntil(self.registration.showNotification(data.title || "通知タイトル", options));
});

// 新しい SW がインストールされたら即座にアクティベートする
self.addEventListener("install", (event) => {
  console.log("Service Worker installing.");
  event.waitUntil(self.skipWaiting());
});

// アクティベート時に全クライアントを新しい SW で制御する
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating.");
  event.waitUntil(self.clients.claim());
});

const updateWidget = async (event) => {
  const widgetDefinition = event.widget.definition;

  const payload = {
    template: JSON.stringify(await (await fetch(widgetDefinition.msAcTemplate)).json()),
    data: JSON.stringify(await (await fetch(widgetDefinition.data)).json()),
  };

  await self.widgets.updateByInstanceId(event.instanceId, payload);
};

const updateName = async (event) => {
  const name = event.data.json().name;
  const widgetDefinition = event.widget.definition;

  const payload = {
    template: JSON.stringify(await (await fetch(widgetDefinition.msAcTemplate)).json()),
    data: JSON.stringify({ name }),
  };

  await self.widgets.updateByInstanceId(event.instanceId, payload);
};

// Workboxを使ってキャッシュ戦略を適用
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

// SPA ナビゲーションフォールバック: 未キャッシュのルートでもプリキャッシュ済み index.html を返す
const { createHandlerBoundToURL } = workbox.precaching;
const { NavigationRoute, registerRoute } = workbox.routing;
const navigationHandler = createHandlerBoundToURL("/index.html");
registerRoute(new NavigationRoute(navigationHandler));
