import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * OAuth 2.1 resource-server support (RFC 9728 protected-resource metadata +
 * bearer-token validation) for the hosted MCP endpoint.
 *
 * The MCP server is a pure RESOURCE server: the authorization server is the
 * existing Keycloak realm. Two credential kinds are accepted:
 *  - `nslk_...` personal access tokens — opaque, passed through to portal-api
 *    which is the validating authority (sha256 lookup there);
 *  - Keycloak JWTs — validated locally (signature via the realm JWKS, issuer,
 *    exp). Audience is deliberately NOT enforced: portal-api itself skips the
 *    audience check unless KEYCLOAK_AUDIENCE is set (Keycloak access tokens
 *    typically carry aud=account), so enforcing it here would reject tokens
 *    the backend accepts.
 */

export const KEYCLOAK_ISSUER = (
  process.env.KEYCLOAK_ISSUER || "https://auth.nslookup.io/realms/nslookup-io"
).replace(/\/+$/, "");

export const MCP_RESOURCE_URL = (
  process.env.MCP_RESOURCE_URL || "https://mcp.nslookup.io"
).replace(/\/+$/, "");

export const RESOURCE_DOCUMENTATION = "https://www.nslookup.io/mcp";

export const PORTAL_TOOL_PREFIX = "my_";

// Same JWKS caching parameters as portal-api's JwtAuthGuard. Lazy: no network
// I/O happens until the first JWT actually needs verifying.
const jwks = createRemoteJWKSet(
  new URL(`${KEYCLOAK_ISSUER}/protocol/openid-connect/certs`),
  {
    cacheMaxAge: 10 * 60 * 1000,
    cooldownDuration: 30 * 1000,
  }
);

export interface AuthContext {
  /** True when the request carries a credential we can forward upstream. */
  authenticated: boolean;
  /** The raw bearer credential (JWT or nslk_ PAT), forwarded as-is. */
  token?: string;
  method?: "pat" | "jwt";
  /** Why an offered credential was rejected (absent when none was offered). */
  reason?: string;
}

export function looksLikePat(token: string): boolean {
  return token.startsWith("nslk_");
}

/**
 * Classify the Authorization header of an incoming request.
 *  - absent            → anonymous
 *  - Bearer nslk_...   → authenticated (opaque PAT — portal-api validates)
 *  - Bearer <JWT>      → validated locally; invalid/expired → anonymous
 *                        (portal tool calls will then get the 401 challenge)
 */
export async function authenticateHeader(
  header: string | string[] | undefined
): Promise<AuthContext> {
  if (!header) return { authenticated: false };
  const value = Array.isArray(header) ? header[0] : header;
  const match = /^bearer\s+(\S+)$/i.exec(value.trim());
  if (!match) {
    return { authenticated: false, reason: "Malformed Authorization header" };
  }
  const token = match[1];

  if (looksLikePat(token)) {
    return { authenticated: true, token, method: "pat" };
  }

  try {
    await jwtVerify(token, jwks, {
      issuer: KEYCLOAK_ISSUER,
      // No audience restriction — see module docblock.
      algorithms: ["RS256", "RS384", "RS512", "ES256", "ES384"],
    });
    return { authenticated: true, token, method: "jwt" };
  } catch (err) {
    return {
      authenticated: false,
      reason: `Invalid or expired token: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** RFC 9728 protected-resource metadata document. */
export function protectedResourceMetadata(): Record<string, unknown> {
  return {
    resource: MCP_RESOURCE_URL,
    authorization_servers: [KEYCLOAK_ISSUER],
    bearer_methods_supported: ["header"],
    resource_documentation: RESOURCE_DOCUMENTATION,
  };
}

/** WWW-Authenticate challenge pointing clients at the resource metadata. */
export function wwwAuthenticateChallenge(): string {
  return `Bearer resource_metadata="${MCP_RESOURCE_URL}/.well-known/oauth-protected-resource"`;
}

interface JsonRpcMessage {
  method?: unknown;
  params?: { name?: unknown };
  id?: unknown;
}

function isPortalCallMessage(msg: unknown): boolean {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as JsonRpcMessage;
  return (
    m.method === "tools/call" &&
    typeof m.params?.name === "string" &&
    m.params.name.startsWith(PORTAL_TOOL_PREFIX)
  );
}

/**
 * Does this (single or batch) JSON-RPC body invoke a portal (`my_`) tool?
 * initialize / tools/list / public tool calls never match — those must keep
 * working anonymously.
 */
export function isPortalToolCall(body: unknown): boolean {
  if (Array.isArray(body)) return body.some(isPortalCallMessage);
  return isPortalCallMessage(body);
}

/** Best-effort JSON-RPC id extraction for the 401 error body. */
export function extractRequestId(body: unknown): unknown {
  const first = Array.isArray(body) ? body.find(isPortalCallMessage) : body;
  if (first && typeof first === "object" && "id" in first) {
    return (first as JsonRpcMessage).id ?? null;
  }
  return null;
}
