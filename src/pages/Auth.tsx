import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Header } from "../components/Header";
import styles from "./Auth.module.css";

interface UserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

interface AuthState {
  token: string | null;
  user: UserInfo | null;
}

const API_URL = import.meta.env.VITE_PUSH_API_URL || "";

export function Auth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [auth, setAuth] = useState<AuthState>(() => {
    const saved = sessionStorage.getItem("notifoo_auth");
    return saved ? JSON.parse(saved) : { token: null, user: null };
  });
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) =>
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  // Handle OAuth callback (code in URL params)
  // Skip if this window is a popup - let the opener handle the code
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || window.opener) return;

    addLog(`Callback received: code=${code.slice(0, 8)}... state=${state}`);

    // Clear URL params
    setSearchParams({}, { replace: true });

    // Exchange code for token
    const exchange = async () => {
      try {
        addLog("Exchanging code for token...");
        const res = await fetch(`${API_URL}/api/auth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (data.access_token) {
          const newAuth = { token: data.access_token, user: data.user };
          setAuth(newAuth);
          sessionStorage.setItem("notifoo_auth", JSON.stringify(newAuth));
          addLog(`Token received: ${data.access_token.slice(0, 20)}...`);
          addLog(`User: ${data.user.email}`);
        } else {
          addLog(`Error: ${data.error}`);
        }
      } catch (err) {
        addLog(`Exchange failed: ${String(err)}`);
      }
    };

    void exchange();
  }, [searchParams, setSearchParams]);

  // Pattern 1: Redirect-based OAuth
  const handleRedirectLogin = () => {
    if (!API_URL) {
      addLog("Error: VITE_PUSH_API_URL not configured");
      return;
    }
    const redirectUri = `${window.location.origin}/auth`;
    const state = crypto.randomUUID().slice(0, 8);
    const authUrl = `${API_URL}/api/auth/authorize?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&mode=redirect`;

    addLog(`Redirect login: navigating to ${new URL(authUrl).pathname}`);
    addLog(`redirect_uri: ${redirectUri}`);
    addLog(`state: ${state}`);

    window.location.href = authUrl;
  };

  // Pattern 2: Popup-based OAuth
  const handlePopupLogin = () => {
    if (!API_URL) {
      addLog("Error: VITE_PUSH_API_URL not configured");
      return;
    }
    const redirectUri = `${window.location.origin}/auth`;
    const state = crypto.randomUUID().slice(0, 8);
    const authUrl = `${API_URL}/api/auth/authorize?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&mode=popup`;

    addLog("Popup login: opening popup window...");

    const popup = window.open(authUrl, "notifoo-auth", "width=450,height=600,left=200,top=100");

    if (!popup) {
      addLog("Error: Popup blocked by browser");
      return;
    }

    addLog("Popup opened. Waiting for callback...");

    // Poll the popup for the callback URL
    const interval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(interval);
          addLog("Popup closed by user");
          return;
        }
        // Check if popup has navigated back to our origin
        if (popup.location.origin === window.location.origin) {
          const popupParams = new URL(popup.location.href).searchParams;
          const code = popupParams.get("code");
          const returnedState = popupParams.get("state");
          popup.close();
          clearInterval(interval);

          if (code) {
            addLog(`Popup callback: code=${code.slice(0, 8)}... state=${returnedState}`);
            // Exchange code for token
            void (async () => {
              try {
                addLog("Exchanging code for token...");
                const res = await fetch(`${API_URL}/api/auth/token`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ code }),
                });
                const data = await res.json();
                if (data.access_token) {
                  const newAuth = { token: data.access_token, user: data.user };
                  setAuth(newAuth);
                  sessionStorage.setItem("notifoo_auth", JSON.stringify(newAuth));
                  addLog(`Token received: ${data.access_token.slice(0, 20)}...`);
                  addLog(`User: ${data.user.email}`);
                } else {
                  addLog(`Error: ${data.error}`);
                }
              } catch (err) {
                addLog(`Exchange failed: ${String(err)}`);
              }
            })();
          }
        }
      } catch {
        // Cross-origin access error is expected while popup is on external domain
      }
    }, 500);
  };

  // Fetch /api/auth/me to verify token
  const handleVerifyToken = async () => {
    if (!auth.token) {
      addLog("No token to verify");
      return;
    }
    addLog(`Verifying token: ${auth.token.slice(0, 20)}...`);
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const data = await res.json();
      if (res.ok) {
        addLog(`Verified: ${data.name} (${data.email})`);
      } else {
        addLog(`Verify failed: ${data.error}`);
      }
    } catch (err) {
      addLog(`Verify error: ${String(err)}`);
    }
  };

  const handleLogout = () => {
    setAuth({ token: null, user: null });
    sessionStorage.removeItem("notifoo_auth");
    addLog("Logged out, session cleared");
  };

  const handleClearLog = () => setLog([]);

  return (
    <>
      <Header title="notifoo" enableBack />
      <main className={styles.main}>
        <h2 className={styles.heading}>OAuth Callback Test</h2>

        <wa-card className={styles.card}>
          <h3>Auth State</h3>
          {auth.user ? (
            <div className={styles.userInfo}>
              <img className={styles.avatar} src={auth.user.picture} alt="avatar" />
              <div>
                <p className={styles.userName}>{auth.user.name}</p>
                <p className={styles.userEmail}>{auth.user.email}</p>
                <p className={styles.token}>Token: {auth.token?.slice(0, 24)}...</p>
              </div>
            </div>
          ) : (
            <p className={styles.status}>Not logged in</p>
          )}
        </wa-card>

        <wa-card className={styles.card}>
          <h3>Login Methods</h3>
          <p className={styles.description}>
            Test OAuth redirect and popup patterns in PWA standalone mode. Check if the callback
            returns to the PWA correctly.
          </p>
          <div className={styles.buttons}>
            <wa-button variant="default" onClick={handleRedirectLogin} disabled={!!auth.token}>
              Login (Redirect)
            </wa-button>
            <wa-button variant="default" onClick={handlePopupLogin} disabled={!!auth.token}>
              Login (Popup)
            </wa-button>
          </div>
        </wa-card>

        <wa-card className={styles.card}>
          <h3>Actions</h3>
          <div className={styles.buttons}>
            <wa-button
              variant="default"
              onClick={() => void handleVerifyToken()}
              disabled={!auth.token}
            >
              Verify Token (GET /me)
            </wa-button>
            <wa-button variant="default" onClick={handleLogout} disabled={!auth.token}>
              Logout
            </wa-button>
          </div>
        </wa-card>

        <wa-card className={styles.card}>
          <h3>
            Log{" "}
            <wa-button size="small" variant="default" onClick={handleClearLog}>
              Clear
            </wa-button>
          </h3>
          <pre className={styles.log}>{log.length > 0 ? log.join("\n") : "(no activity)"}</pre>
        </wa-card>
      </main>
    </>
  );
}
