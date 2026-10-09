import { jwtVerify, createRemoteJWKSet } from "jose";
import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import type { AppBindings } from "./types";

type OAuthEnv = AppBindings & { OAUTH_PROVIDER: OAuthHelpers };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character
));

const createPkce = async () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return { verifier, challenge };
};

const consentPage = (clientName: string, redirectHost: string, handle: string, scopes: string[]) => `<!doctype html>
<meta charset="utf-8">
<title>Authorize life-track</title>
<h1>Authorize life-track</h1>
<p><strong>${escapeHtml(clientName)}</strong> requests access to your life-track data.</p>
<p>Redirect destination: <strong>${escapeHtml(redirectHost)}</strong></p>
<p>Permissions: ${scopes.map(escapeHtml).join(", ")}</p>
<form method="post" action="/authorize">
  <input type="hidden" name="handle" value="${escapeHtml(handle)}">
  <button name="decision" value="deny" type="submit">Deny</button>
  <button name="decision" value="approve" type="submit">Allow</button>
</form>`;

const redirectToAccess = async (request: Request, env: OAuthEnv, authRequest: Awaited<ReturnType<OAuthHelpers["parseAuthRequest"]>>, headers: Headers) => {
  const { verifier, challenge } = await createPkce();
  const transaction = await env.OAUTH_PROVIDER.beginUpstream(authRequest, {
    data: { verifier },
    headers,
  });
  const url = new URL(env.ACCESS_AUTHORIZATION_URL);
  url.searchParams.set("client_id", env.ACCESS_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", new URL("/callback", request.url).href);
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", transaction.state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  transaction.headers.set("Location", url.toString());
  return new Response(null, { status: 302, headers: transaction.headers });
};

const exchangeAccessCode = async (request: Request, env: OAuthEnv, code: string, verifier: string) => {
  const body = new URLSearchParams({
    client_id: env.ACCESS_CLIENT_ID,
    client_secret: env.ACCESS_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: new URL("/callback", request.url).href,
    code_verifier: verifier,
  });
  const response = await fetch(env.ACCESS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (!response.ok) throw new Error(`Access token exchange failed: ${response.status}`);
  const result = await response.json<{ access_token?: string; id_token?: string }>();
  if (!result.access_token || !result.id_token) throw new Error("Access did not return the required OIDC tokens");
  return { access_token: result.access_token, id_token: result.id_token };
};

const verifyAccessIdentity = async (env: OAuthEnv, idToken: string) => {
  const jwks = createRemoteJWKSet(new URL(env.ACCESS_JWKS_URL));
  const issuer = new URL(env.ACCESS_AUTHORIZATION_URL).origin;
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer,
    audience: env.ACCESS_CLIENT_ID,
  });
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  if (!email) throw new Error("Access identity did not include an email");
  return { email, name: typeof payload.name === "string" ? payload.name : email, sub: String(payload.sub ?? email) };
};

export async function handleMcpAuth(request: Request, env: OAuthEnv, ctx: ExecutionContext) {
  const url = new URL(request.url);
  if (url.pathname !== "/authorize" && url.pathname !== "/callback") return null;

  try {
    if (url.pathname === "/authorize" && request.method === "GET") {
      const authRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
      const details = await env.OAUTH_PROVIDER.describeConsent(authRequest);
      const consent = await env.OAUTH_PROVIDER.beginConsent(authRequest);
      consent.headers.set("Content-Type", "text/html; charset=utf-8");
      consent.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
      consent.headers.set("X-Frame-Options", "DENY");
      return new Response(
        consentPage(details.clientName, details.redirectHost, consent.handle, details.scope),
        { status: 200, headers: consent.headers },
      );
    }

    if (url.pathname === "/authorize" && request.method === "POST") {
      const form = await request.formData();
      const handle = String(form.get("handle") ?? "");
      if (form.get("decision") !== "approve") {
        const denied = await env.OAUTH_PROVIDER.denyConsent(request, handle);
        return new Response(null, { status: 302, headers: denied.headers });
      }
      const approved = await env.OAUTH_PROVIDER.approveConsent(request, handle, {
        scope: form.getAll("scope").map(String),
      });
      return redirectToAccess(request, env, approved.request, approved.headers);
    }

    if (url.pathname === "/callback" && request.method === "GET") {
      const upstream = await env.OAUTH_PROVIDER.finishUpstream<{ verifier: string }>(request);
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing Access authorization code", { status: 400 });
      const access = await exchangeAccessCode(request, env, code, upstream.data.verifier);
      const identity = await verifyAccessIdentity(env, access.id_token);
      const user = await env.DB.prepare(
        "SELECT id, display_name FROM users WHERE lower(email) = ?1 LIMIT 1",
      ).bind(identity.email).first<{ id: string; display_name: string }>();
      if (!user) return new Response("No life-track user is associated with this email", { status: 403 });

      const redirect = await env.OAUTH_PROVIDER.completeAuthorization({
        request: upstream.request,
        userId: user.id,
        metadata: { label: user.display_name },
        scope: upstream.request.scope,
        props: { userId: user.id, email: identity.email, name: identity.name },
      });
      return Response.redirect(redirect.redirectTo, 302);
    }
  } catch (error) {
    console.error("MCP OAuth request failed", error);
    return new Response("MCP authorization failed", { status: 400 });
  }

  return new Response("Method not allowed", { status: 405 });
}
