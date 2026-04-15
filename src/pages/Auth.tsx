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
const CLIENT_ID = "notifoo";
const SCOPE = "openid profile email";

// PKCE helpers (RFC 7636)
function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}

// Fetch user info from userinfo endpoint
async function fetchUserInfo(apiUrl: string, accessToken: string): Promise<UserInfo> {
  const res = await fetch(`${apiUrl}/api/auth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}

// Exchange authorization code for tokens (RFC 6749 Section 4.1.3)
async function exchangeCode(
  apiUrl: string,
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<{
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}> {
  const res = await fetch(`${apiUrl}/api/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    }),
  });
  return res.json();
}

export function Auth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [auth, setAuth] = useState<AuthState>(() => {
    const saved = sessionStorage.getItem("notifoo_auth");
    return saved ? JSON.parse(saved) : { token: null, user: null };
  });
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) =>
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const redirectUri = `${window.location.origin}/auth`;

  // Handle OAuth callback (code in URL params)
  // Skip if this window is a popup — let the opener handle the code
  useEffect(() => {
    const code = searchParams.get("code");
    const returnedState = searchParams.get("state");
    if (!code || window.opener) return;

    // Validate state (CSRF protection)
    const savedState = sessionStorage.getItem("notifoo_state");
    if (savedState && returnedState !== savedState) {
      addLog(`Error: state mismatch (expected=${savedState}, got=${returnedState})`);
      sessionStorage.removeItem("notifoo_state");
      setSearchParams({}, { replace: true });
      return;
    }
    sessionStorage.removeItem("notifoo_state");

    addLog(`Callback received: code=${code.slice(0, 8)}... state=${returnedState}`);
    setSearchParams({}, { replace: true });

    const exchange = async () => {
      try {
        const codeVerifier = sessionStorage.getItem("notifoo_code_verifier") || "";
        sessionStorage.removeItem("notifoo_code_verifier");

        addLog("Exchanging code (grant_type=authorization_code, PKCE)...");
        const data = await exchangeCode(API_URL, code, redirectUri, codeVerifier);

        if (data.access_token) {
          addLog(`access_token: ${data.access_token.slice(0, 20)}...`);
          if (data.id_token) {
            addLog(`id_token: ${data.id_token.slice(0, 20)}...`);
          }

          addLog("Fetching userinfo...");
          const user = await fetchUserInfo(API_URL, data.access_token);
          const newAuth = { token: data.access_token, user };
          setAuth(newAuth);
          sessionStorage.setItem("notifoo_auth", JSON.stringify(newAuth));
          addLog(`User: ${user.email}`);
        } else {
          addLog(`Error: ${data.error} — ${data.error_description || ""}`);
        }
      } catch (err) {
        addLog(`Exchange failed: ${String(err)}`);
      }
    };

    void exchange();
  }, [searchParams, setSearchParams, redirectUri]);

  // Build authorization URL with PKCE + standard params
  const buildAuthUrl = async (mode: "redirect" | "popup") => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = crypto.randomUUID().slice(0, 8);

    sessionStorage.setItem("notifoo_code_verifier", codeVerifier);
    sessionStorage.setItem("notifoo_state", state);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      scope: SCOPE,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      mode,
    });

    addLog(`response_type=code, client_id=${CLIENT_ID}, scope=${SCOPE}`);
    addLog(`PKCE: code_challenge=${codeChallenge.slice(0, 16)}..., method=S256`);
    addLog(`state: ${state}`);

    return `${API_URL}/api/auth/authorize?${params}`;
  };

  // Pattern 1: Redirect-based OAuth
  const handleRedirectLogin = async () => {
    if (!API_URL) {
      addLog("Error: VITE_PUSH_API_URL not configured");
      return;
    }
    addLog("Redirect login: building authorization URL...");
    const authUrl = await buildAuthUrl("redirect");
    window.location.href = authUrl;
  };

  // Pattern 2: Popup-based OAuth
  const handlePopupLogin = async () => {
    if (!API_URL) {
      addLog("Error: VITE_PUSH_API_URL not configured");
      return;
    }
    addLog("Popup login: building authorization URL...");
    const authUrl = await buildAuthUrl("popup");

    const popup = window.open(authUrl, "notifoo-auth", "width=450,height=600,left=200,top=100");

    if (!popup) {
      addLog("Error: Popup blocked by browser");
      return;
    }

    addLog("Popup opened. Waiting for callback...");

    const codeVerifier = sessionStorage.getItem("notifoo_code_verifier") || "";

    const interval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(interval);
          addLog("Popup closed by user");
          return;
        }
        if (popup.location.origin === window.location.origin) {
          const popupParams = new URL(popup.location.href).searchParams;
          const code = popupParams.get("code");
          const returnedState = popupParams.get("state");
          popup.close();
          clearInterval(interval);

          if (code) {
            // Validate state
            const savedState = sessionStorage.getItem("notifoo_state");
            if (savedState && returnedState !== savedState) {
              addLog(`Error: state mismatch (expected=${savedState}, got=${returnedState})`);
              sessionStorage.removeItem("notifoo_state");
              return;
            }
            sessionStorage.removeItem("notifoo_state");

            addLog(`Popup callback: code=${code.slice(0, 8)}... state=${returnedState}`);

            void (async () => {
              try {
                sessionStorage.removeItem("notifoo_code_verifier");
                addLog("Exchanging code (grant_type=authorization_code, PKCE)...");
                const data = await exchangeCode(API_URL, code, redirectUri, codeVerifier);

                if (data.access_token) {
                  addLog(`access_token: ${data.access_token.slice(0, 20)}...`);
                  if (data.id_token) {
                    addLog(`id_token: ${data.id_token.slice(0, 20)}...`);
                  }

                  addLog("Fetching userinfo...");
                  const user = await fetchUserInfo(API_URL, data.access_token);
                  const newAuth = { token: data.access_token, user };
                  setAuth(newAuth);
                  sessionStorage.setItem("notifoo_auth", JSON.stringify(newAuth));
                  addLog(`User: ${user.email}`);
                } else {
                  addLog(`Error: ${data.error} — ${data.error_description || ""}`);
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

  // Verify token via /api/auth/userinfo
  const handleVerifyToken = async () => {
    if (!auth.token) {
      addLog("No token to verify");
      return;
    }
    addLog(`Verifying token via /api/auth/userinfo...`);
    try {
      const user = await fetchUserInfo(API_URL, auth.token);
      if (user.email) {
        addLog(`Verified: ${user.name} (${user.email})`);
      } else {
        addLog(`Verify failed: ${JSON.stringify(user)}`);
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
            Test OAuth 2.0 Authorization Code Flow + PKCE (RFC 6749 / RFC 7636) with redirect and
            popup patterns in PWA standalone mode.
          </p>
          <div className={styles.buttons}>
            <wa-button
              variant="default"
              onClick={() => void handleRedirectLogin()}
              disabled={!!auth.token}
            >
              Login (Redirect)
            </wa-button>
            <wa-button
              variant="default"
              onClick={() => void handlePopupLogin()}
              disabled={!!auth.token}
            >
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
              Verify Token (GET /userinfo)
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
