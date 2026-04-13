import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/Header";
import styles from "./Home.module.css";

type FeatureStatus = "available" | "granted" | "denied" | "unsupported";

export function Home() {
  const navigate = useNavigate();
  const deferredPromptRef = useRef<Event | null>(null);
  const [installable, setInstallable] = useState(false);
  const [notifStatus, setNotifStatus] = useState<FeatureStatus>("unsupported");
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    // Check notification support
    if ("Notification" in window) {
      const perm = Notification.permission;
      setNotifStatus(perm === "granted" ? "granted" : perm === "denied" ? "denied" : "available");
    }

    // Wait for SW
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready.then(() => setSwReady(true));
    }

    // Install prompt
    window.addEventListener(
      "beforeinstallprompt",
      (e: Event) => {
        e.preventDefault();
        deferredPromptRef.current = e;
        setInstallable(true);
      },
      { signal: controller.signal },
    );

    return () => controller.abort();
  }, []);

  const handleInstall = async () => {
    const prompt = deferredPromptRef.current as any;
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    deferredPromptRef.current = null;
    setInstallable(false);
  };

  const handleNotification = async () => {
    try {
      const permission = await Notification.requestPermission();
      setNotifStatus(permission === "granted" ? "granted" : "denied");
      if (permission === "granted") {
        const reg = await navigator.serviceWorker.ready;
        await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            "BN3s0j8LE0zvKDyrKI4ixxT8Wd90kPPfqA6PwtQZ-BNhfjtgfUcWAWrdc1QoXOK0SBFBgvLdtXz32NyP0GNxozY",
        });
      }
    } catch (error) {
      console.error("Push subscription failed:", error);
    }
  };

  const handleShare = () => {
    if ("share" in navigator) {
      void navigator.share({
        title: "notifoo",
        text: "PWA notification demo built with React 19 + VitePlus",
        url: window.location.origin,
      });
    }
  };

  return (
    <>
      <Header title="notifoo" />
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.title}>notifoo</h1>
          <p className={styles.subtitle}>
            A modern PWA built with React 19, VitePlus, and Web Awesome
          </p>
        </section>

        <section className={styles.features}>
          <wa-card className={styles.card}>
            <h3>Install</h3>
            <p>
              Add to your home screen for a native app experience. Works on Android, iOS, and
              desktop.
            </p>
            {installable ? (
              <wa-button variant="default" onClick={() => void handleInstall()}>
                Install App
              </wa-button>
            ) : (
              <p className={styles.status}>
                {window.matchMedia("(display-mode: standalone)").matches
                  ? "Installed"
                  : "Open in browser to install"}
              </p>
            )}
          </wa-card>

          <wa-card className={styles.card}>
            <h3>Notifications</h3>
            <p>Receive push notifications even when the app is closed.</p>
            {notifStatus === "available" && (
              <wa-button variant="default" onClick={() => void handleNotification()}>
                Enable Notifications
              </wa-button>
            )}
            {notifStatus === "granted" && <p className={styles.statusOk}>Enabled</p>}
            {notifStatus === "denied" && <p className={styles.statusWarn}>Blocked by browser</p>}
            {notifStatus === "unsupported" && <p className={styles.status}>Not supported</p>}
          </wa-card>

          <wa-card className={styles.card}>
            <h3>Offline</h3>
            <p>Works without internet. All core assets are cached by the service worker.</p>
            <p className={swReady ? styles.statusOk : styles.status}>
              {swReady ? "Service Worker active" : "Loading..."}
            </p>
          </wa-card>

          {"share" in navigator && (
            <wa-card className={styles.card}>
              <h3>Share</h3>
              <p>Share this app with others using your device's native share sheet.</p>
              <wa-button variant="default" onClick={handleShare}>
                Share
              </wa-button>
            </wa-card>
          )}
        </section>

        <section className={styles.actions}>
          <wa-button variant="primary" onClick={() => navigate("/about")}>
            About This PWA
          </wa-button>
        </section>
      </main>
    </>
  );
}
