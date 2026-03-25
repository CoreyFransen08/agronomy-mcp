import type { AuthRequest, ClientInfo } from "@cloudflare/workers-oauth-provider";

export class OAuthError extends Error {
  constructor(
    public code: string,
    public description: string,
    public statusCode = 400
  ) {
    super(description);
    this.name = "OAuthError";
  }

  toResponse(): Response {
    return new Response(
      JSON.stringify({ error: this.code, error_description: this.description }),
      { status: this.statusCode, headers: { "Content-Type": "application/json" } }
    );
  }
}

export interface OAuthStateResult {
  stateToken: string;
}

export interface ValidateStateResult {
  oauthReqInfo: AuthRequest;
  clearCookie: string;
}

export interface BindStateResult {
  setCookie: string;
}

export interface CSRFProtectionResult {
  token: string;
  setCookie: string;
}

export interface ValidateCSRFResult {
  clearCookie: string;
}

export function sanitizeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeUrl(url: string): string {
  const normalized = url.trim();
  if (normalized.length === 0) return "";

  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if ((code >= 0x00 && code <= 0x1f) || (code >= 0x7f && code <= 0x9f)) {
      return "";
    }
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalized);
  } catch {
    return "";
  }

  const allowedSchemes = ["https", "http"];
  const scheme = parsedUrl.protocol.slice(0, -1).toLowerCase();
  if (!allowedSchemes.includes(scheme)) return "";

  return normalized;
}

export function generateCSRFProtection(): CSRFProtectionResult {
  const csrfCookieName = "__Host-CSRF_TOKEN";
  const token = crypto.randomUUID();
  const setCookie = `${csrfCookieName}=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`;
  return { token, setCookie };
}

export function validateCSRFToken(formData: FormData, request: Request): ValidateCSRFResult {
  const csrfCookieName = "__Host-CSRF_TOKEN";
  const tokenFromForm = formData.get("csrf_token");

  if (!tokenFromForm || typeof tokenFromForm !== "string") {
    throw new OAuthError("invalid_request", "Missing CSRF token in form data", 400);
  }

  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const csrfCookie = cookies.find((c) => c.startsWith(`${csrfCookieName}=`));
  const tokenFromCookie = csrfCookie ? csrfCookie.substring(csrfCookieName.length + 1) : null;

  if (!tokenFromCookie) {
    throw new OAuthError("invalid_request", "Missing CSRF token cookie", 400);
  }

  if (tokenFromForm !== tokenFromCookie) {
    throw new OAuthError("invalid_request", "CSRF token mismatch", 400);
  }

  const clearCookie = `${csrfCookieName}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`;
  return { clearCookie };
}

export async function createOAuthState(
  oauthReqInfo: AuthRequest,
  kv: KVNamespace,
  stateTTL = 600
): Promise<OAuthStateResult> {
  const stateToken = crypto.randomUUID();
  await kv.put(`oauth:state:${stateToken}`, JSON.stringify(oauthReqInfo), {
    expirationTtl: stateTTL,
  });
  return { stateToken };
}

export async function bindStateToSession(stateToken: string): Promise<BindStateResult> {
  const consentedStateCookieName = "__Host-CONSENTED_STATE";
  const encoder = new TextEncoder();
  const data = encoder.encode(stateToken);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  const setCookie = `${consentedStateCookieName}=${hashHex}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`;
  return { setCookie };
}

