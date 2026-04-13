import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/Header";
import styles from "./Home.module.css";

export function Home() {
  const navigate = useNavigate();
  const deferredPromptRef = useRef<Event | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    // Service Worker は index.html で登録済み。ここでは ready を待って利用する
    if (!("serviceWorker" in navigator && "PushManager" in window)) return;

    const controller = new AbortController();

    const setupPwa = async () => {
      try {
        await navigator.serviceWorker.ready;

        window.addEventListener(
          "beforeinstallprompt",
          (e: Event) => {
            e.preventDefault();
            deferredPromptRef.current = e;
            setShowInstall(true);
          },
          { signal: controller.signal },
        );

        if (Notification.permission !== "granted") {
          setShowNotifications(true);
        }
      } catch (error) {
        console.error("Service Worker setup failed:", error);
      }
    };

    void setupPwa();

    return () => controller.abort();
  }, []);

  const handleInstall = async () => {
    const prompt = deferredPromptRef.current as any;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    console.log(`Install outcome: ${outcome}`);
    deferredPromptRef.current = null;
    setShowInstall(false);
  };

  const handleNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const registration = await navigator.serviceWorker.ready;
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            "BN3s0j8LE0zvKDyrKI4ixxT8Wd90kPPfqA6PwtQZ-BNhfjtgfUcWAWrdc1QoXOK0SBFBgvLdtXz32NyP0GNxozY",
        });
        setShowNotifications(false);
      }
    } catch (error) {
      console.error("Push notification subscription failed:", error);
    }
  };

  const handleShare = () => {
    if ("share" in navigator) {
      void navigator.share({
        title: "notifoo",
        text: "Check out notifoo!",
        url: window.location.origin,
      });
    }
  };

  return (
    <>
      <Header title="notifoo" />
      <main className={styles.main}>
        <div className={styles.welcomeBar}>
          <wa-card id="welcomeCard" className={styles.card}>
            <div slot="header">
              <h2>Welcome!</h2>
            </div>
            <p>
              For more information on the PWABuilder pwa-starter, check out the{" "}
              <a href="https://docs.pwabuilder.com/#/starter/quick-start">documentation</a>.
            </p>
            <p>
              Welcome to the <a href="https://pwabuilder.com">PWABuilder</a> pwa-starter! Be sure to
              head back to <a href="https://pwabuilder.com">PWABuilder</a> when you are ready to
              ship this PWA to the Microsoft Store, Google Play and the Apple App Store!
            </p>
            {"share" in navigator && (
              <wa-button slot="footer" variant="default" onClick={handleShare}>
                Share this Starter!
              </wa-button>
            )}
            {showInstall && (
              <wa-button
                className={styles.actionButton}
                variant="default"
                onClick={() => void handleInstall()}
              >
                Install PWA
              </wa-button>
            )}
            {showNotifications && (
              <wa-button
                className={styles.actionButton}
                variant="default"
                onClick={() => void handleNotificationPermission()}
              >
                Allow Notifications
              </wa-button>
            )}
          </wa-card>

          <wa-card id="infoCard" className={styles.card}>
            <h2>Technology Used</h2>
            <ul>
              <li>
                <a href="https://react.dev">React</a>
              </li>
              <li>
                <a href="https://webawesome.com/">Web Awesome</a>
              </li>
              <li>
                <a href="https://reactrouter.com/">React Router</a>
              </li>
            </ul>
          </wa-card>

          <wa-button variant="primary" onClick={() => navigate("/about")}>
            Navigate to About
          </wa-button>
        </div>
      </main>
    </>
  );
}
