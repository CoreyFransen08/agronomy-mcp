import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import type { Env } from "../types";
import { Hono } from "hono";
import type { Props } from "./utils";
import {
  addApprovedClient,
  bindStateToSession,
  createOAuthState,
  generateCSRFProtection,
  isClientApproved,
  OAuthError,
  renderApprovalDialog,
  validateCSRFToken,
  validateOAuthState,
} from "./workers-oauth-utils";

const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();

/**
 * GET /authorize — Show the credential entry form (or skip if client already approved).
 *
 * Unlike a typical third-party OAuth flow that redirects to an upstream provider,
 * Fleetio uses API Key + Account Token auth. So our "authorize" step collects
 * these credentials directly and packages them as encrypted props in the MCP token.
 */
app.get("/authorize", async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  const { clientId } = oauthReqInfo;
  if (!clientId) {
    return c.text("Invalid request", 400);
  }

  // Generate CSRF protection for the credential form
  const { token: csrfToken, setCookie } = generateCSRFProtection();

  return renderApprovalDialog(c.req.raw, {
    client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
    csrfToken,
    server: {
      name: "Fleetio MCP Server",
      description:
        "Connect your Fleetio fleet management account to query vehicles, maintenance, service reminders, and more via MCP.",
    },
    setCookie,
    state: { oauthReqInfo },
  });
});

/**
 * POST /authorize — Process the credential form submission.
 *
 * Validates CSRF, collects Fleetio API Key + Account Token,
 * validates them against the Fleetio API, then completes the OAuth flow.
 */
app.post("/authorize", async (c) => {
  try {
    const formData = await c.req.raw.formData();

    // Validate CSRF token
    validateCSRFToken(formData, c.req.raw);

    // Extract state
    const encodedState = formData.get("state");
    if (!encodedState || typeof encodedState !== "string") {
      return c.text("Missing state in form data", 400);
    }

    let state: { oauthReqInfo?: AuthRequest };
    try {
      state = JSON.parse(atob(encodedState));
    } catch {
      return c.text("Invalid state data", 400);
    }

    if (!state.oauthReqInfo || !state.oauthReqInfo.clientId) {
      return c.text("Invalid request", 400);
    }

    // Extract Fleetio credentials from form
    const apiKey = formData.get("api_key");
    const accountToken = formData.get("account_token");
    const label = formData.get("label") || "Fleetio Account";

    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return c.text("API Key is required", 400);
    }
    if (!accountToken || typeof accountToken !== "string" || !accountToken.trim()) {
      return c.text("Account Token is required", 400);
    }

    // Validate credentials by making a test request to Fleetio
    const testResp = await fetch("https://secure.fleetio.com/api/v1/users/me", {
      headers: {
        Authorization: `Token ${apiKey.trim()}`,
        "Account-Token": accountToken.trim(),
        "Content-Type": "application/json",
      },
    });

    if (!testResp.ok) {
      const errBody = await testResp.text();
      return new Response(
        `<html><body style="font-family:sans-serif;padding:40px;text-align:center">
          <h2>Invalid Fleetio Credentials</h2>
          <p>Could not authenticate with the provided API Key and Account Token.</p>
          <p style="color:#888;font-size:13px">Fleetio returned: ${testResp.status}</p>
          <a href="javascript:history.back()" style="color:#0070f3">Go back and try again</a>
        </body></html>`,
        { status: 400, headers: { "Content-Type": "text/html" } }
      );
    }

    // Add client to approved list
    const approvedClientCookie = await addApprovedClient(
      c.req.raw,
      state.oauthReqInfo.clientId,
      c.env.COOKIE_ENCRYPTION_KEY
    );

    // Complete the OAuth authorization — credentials become encrypted props
    const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
      request: state.oauthReqInfo,
      userId: accountToken.trim(),
      metadata: { label: String(label) },
      scope: state.oauthReqInfo.scope,
      props: {
        apiKey: apiKey.trim(),
        accountToken: accountToken.trim(),
        label: String(label),
      } as Props,
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectTo,
        "Set-Cookie": approvedClientCookie,
      },
    });
  } catch (error: any) {
    console.error("POST /authorize error:", error);
    if (error instanceof OAuthError) {
      return error.toResponse();
    }
    return c.text(`Internal server error: ${error.message}`, 500);
  }
});

export { app as FleetioHandler };
