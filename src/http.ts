#!/usr/bin/env node

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "./tools.js";

const PORT = parseInt(process.env.PORT || "3100", 10);

function createServer(): McpServer {
  const server = new McpServer({
    name: "nslookup",
    version: "1.0.0",
    description:
      "DNS and domain intelligence tools powered by nslookup.io. Look up any of 53 DNS record types, check DNS propagation across 18+ global servers, inspect SSL/TLS certificates, verify BIMI/VMC records, run security scans (SPF/DKIM/DMARC, cookies, headers), and test website availability from 7 locations worldwide (Amsterdam, Sydney, London, Frankfurt, Delhi, Warsaw, South Carolina). All checks are real-time, stateless, and require no authentication.",
  });
  registerTools(server);
  return server;
}

const app = express();
app.use(express.json());

// CORS — needed for browser-based MCP clients
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Mcp-Session-Id"
  );
  res.header("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Stateless MCP endpoint — new server + transport per request
app.post("/mcp", async (req, res) => {
  const server = createServer();
  try {
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
