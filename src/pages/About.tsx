import styles from "./About.module.css";

const techStack = [
  { name: "React 19", url: "https://react.dev", desc: "UI framework" },
  { name: "React Router 7", url: "https://reactrouter.com", desc: "Client-side routing" },
  { name: "VitePlus", url: "https://viteplus.dev", desc: "Build toolchain (Vite 8 + Rolldown)" },
  { name: "Web Awesome", url: "https://webawesome.com", desc: "UI components" },
  {
    name: "Workbox 7",
    url: "https://developer.chrome.com/docs/workbox",
    desc: "Service Worker caching",
  },
  { name: "Playwright", url: "https://playwright.dev", desc: "E2E testing" },
  { name: "OpenTofu", url: "https://opentofu.org", desc: "Infrastructure as Code" },
];

const pwaFeatures = [
  { feature: "Installable", detail: "manifest + icons + maskable" },
  { feature: "Offline", detail: "Workbox precache + NavigationRoute" },
  { feature: "Push Notifications", detail: "VAPID + Service Worker push handler" },
  { feature: "SW Auto-Update", detail: "skipWaiting + clients.claim" },
  { feature: "HTTPS", detail: "Google-managed SSL via sslip.io" },
  { feature: "CDN", detail: "Cloud CDN with CACHE_ALL_STATIC" },
  { feature: "iOS Optimized", detail: "apple-touch-icon + safe-area-inset" },
  { feature: "Rich Install UI", detail: "Screenshots with form_factor" },
];

export function About() {
  return (
    <main className={styles.main}>
      <h2 className={styles.heading}>About notifoo</h2>

      <wa-card className={styles.card}>
        <h3>What is this?</h3>
        <p>
          A production-ready Progressive Web App demonstrating modern PWA capabilities, compliant
          with Chrome Installability Criteria and iOS/Android 2026 specifications. Built from
          scratch with the latest tools available.
        </p>
      </wa-card>

      <wa-card className={styles.card}>
        <h3>Tech Stack</h3>
        <ul className={styles.list}>
          {techStack.map((t) => (
            <li key={t.name}>
              <a href={t.url} target="_blank" rel="noopener noreferrer">
                {t.name}
              </a>
              <span className={styles.detail}> — {t.desc}</span>
            </li>
          ))}
        </ul>
      </wa-card>

      <wa-card className={styles.card}>
        <h3>PWA Features</h3>
        <ul className={styles.list}>
          {pwaFeatures.map((f) => (
            <li key={f.feature}>
              <strong>{f.feature}</strong>
              <span className={styles.detail}> — {f.detail}</span>
            </li>
          ))}
        </ul>
      </wa-card>

      <wa-card className={styles.card}>
        <h3>Infrastructure</h3>
        <p>
          Hosted on Google Cloud: GCS bucket + Global Application Load Balancer + Cloud CDN. All
          infrastructure defined in OpenTofu. HTTPS via sslip.io + Google-managed SSL certificate.
          CI with GitHub Actions.
        </p>
      </wa-card>
    </main>
  );
}
