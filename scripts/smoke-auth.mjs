#!/usr/bin/env node
/**
 * Smoke test for the OAuth resource-server plumbing + portal (my_) tools.
 *
 * Spins the built HTTP server (dist/http.js) on a random port and asserts:
 *  (a) anonymous tools/list returns all 23 tools, my_ ones carrying the
 *      sign-in note in their descriptions;
 *  (b) a portal tool call without credentials → HTTP 401 + WWW-Authenticate
 *      challenge (and the same with an invalid JWT), while tools/list stays
 *      anonymous-accessible with a garbage token;
 *  (c) both well-known protected-resource metadata routes serve the RFC 9728
 *      document;
 *  (d) a public tool (rdap_lookup 8.8.8.8) still works anonymously (live call).
 *
 * Usage: npm run build && node scripts/smoke-auth.mjs
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3100 + Math.floor(Math.random() * 2000);
const BASE = `http://127.0.0.1:${PORT}`;

let failures = 0;
function check(name, cond, detail = "") {
  const status = cond ? "PASS" : "FAIL";
  if (!cond) failures++;
  console.log(`  [${status}] ${name}${cond ? "" : detail ? ` — ${detail}` : ""}`);
}

/** POST a JSON-RPC message to /mcp; returns {status, headers, body, rpc}. */
async function rpc(message, headers = {}) {
  const res = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(message),
  });
  const text = await res.text();
  let parsed = null;
  const ct = res.headers.get("content-type") || "";
  try {
    if (ct.includes("text/event-stream")) {
      const dataLine = text
        .split("\n")
        .filter((l) => l.startsWith("data: "))
        .pop();
      if (dataLine) parsed = JSON.parse(dataLine.slice(6));
    } else if (text) {
      parsed = JSON.parse(text);
    }
  } catch {
    /* leave parsed null */
  }
  return { status: res.status, headers: res.headers, rpc: parsed, text };
}

const toolsList = (headers = {}) =>
  rpc({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }, headers);

const toolCall = (name, args = {}, headers = {}) =>
  rpc(
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } },
    headers
  );

async function waitForHealth(proc) {
  for (let i = 0; i < 50; i++) {
    if (proc.exitCode !== null) throw new Error("server exited early");
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("server did not become healthy");
}

const server = spawn("node", [path.join(root, "dist/http.js")], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

try {
  await waitForHealth(server);
  console.log(`Server up on :${PORT}\n`);

  // (c) well-known metadata — both paths
  console.log("(c) protected-resource metadata");
  for (const suffix of ["", "/mcp"]) {
    const res = await fetch(`${BASE}/.well-known/oauth-protected-resource${suffix}`);
    const meta = res.ok ? await res.json() : {};
    check(`GET well-known${suffix || " (bare)"} → 200`, res.status === 200);
    check(
      `  shape${suffix}`,
      typeof meta.resource === "string" &&
        Array.isArray(meta.authorization_servers) &&
        meta.authorization_servers[0]?.includes("/realms/") &&
        Array.isArray(meta.bearer_methods_supported) &&
        meta.bearer_methods_supported.includes("header") &&
        typeof meta.resource_documentation === "string",
      JSON.stringify(meta)
    );
  }

  // (a) anonymous tools/list
  console.log("(a) anonymous tools/list");
  const list = await toolsList();
  const tools = list.rpc?.result?.tools ?? [];
  check("HTTP 200", list.status === 200, `got ${list.status}`);
  check(`23 tools listed`, tools.length === 23, `got ${tools.length}`);
  const myTools = tools.filter((t) => t.name.startsWith("my_"));
  check("6 my_ tools", myTools.length === 6, `got ${myTools.length}`);
  check(
    "my_ descriptions carry sign-in note",
    myTools.length > 0 &&
      myTools.every((t) =>
        t.description.endsWith(
          "Requires sign-in to your NsLookup.io account (or an API token)."
        )
      )
  );

  // (b) portal tool call without auth → 401 challenge
  console.log("(b) auth challenge");
  const denied = await toolCall("my_overview");
  check("HTTP 401", denied.status === 401, `got ${denied.status}`);
  const www = denied.headers.get("www-authenticate") || "";
  check(
    "WWW-Authenticate → resource metadata",
    www.startsWith("Bearer") &&
      www.includes('resource_metadata="') &&
      www.includes("/.well-known/oauth-protected-resource"),
    www
  );
  check(
    "JSON-RPC error body",
    denied.rpc?.jsonrpc === "2.0" &&
      typeof denied.rpc?.error?.message === "string" &&
      denied.rpc.error.message.toLowerCase().includes("sign in"),
    denied.text.slice(0, 200)
  );

  const badJwt = "eyJhbGciOiJSUzI1NiJ9.eyJmYWtlIjp0cnVlfQ.c2ln";
  const deniedJwt = await toolCall(
    "my_overview",
    {},
    { Authorization: `Bearer ${badJwt}` }
  );
  check("invalid JWT on my_ call → 401", deniedJwt.status === 401, `got ${deniedJwt.status}`);

  const listBadJwt = await toolsList({ Authorization: `Bearer ${badJwt}` });
  check(
    "invalid JWT still anonymous for tools/list",
    listBadJwt.status === 200 &&
      (listBadJwt.rpc?.result?.tools ?? []).length === 23,
    `got ${listBadJwt.status}`
  );

  // PAT pass-through: nslk_ credential must NOT be challenged at the MCP
  // layer (portal-api validates it — a fake one fails upstream instead).
  const pat = await toolCall("my_overview", {}, { Authorization: "Bearer nslk_smoketest" });
  check(
    "nslk_ PAT passes the MCP gate (no 401 challenge)",
    pat.status === 200,
    `got ${pat.status}`
  );

  // (d) public tool still callable anonymously (live upstream call)
  console.log("(d) public tool anonymous (live)");
  const pub = await toolCall("rdap_lookup", { query: "8.8.8.8" });
  const pubText = pub.rpc?.result?.content?.[0]?.text ?? "";
  check(
    "rdap_lookup 8.8.8.8 works",
    pub.status === 200 && !pub.rpc?.result?.isError && pubText.includes("8.8.8"),
    `status ${pub.status}: ${pubText.slice(0, 120)}`
  );
} catch (err) {
  failures++;
  console.error("Smoke run error:", err);
} finally {
  server.kill("SIGINT");
}

console.log(failures === 0 ? "\nAll smoke checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
