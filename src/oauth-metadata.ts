import { Request, Response, Router } from "express";

/**
 * Self-issued OAuth authorization-server metadata + a Dynamic Client
 * Registration (DCR) shim.
 *
 * The MCP server is a resource server; the real authorization server is our
 * Keycloak realm. But DCR-only MCP clients (Claude web/desktop, Claude Code)
 * insist on registering a client before they can sign in, and we do NOT want
 * to enable open DCR on Keycloak. The trick:
 *
 *  - We serve our OWN `/.well-known/oauth-authorization-server` whose `issuer`
 *    is THIS server's origin (not Keycloak). Clients that compute
 *    `{issuer}/register` therefore hit OUR shim instead of Keycloak's DCR.
 *  - `authorization_endpoint` / `token_endpoint` in that document are the REAL
 *    Keycloak values (fetched once from its openid-configuration), so the
 *    browser sign-in and the code→token exchange still happen on Keycloak.
 *  - The `/register` shim ignores the submitted client metadata and always
 *    returns one pre-registered PUBLIC Keycloak client id, echoing back the
 *    redirect URIs the client asked for.
 *
 * Protected-resource metadata (RFC 9728) advertises OUR origin as the
 * authorization server (not Keycloak directly) so the AS-metadata trick above
 * chains: challenge → protected-resource → authorization-server → Keycloak.
 */

export interface OAuthMetadataOptions {
  /** Keycloak realm base URL (== the token issuer), used to fetch OIDC config. */
  keycloakRealmUrl: string;
  /** The single pre-registered PUBLIC Keycloak client id handed to every client. */
  clientId: string;
  /** Informational docs URL surfaced in protected-resource metadata. */
  resourceDocumentation?: string;
}

interface KeycloakOpenIdConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
}

export const SUPPORTED_SCOPES = ["openid", "profile", "email"];

/**
 * The public origin of this MCP server. `MCP_RESOURCE_URL`, when set, is an
 * explicit override (deployment behind a fixed public host such as
 * https://mcp.nslookup.io); otherwise it is derived from the request so the
 * shim works on whatever host/port it is actually reached at (local dev,
 * smoke tests). Requires `app.set("trust proxy", ...)` for req.protocol to
 * reflect X-Forwarded-Proto behind a TLS terminator.
 */
export function getServerOrigin(req: Request): string {
  const override = process.env.MCP_RESOURCE_URL?.replace(/\/+$/, "");
  if (override) return override;
  return `${req.protocol}://${req.get("host")}`;
}

async function fetchKeycloakMetadata(
  realmUrl: string
): Promise<KeycloakOpenIdConfiguration | null> {
  const url = `${realmUrl}/.well-known/openid-configuration`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(
        `Failed to fetch Keycloak OIDC metadata (${response.status}): ${url}`
      );
      return null;
    }
    return (await response.json()) as KeycloakOpenIdConfiguration;
  } catch (err) {
    console.warn(`Error fetching Keycloak OIDC metadata from ${url}:`, err);
    return null;
  }
}

/** Static endpoints derived from Keycloak's conventional URL layout. */
function buildFallbackMetadata(realmUrl: string): KeycloakOpenIdConfiguration {
  const base = `${realmUrl}/protocol/openid-connect`;
  return {
    issuer: realmUrl,
    authorization_endpoint: `${base}/auth`,
    token_endpoint: `${base}/token`,
  };
}

/**
 * Router serving the OAuth well-known documents + the DCR shim. Mount it
 * publicly (before any auth) — every route here must answer anonymously.
 */
export function createOAuthMetadataRouter(opts: OAuthMetadataOptions): Router {
  const router = Router();
  const realmUrl = opts.keycloakRealmUrl.replace(/\/+$/, "");

  // Fetch Keycloak's OIDC config once at boot; cache it. First request may
  // await the in-flight promise; everything after uses the cached value (or
  // the static fallback if Keycloak was unreachable).
  let cachedKeycloakMetadata: KeycloakOpenIdConfiguration | null = null;
  const metadataPromise = fetchKeycloakMetadata(realmUrl).then((meta) => {
    cachedKeycloakMetadata = meta;
    return meta;
  });

  // ── RFC 9728 protected-resource metadata (bare + /mcp suffix) ─────────────
  // authorization_servers points at OURSELVES so the AS-metadata trick chains.
  const protectedResourceHandler =
    (resourceSuffix: string) =>
    (req: Request, res: Response): void => {
      const serverOrigin = getServerOrigin(req);
      res.json({
        resource: `${serverOrigin}${resourceSuffix}`,
        authorization_servers: [serverOrigin],
        scopes_supported: SUPPORTED_SCOPES,
        bearer_methods_supported: ["header"],
        ...(opts.resourceDocumentation
          ? { resource_documentation: opts.resourceDocumentation }
          : {}),
      });
    };

  router.get(
    "/.well-known/oauth-protected-resource",
    protectedResourceHandler("")
  );
  router.get(
    "/.well-known/oauth-protected-resource/mcp",
    protectedResourceHandler("/mcp")
  );

  // ── OAuth authorization-server metadata (self-issued) ─────────────────────
  router.get(
    "/.well-known/oauth-authorization-server",
    async (req: Request, res: Response) => {
      const serverOrigin = getServerOrigin(req);
      const kc =
        cachedKeycloakMetadata ??
        (await metadataPromise) ??
        buildFallbackMetadata(realmUrl);

      // issuer MUST equal serverOrigin so clients that compute `{issuer}/register`
      // hit our DCR shim. authorization/token endpoints stay on Keycloak — the
      // browser sign-in and code→token exchange happen there, and resource-server
      // JWT validation uses the real Keycloak issuer from env.
      res.json({
        issuer: serverOrigin,
        authorization_endpoint: kc.authorization_endpoint,
        token_endpoint: kc.token_endpoint,
        registration_endpoint: `${serverOrigin}/register`,
        token_endpoint_auth_methods_supported: ["none"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        response_types_supported: ["code"],
        code_challenge_methods_supported: ["S256"],
        scopes_supported: SUPPORTED_SCOPES,
      });
    }
  );

  // ── DCR shim ──────────────────────────────────────────────────────────────
  // Ignores submitted client metadata; always returns the fixed public
  // Keycloak client. Mounted at /register (the path DCR-only clients derive
  // from `{issuer}/register`) and /oauth/register (spec-compliant path).
  const registerHandler = (req: Request, res: Response): void => {
    const redirectUris: string[] = Array.isArray(req.body?.redirect_uris)
      ? req.body.redirect_uris
      : [];
    const grantTypes: string[] = Array.isArray(req.body?.grant_types)
      ? req.body.grant_types
      : ["authorization_code", "refresh_token"];
    const responseTypes: string[] = Array.isArray(req.body?.response_types)
      ? req.body.response_types
      : ["code"];

    res.status(201).json({
      client_id: opts.clientId,
      redirect_uris: redirectUris,
      grant_types: grantTypes,
      response_types: responseTypes,
      token_endpoint_auth_method: "none",
    });
  };

  router.post("/register", registerHandler);
  router.post("/oauth/register", registerHandler);

  return router;
}
