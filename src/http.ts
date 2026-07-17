#!/usr/bin/env node

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "./tools.js";
import { registerPortalTools } from "./portal-tools.js";
import {
  authenticateHeader,
  extractRequestId,
  isPortalToolCall,
  wwwAuthenticateChallenge,
  KEYCLOAK_REALM_URL,
  KEYCLOAK_CLIENT_ID,
  RESOURCE_DOCUMENTATION,
} from "./auth.js";
import { createOAuthMetadataRouter, getServerOrigin } from "./oauth-metadata.js";

const PORT = parseInt(process.env.PORT || "3100", 10);

const INSTRUCTIONS =
  "17 tools work anonymously. Tools prefixed my_ access your NsLookup.io monitoring account and require sign-in (OAuth) or an API token.";

function createServer(getToken: () => string | undefined): McpServer {
  const server = new McpServer(
    {
      name: "nslookup",
      version: "1.6.0",
      description:
        "DNS and domain intelligence tools powered by nslookup.io. Look up any of 53 DNS record types, check DNS propagation across 18+ global servers, inspect SSL/TLS certificates, verify BIMI/VMC records, run security scans (SPF/DKIM/DMARC, cookies, headers), and test website availability from 7 locations worldwide (Amsterdam, Sydney, London, Frankfurt, Delhi, Warsaw, South Carolina). Public checks are real-time, stateless, and require no authentication; my_* tools read your own NsLookup.io monitoring account after sign-in.",
    },
    { instructions: INSTRUCTIONS }
  );
  registerTools(server);
  registerPortalTools(server, { getToken });
  return server;
}

const app = express();
// Behind the TLS terminator at mcp.nslookup.io, so req.protocol reflects
// X-Forwarded-Proto (https) — needed for correct self-issued OAuth origins.
app.set("trust proxy", 1);
app.use(express.json());

// CORS — needed for browser-based MCP clients
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version"
  );
  res.header("Access-Control-Expose-Headers", "Mcp-Session-Id, WWW-Authenticate");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// OAuth well-known metadata + DCR shim. Public, CORS-open (handled above),
// no auth. Serves:
//  - /.well-known/oauth-protected-resource (+ /mcp) — RFC 9728, authorization
//    server = OUR origin (so the AS-metadata trick chains);
//  - /.well-known/oauth-authorization-server — self-issued: issuer = OUR
//    origin, real Keycloak auth/token endpoints, registration_endpoint = /register;
//  - POST /register + /oauth/register — DCR shim returning the fixed public
//    Keycloak client. This lets DCR-only clients (Claude web/desktop, Claude
//    Code) connect against ONE pre-registered public client without enabling
//    Keycloak DCR.
app.use(
  createOAuthMetadataRouter({
    keycloakRealmUrl: KEYCLOAK_REALM_URL,
    clientId: KEYCLOAK_CLIENT_ID,
    resourceDocumentation: RESOURCE_DOCUMENTATION,
  })
);

// Stateless MCP endpoint — new server + transport per request.
// Anonymous requests work for everything except my_* tool calls, which get
// the OAuth challenge (401 + WWW-Authenticate → resource metadata → Keycloak).
app.post("/mcp", async (req, res) => {
  try {
    const auth = await authenticateHeader(req.headers.authorization);

    // Lightweight request/auth trace (no token contents) — diagnoses OAuth issues.
    const rawAuth = req.headers.authorization;
    const authShape = !rawAuth
      ? "none"
      : Array.isArray(rawAuth)
        ? "array"
        : /^bearer\s+nslk_/i.test(rawAuth)
          ? "pat"
          : /^bearer\s+/i.test(rawAuth)
            ? "jwt"
            : "other";
    const toolName =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as { params?: { name?: unknown } }).params?.name
        : undefined;
    const method =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as { method?: unknown }).method
        : undefined;
    console.log(
      `[mcp] method=${String(method)} tool=${String(toolName)} authHeader=${authShape} ` +
        `authenticated=${auth.authenticated} authMethod=${auth.method ?? "-"}` +
        (auth.reason ? ` reason="${auth.reason}"` : "")
    );

    if (!auth.authenticated && isPortalToolCall(req.body)) {
      res
        .status(401)
        .set("WWW-Authenticate", wwwAuthenticateChallenge(getServerOrigin(req)))
        .json({
          jsonrpc: "2.0",
          error: {
            code: -32001,
            message:
              "Authentication required: my_* tools read your NsLookup.io monitoring account. " +
              "Sign in via OAuth (your MCP client should offer it after this response) or supply an API token " +
              "as 'Authorization: Bearer nslk_...'." +
              (auth.reason ? ` (${auth.reason})` : ""),
          },
          id: extractRequestId(req.body) ?? null,
        });
      return;
    }

    const server = createServer(() => auth.token);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// GET and DELETE not supported in stateless mode
app.get("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
});

app.delete("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "nslookup-mcp" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`nslookup MCP HTTP server running on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});

process.on("SIGINT", () => {
  console.log("Shutting down...");
  process.exit(0);
});
