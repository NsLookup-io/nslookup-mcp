#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

const server = new McpServer({
  name: "nslookup",
  version: "1.0.0",
  description:
    "DNS and domain intelligence tools powered by nslookup.io. Look up any of 53 DNS record types, check DNS propagation across 18+ global servers, inspect SSL/TLS certificates, verify BIMI/VMC records, run security scans (SPF/DKIM/DMARC, cookies, headers), and test website availability from 7 locations worldwide (Amsterdam, Sydney, London, Frankfurt, Delhi, Warsaw, South Carolina). All checks are real-time, stateless, and require no authentication.",
});

registerTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
