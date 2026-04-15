# OAuth 2.0 Authentication

notifoo implements OAuth 2.0 Authorization Code Flow with PKCE as a demo. The server (`server/src/index.ts`) simulates an OAuth provider; the frontend (`src/pages/Auth.tsx`) acts as a public client.

## Specifications

| Spec               | What it covers                                                             |
| ------------------ | -------------------------------------------------------------------------- |
| RFC 6749           | OAuth 2.0 core framework                                                   |
| OAuth 2.1 (draft)  | Consolidation of OAuth 2.0 + security BCPs; PKCE mandatory for all clients |
| RFC 7636           | PKCE (Proof Key for Code Exchange)                                         |
| OIDC Discovery 1.0 | `/.well-known/openid-configuration` endpoint                               |
| OIDC Core 1.0      | ID Token, UserInfo Endpoint                                                |

> **Note:** OAuth 2.1 (`draft-ietf-oauth-v2-1`) is on the IETF Standards Track and intended to replace RFC 6749. It mandates PKCE for all clients (not just public ones) and removes the Implicit grant. While not yet finalized as an RFC, it reflects current security best practice.

## Endpoints

| Method | Path                                | Purpose                             |
| ------ | ----------------------------------- | ----------------------------------- |
| GET    | `/.well-known/openid-configuration` | OIDC Discovery                      |
| GET    | `/api/auth/authorize`               | Authorization (consent page)        |
| POST   | `/api/auth/token`                   | Token exchange                      |
| GET    | `/api/auth/userinfo`                | User claims (Bearer token required) |

## Flow

```
+--------+                               +--------+
| Client |                               | Server |
+--------+                               +--------+
     |                                        |
     | 1. Generate code_verifier              |
     |    code_challenge = SHA256(verifier)    |
     |    state = random                       |
     |    Store verifier + state in session    |
     |                                        |
     | 2. GET /authorize ------------------>  |
     |    response_type=code                   |
     |    client_id=notifoo                    |
     |    redirect_uri=.../auth                |
     |    scope=openid profile email           |
     |    state=...                            |
     |    code_challenge=...                   |
     |    code_challenge_method=S256           |
     |                                        |
     |            <-- Consent page (HTML) --  |
     |                                        |
     | 3. User clicks "Allow"                 |
     |    Redirect to redirect_uri?code=...   |
     |                                        |
     | 4. Validate state                      |
     |                                        |
     | 5. POST /token ----------------------> |
     |    Content-Type: form-urlencoded        |
     |    grant_type=authorization_code        |
     |    code=...                             |
     |    redirect_uri=...                     |
     |    client_id=notifoo                    |
     |    code_verifier=...                    |
     |                                        |
     |    Server validates:                    |
     |      SHA256(verifier) == challenge      |
     |      redirect_uri matches              |
     |      client_id matches                 |
     |      code is single-use                |
     |                                        |
     |    <-- { access_token, id_token } --   |
     |                                        |
     | 6. GET /userinfo -------------------->  |
     |    Authorization: Bearer <token>        |
     |                                        |
     |    <-- { sub, name, email, picture } -- |
     +                                        +

Legend:
- Client: Frontend (Auth.tsx, PWA)
- Server: Hono OAuth demo server (Cloud Run)
- code_verifier: PKCE random secret (stored client-side)
- code_challenge: SHA-256 hash of verifier (sent to server)
- state: CSRF protection token
- id_token: JWT containing user claims (HS256)
```

## Redirect vs Popup

The frontend supports two OAuth patterns. Both use the same server-side flow.

### Redirect

```
Browser tab ──> /authorize ──> consent ──> Allow ──> /auth?code=...
                                                      (same tab)
```

- The entire browser tab navigates to the authorization server.
- After consent, the server redirects back to `/auth?code=...&state=...`.
- The `useEffect` hook in `Auth.tsx` detects `code` in URL params, validates `state`, and exchanges the code.
- Standard approach. Works everywhere.

### Popup

```
Main tab                    Popup window
  |                           |
  |── window.open() ──>      |
  |                      /authorize
  |                      consent page
  |                      Allow click
  |                      /auth?code=...
  |<── poll location ──      |
  |    detect code            |
  |    popup.close()          |
  |                         (closed)
  |
  | exchange code
  | fetch userinfo
```

- A popup window (`window.open`) navigates to the authorization server.
- The main page polls the popup's `location` every 500ms.
- When the popup redirects back to the PWA origin (`/auth?code=...`), the main page reads the code and closes the popup.
- The `window.opener` guard in `useEffect` prevents the popup's own React instance from consuming the code.
- Better UX for PWA standalone mode (avoids leaving the app).

### Key difference

| Aspect                | Redirect                    | Popup                                              |
| --------------------- | --------------------------- | -------------------------------------------------- |
| Navigation            | Full-page redirect          | Separate window                                    |
| PWA standalone        | Leaves the app              | Stays in the app                                   |
| Browser support       | Universal                   | May be blocked by popup blockers                   |
| `window.opener` guard | Not needed                  | Required                                           |
| PKCE storage          | `sessionStorage` (same tab) | `sessionStorage` (main tab stores, main tab reads) |

## PKCE

PKCE prevents authorization code interception attacks. Under OAuth 2.1, PKCE is mandatory for **all clients** using the Authorization Code flow (both public and confidential). Even under OAuth 2.0, it is effectively required for public clients (SPAs, PWAs) that cannot store a `client_secret`.

1. **Client** generates a random `code_verifier` (32 bytes, Base64URL-encoded)
2. **Client** computes `code_challenge = BASE64URL(SHA-256(code_verifier))`
3. **Client** sends `code_challenge` + `code_challenge_method=S256` in the authorize request
4. **Client** stores `code_verifier` in `sessionStorage`
5. **Client** sends `code_verifier` in the token exchange request
6. **Server** computes `SHA-256(code_verifier)` and compares with stored `code_challenge`

Even if an attacker intercepts the authorization code, they cannot exchange it without the `code_verifier` (which never leaves the client).

## ID Token

The token response includes an `id_token` (JWT). The OIDC Core default signing algorithm is **RS256** (asymmetric). This demo uses **HS256** (symmetric) for simplicity since it avoids key pair management. Production implementations should use RS256 or stronger.

The id_token contains:

| Claim     | Description            |
| --------- | ---------------------- |
| `iss`     | Issuer (server origin) |
| `sub`     | Subject (user ID)      |
| `aud`     | Audience (`notifoo`)   |
| `exp`     | Expiration (1 hour)    |
| `iat`     | Issued at              |
| `email`   | User email             |
| `name`    | User display name      |
| `picture` | Avatar URL             |

## Conformance Testing

`tests/e2e/oauth-conformance.spec.ts` validates RFC compliance using [oauth4webapi](https://github.com/panva/oauth4webapi) (a standards-compliant OAuth 2.0 client library by panva).

Tests cover:

- OIDC Discovery metadata (RFC 8414)
- Authorization endpoint parameter validation (RFC 6749 Section 4.1.1)
- Token exchange with PKCE verification (RFC 7636)
- Single-use authorization code enforcement
- `redirect_uri` mismatch rejection
- UserInfo endpoint claims (OIDC Core Section 5.3)
- ID Token JWT structure and required claims (OIDC Core Section 2)
