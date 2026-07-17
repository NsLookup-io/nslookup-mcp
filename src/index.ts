#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";
import { registerPortalTools } from "./portal-tools.js";

const INSTRUCTIONS =
  "17 tools work anonymously. Tools prefixed my_ access your NsLookup.io monitoring account and require sign-in (OAuth) or an API token.";

const server = new McpServer(
  {
    name: "nslookup",
    version: "1.5.0",
    description:
      "DNS and domain intelligence tools powered by nslookup.io. Look up any of 53 DNS record types, check DNS propagation across 18+ global servers, inspect SSL/TLS certificates, verify BIMI/VMC records, run security scans (SPF/DKIM/DMARC, cookies, headers), and test website availability from 7 locations worldwide (Amsterdam, Sydney, London, Frankfurt, Delhi, Warsaw, South Carolina). Public checks are real-time, stateless, and require no authentication; my_* tools read your own NsLookup.io monitoring account after sign-in.",
  },
  { instructions: INSTRUCTIONS }
);

registerTools(server);
// stdio has no OAuth flow — portal tools authenticate via NSLOOKUP_API_TOKEN
// (an `nslk_...` personal access token or a raw Keycloak access token).
registerPortalTools(server, {
  getToken: () => process.env.NSLOOKUP_API_TOKEN || undefined,
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