export async function validateOAuthState(
  request: Request,
  kv: KVNamespace
): Promise<ValidateStateResult> {
  const consentedStateCookieName = "__Host-CONSENTED_STATE";
  const url = new URL(request.url);
  const stateFromQuery = url.searchParams.get("state");

  if (!stateFromQuery) {
    throw new OAuthError("invalid_request", "Missing state parameter", 400);
  }

  const storedDataJson = await kv.get(`oauth:state:${stateFromQuery}`);
  if (!storedDataJson) {
    throw new OAuthError("invalid_request", "Invalid or expired state", 400);
  }

  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const consentedStateCookie = cookies.find((c) => c.startsWith(`${consentedStateCookieName}=`));
  const consentedStateHash = consentedStateCookie
    ? consentedStateCookie.substring(consentedStateCookieName.length + 1)
    : null;

  if (!consentedStateHash) {
    throw new OAuthError(
      "invalid_request",
      "Missing session binding cookie - authorization flow must be restarted",
      400
    );
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(stateFromQuery);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const stateHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  if (stateHash !== consentedStateHash) {
    throw new OAuthError(
      "invalid_request",
      "State token does not match session - possible CSRF attack detected",
      400
    );
  }

  let oauthReqInfo: AuthRequest;
  try {
    oauthReqInfo = JSON.parse(storedDataJson) as AuthRequest;
  } catch {
    throw new OAuthError("server_error", "Invalid state data", 500);
  }

  await kv.delete(`oauth:state:${stateFromQuery}`);

  const clearCookie = `${consentedStateCookieName}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`;
  return { oauthReqInfo, clearCookie };
}

export async function isClientApproved(
  request: Request,
  clientId: string,
  cookieSecret: string
): Promise<boolean> {
  const approvedClients = await getApprovedClientsFromCookie(request, cookieSecret);
  return approvedClients?.includes(clientId) ?? false;
}

export async function addApprovedClient(
  request: Request,
  clientId: string,
  cookieSecret: string
): Promise<string> {
  const approvedClientsCookieName = "__Host-APPROVED_CLIENTS";
  const THIRTY_DAYS_IN_SECONDS = 2592000;
  const existingApprovedClients =
    (await getApprovedClientsFromCookie(request, cookieSecret)) || [];
  const updatedApprovedClients = Array.from(new Set([...existingApprovedClients, clientId]));
  const payload = JSON.stringify(updatedApprovedClients);
  const signature = await signData(payload, cookieSecret);
  const cookieValue = `${signature}.${btoa(payload)}`;
  return `${approvedClientsCookieName}=${cookieValue}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${THIRTY_DAYS_IN_SECONDS}`;
}

async function getApprovedClientsFromCookie(
  request: Request,
  cookieSecret: string
): Promise<string[] | null> {
  const approvedClientsCookieName = "__Host-APPROVED_CLIENTS";
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const approvedCookie = cookies.find((c) => c.startsWith(`${approvedClientsCookieName}=`));
  if (!approvedCookie) return null;

  const cookieValue = approvedCookie.substring(approvedClientsCookieName.length + 1);
  const dotIndex = cookieValue.indexOf(".");
  if (dotIndex === -1) return null;

  const signature = cookieValue.substring(0, dotIndex);
  const encodedPayload = cookieValue.substring(dotIndex + 1);

  let payload: string;
  try {
    payload = atob(encodedPayload);
  } catch {
    return null;
  }

  const expectedSignature = await signData(payload, cookieSecret);
  if (signature !== expectedSignature) return null;

  try {
    return JSON.parse(payload) as string[];
  } catch {
    return null;
  }
}

async function signData(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface ApprovalDialogOptions {
  client: ClientInfo | null;
  server: { name: string; logo?: string; description?: string };
  state: Record<string, any>;
  csrfToken: string;
  setCookie: string;
}

export function renderApprovalDialog(
  request: Request,
  options: ApprovalDialogOptions
): Response {
  const { client, server, state, csrfToken, setCookie } = options;
  const encodedState = btoa(JSON.stringify(state));
  const serverName = sanitizeText(server.name);
  const clientName = client?.clientName ? sanitizeText(client.clientName) : "Unknown MCP Client";
  const serverDescription = server.description ? sanitizeText(server.description) : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${serverName} | Authorization</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
    .card { background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; max-width: 460px; width: 100%; }
    .logo { width: 64px; height: 64px; margin: 0 auto 16px; display: block; border-radius: 12px; }
    h1 { text-align: center; font-size: 22px; margin-bottom: 8px; color: #1a1a1a; }
    .desc { text-align: center; color: #666; font-size: 14px; margin-bottom: 24px; }
    .client-info { background: #f9f9f9; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 13px; color: #444; }
    label { display: block; font-size: 14px; font-weight: 500; color: #333; margin-bottom: 6px; }
    input[type="text"], input[type="password"] { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; margin-bottom: 16px; }
    input:focus { outline: none; border-color: #0070f3; box-shadow: 0 0 0 3px rgba(0,112,243,0.1); }
    .hint { font-size: 12px; color: #888; margin-top: -12px; margin-bottom: 16px; }
    button { width: 100%; padding: 12px; background: #0070f3; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; }
    button:hover { background: #0060df; }
    .footer { text-align: center; margin-top: 16px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="card">
    ${server.logo ? `<img class="logo" src="${sanitizeText(sanitizeUrl(server.logo))}" alt="${serverName}">` : ""}
    <h1>${serverName}</h1>
    <p class="desc">${serverDescription}</p>
    <div class="client-info">
      <strong>${clientName}</strong> is requesting access to your Fleetio account via MCP.
    </div>
    <form method="POST" action="/authorize">
      <input type="hidden" name="csrf_token" value="${sanitizeText(csrfToken)}">
      <input type="hidden" name="state" value="${sanitizeText(encodedState)}">
      <label for="api_key">Fleetio API Key</label>
      <input type="password" id="api_key" name="api_key" required placeholder="Your Fleetio API key">
      <p class="hint">Found under User Settings in your Fleetio account.</p>
      <label for="account_token">Account Token</label>
      <input type="text" id="account_token" name="account_token" required placeholder="Your Fleetio account token">
      <p class="hint">The Account-Token header value for your Fleetio account.</p>
      <label for="label">Label (optional)</label>
      <input type="text" id="label" name="label" placeholder="e.g. My Fleet Account">
      <button type="submit">Authorize</button>
    </form>
    <p class="footer">Your credentials are encrypted and never stored in plaintext.</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Set-Cookie": setCookie,
    },
  });
}
