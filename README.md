<p align="center">
  <a href="https://nslookup.io">
    <img src="https://www.nslookup.io/img/logo.svg" alt="NSLookup.io" width="300" />
  </a>
</p>

<p align="center">
  <strong>MCP Server for nslookup.io</strong><br/>
  DNS lookups, SSL certificate checks, security scanning, GEO (AI readiness) scoring, domain intelligence, and your own monitoring account — via the Model Context Protocol.
</p>

<p align="center">
  <a href="https://nslookup.io">Website</a> · <a href="https://docs.nslookup.io">API Docs</a> · <a href="https://www.npmjs.com/package/@nslookup-io/mcp-server">npm</a> · <a href="https://nslookup.io/contact-us/">Contact</a>
</p>

## What is this?

The nslookup.io MCP server gives any MCP-capable AI assistant (Claude, ChatGPT, Cursor, Windsurf, …) direct access to nslookup.io's DNS, certificate, security, and monitoring tools. Ask in plain language — _"Run a DNS health check on github.com"_ or _"Which of my SSL certificates expire soonest?"_ — and the assistant calls the right tool for you.

**23 tools total, in two groups:**

- **17 public tools** — DNS, SSL, security, GEO, and domain-intelligence lookups that work **anonymously**, with no account and no API key.
- **6 `my_` account tools** — read your own [nslookup.io monitoring account](https://www.nslookup.io/portal/) (uptime, DNS, WHOIS, SSL, propagation, BIMI/VMC monitors). These are always listed but require **signing in**.

Jump to [Connect](#connect) to get set up, or the [Tool reference](#tool-reference) for the full list.

## Connect

There are two ways to connect. **Pick one** — see the [note below](#-use-only-one-nslookup-entry).

| | **Hosted (recommended)** | **Local (npx / stdio)** |
|---|---|---|
| Endpoint | `https://mcp.nslookup.io/mcp` | `npx -y @nslookup-io/mcp-server` |
| Transport | Streamable HTTP (remote) | stdio (runs on your machine) |
| Install | Nothing to install | Requires Node.js 18+ |
| 17 public tools | ✅ Anonymous | ✅ Anonymous |
| 6 `my_` account tools | ✅ **Browser sign-in (OAuth)** on first use | ⚠️ Needs a `NSLOOKUP_API_TOKEN` (not generally available yet) |

**Use the hosted endpoint if you want your own monitoring data** — it's the only mode where the `my_` account tools sign in for you, right in the browser. The local mode is great for the 17 public tools with zero setup.

### Hosted (recommended)

The hosted endpoint is a remote Streamable-HTTP server. Public tools work immediately; the first time you call a `my_` tool, an OAuth-capable client opens a browser window to sign in to your nslookup.io account (see [Signing in](#signing-in)).

**Claude Code (CLI)**

```bash
claude mcp add --transport http nslookup https://mcp.nslookup.io/mcp
```

**Claude Desktop / claude.ai (custom connector)**

1. Open **Settings → Connectors**
2. Click **Add custom connector**
3. Name: `nslookup` — URL: `https://mcp.nslookup.io/mcp`
4. Click **Add**

Or drop it into an `.mcp.json` (project) / your client's MCP config:

```json
{
  "mcpServers": {
    "nslookup": {
      "type": "http",
      "url": "https://mcp.nslookup.io/mcp"
    }
  }
}
```

**ChatGPT**

1. Open **Settings → Connected apps** (or **Tools & integrations**)
2. Click **Add custom integration** / **Add MCP server**
3. Name: `nslookup` — URL: `https://mcp.nslookup.io/mcp`
4. Save

**Cursor / Windsurf (and any HTTP-capable client)**

Add to your MCP config (`.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json`, etc.):

```json
{
  "mcpServers": {
    "nslookup": {
      "type": "http",
      "url": "https://mcp.nslookup.io/mcp"
    }
  }
}
```

### Local (npx / stdio)

Runs the server on your machine over stdio. All **17 public tools** work with no auth. (The `my_` account tools need a `NSLOOKUP_API_TOKEN` on this transport — see [Signing in](#signing-in) — so for account data, prefer the hosted endpoint.)

**Claude Code (CLI)**

```bash
# Global (all projects)
claude mcp add nslookup --scope user -- npx -y @nslookup-io/mcp-server

# Or for a single project
claude mcp add nslookup --scope project -- npx -y @nslookup-io/mcp-server
```

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nslookup": {
      "command": "npx",
      "args": ["-y", "@nslookup-io/mcp-server"]
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`) / **Windsurf** (`~/.codeium/windsurf/mcp_config.json`):

```json
{
  "mcpServers": {
    "nslookup": {
      "command": "npx",
      "args": ["-y", "@nslookup-io/mcp-server"]
    }
  }
}
```

### ⚠️ Use only ONE nslookup entry

Configure **either** the hosted entry **or** the local entry — not both. If two MCP servers named `nslookup` are registered at once (e.g. a hosted connector plus a local npx entry), tool calls can route to the wrong server and behave unpredictably. Pick the mode you want and remove the other.

## Signing in

- **17 public tools** — no account, no key, nothing to sign in for. They call public, stateless, no-auth endpoints.
- **6 `my_` account tools** — read your private monitoring data, so they require credentials:
  - **Hosted endpoint → browser OAuth (recommended).** The server is an OAuth 2.1 resource server. Calling a `my_` tool without credentials returns a `401` with a `WWW-Authenticate` challenge, and OAuth-capable clients (Claude web/desktop, Claude Code, …) then walk you through a browser sign-in against the nslookup.io identity provider (Keycloak). Sign in once and the client remembers it. Everything else keeps working anonymously — you only sign in when you first reach for your own data.
  - **API token (advanced / local).** Instead of OAuth you can pass a personal access token (created in the portal under *API Tokens*, format `nslk_...`) as `Authorization: Bearer nslk_...` on the hosted endpoint, or via the `NSLOOKUP_API_TOKEN` environment variable on the local/stdio transport. Note: personal access tokens are **not generally available yet**, so for account data today the hosted browser sign-in is the way.

```jsonc
// Local/stdio with an API token (when available):
{
  "mcpServers": {
    "nslookup": {
      "command": "npx",
      "args": ["-y", "@nslookup-io/mcp-server"],
      "env": { "NSLOOKUP_API_TOKEN": "nslk_..." }
    }
  }
}
```

## Tool reference

### Public tools (17 — anonymous)

#### DNS

| Tool | Description |
|------|-------------|
| `dns_lookup` | Look up all common DNS records (A, AAAA, NS, MX, TXT, CNAME, SOA) for a domain |
| `dns_record` | Look up a specific DNS record type — supports all 53 types (HTTPS, DNSKEY, TLSA, SPF, etc.) |
| `dns_propagation` | Check DNS propagation across 18+ global servers (Cloudflare, Google, Quad9, regional, authoritative) |
| `webservers` | Get IPv4 and IPv6 addresses for a domain |
| `dns_change_review` | Review proposed DNS changes before applying them: diff vs current DNS, rule-based findings with fixes, and a 0–100 risk score |

#### Domain intelligence

| Tool | Description |
|------|-------------|
| `rdap_lookup` | Registration data (RDAP) for an IP, AS number, or domain — owner org, network range, RIR, contacts, dates |
| `hosting_report` | Who hosts a website: hosting provider, CDN/proxy, DNS provider, mail servers, server location, SSL issuer |
| `status_page` | Read a public status page (by slug or custom domain): overall status, components, active incidents |

#### DNS health & security

| Tool | Description |
|------|-------------|
| `dns_health` | Run a DNS health audit (39 checks across DNSSEC, MX, hygiene, TTL, nameservers, CAA, operational maturity) with severity-weighted scoring |
| `ssl_certificate` | Check SSL/TLS certificate — issuer, expiry, chain validity, cipher strength, SAN domains, TLS version |
| `bimi_vmc` | Check BIMI record and VMC (Verified Mark Certificate) — logo URL, trademark info, certificate expiry |
| `bimi_check` | Check only the BIMI DNS record (faster — skips the VMC certificate fetch) |
| `security_scan` | Scan a domain for security issues — SPF/DKIM/DMARC, cookie security, DNS misconfigurations |
| `domain_scanner` | Scan a domain's email security posture (SPF, DKIM, DMARC, BIMI) with per-indicator scores |
| `uptime_check` | One-time HTTP uptime check — status, response time, HTTP status code |
| `uptime_check_multi` | Check if a site is up from 7 global locations — Amsterdam, Sydney, London, Frankfurt, Delhi, Warsaw, South Carolina |

#### GEO (AI readiness)

| Tool | Description |
|------|-------------|
| `geo_checker` | Check a domain's GEO (Generative Engine Optimization) score — AI crawler access, structured data, entity signals, content extractability, and prioritized recommendations |

### Account tools (6 — require sign-in)

These `my_` tools read your own [nslookup.io monitoring account](https://www.nslookup.io/portal/). They are always listed but require [signing in](#signing-in) to call.

| Tool | Description |
|------|-------------|
| `my_overview` | Account health snapshot — aggregated 0–100 score with per-subsystem breakdown, plus your limits/quota |
| `my_monitors` | List all your monitors across every type (uptime, API, DNS, WHOIS, propagation, certificates, VMC) |
| `my_incidents` | Open (or all recent) incidents across all monitoring types, with a per-status/per-source summary |
| `my_uptime_history` | Uptime + response-time history for one monitor (by id or URL) over a configurable window |
| `my_dns_changes` | Recent DNS changes on your monitored domains with their risk reviews (0–100 score, severity counts) |
| `my_certificates` | SSL certificate expiry overview — alert-level counts and certificates sorted by soonest expiry |

## Supported DNS record types

A, AAAA, AFSDB, APL, AXFR, CAA, CDNSKEY, CDS, CERT, CNAME, CSYNC, DHCID, DLV, DNAME, DNSKEY, DS, EUI48, EUI64, HINFO, HIP, HTTPS, IPSECKEY, IXFR, KEY, KX, LOC, MX, NAPTR, NS, NSEC, NSEC3, NSEC3PARAM, NXT, OPENPGPKEY, OPT, PTR, RP, RRSIG, SIG, SMIMEA, SOA, SPF, SRV, SSHFP, SVCB, TA, TKEY, TLSA, TSIG, TXT, URI, ZONEMD

## DNS servers

`cloudflare`, `google`, `quad9`, `opendns`, `authoritative`, and regional servers in South Africa, Australia, India, Netherlands, Canada, USA, Brazil, Ukraine, Russia.

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `NSLOOKUP_API_URL` | `https://www.nslookup.io` | Base URL for the nslookup.io API |
| `NSLOOKUP_API_TOKEN` | — | Credential for the `my_` account tools when running locally (stdio): an `nslk_...` API token or a raw access token |
| `MCP_RESOURCE_URL` | *(request-derived)* | (HTTP server) Explicit public origin of this resource server, used as the `issuer`/`resource`/`authorization_servers` value in OAuth metadata. When unset, the origin is derived from the incoming request (`X-Forwarded-Proto` + host). Set it to the fixed public URL (e.g. `https://mcp.nslookup.io`) in production. |
| `KEYCLOAK_ISSUER` | `https://auth.nslookup.io/realms/nslookup-io` | (HTTP server) OAuth token issuer used to validate sign-in JWTs (JWKS, issuer, exp) |
| `KEYCLOAK_REALM_URL` | *(= `KEYCLOAK_ISSUER`)* | (HTTP server) Keycloak realm base URL whose `/.well-known/openid-configuration` supplies the real `authorization_endpoint`/`token_endpoint`. For Keycloak this equals the issuer, so it rarely needs setting. |
| `KEYCLOAK_CLIENT_ID` | `nslookup-io-mcp` | (HTTP server) The pre-registered **public** Keycloak client id returned by the DCR shim. This client must already exist in the realm; no Keycloak DCR is enabled. |

<details>
<summary>How hosted OAuth sign-in works under the hood</summary>

The hosted server is an OAuth 2.1 *resource server*: calling a `my_` tool without credentials returns a `401` with a `WWW-Authenticate` challenge pointing at `/.well-known/oauth-protected-resource`, and OAuth-capable MCP clients then walk you through sign-in against the nslookup.io identity provider.

Sign-in works for DCR-only clients (Claude web/desktop, Claude Code) **without** enabling Keycloak DCR. The server also acts as its own OAuth *authorization server* for metadata: `GET /.well-known/oauth-authorization-server` returns an `issuer` equal to this server's own origin, with `authorization_endpoint`/`token_endpoint` pointing at the **real Keycloak** endpoints (fetched from the realm's OpenID configuration, cached with a static fallback) and `registration_endpoint` set to `<origin>/register`. Because the advertised `issuer` is this server, clients that compute `{issuer}/register` hit our **Dynamic Client Registration (DCR) shim** at `POST /register` (also `POST /oauth/register`), which ignores the submitted metadata and returns one **pre-registered public Keycloak client** (`KEYCLOAK_CLIENT_ID`, default `nslookup-io-mcp`) with `token_endpoint_auth_method: "none"`, echoing back the requested redirect URIs. The browser sign-in and the PKCE `code`→token exchange happen directly on Keycloak. A public client with `KEYCLOAK_CLIENT_ID` must already exist in the realm; no Keycloak DCR endpoint is used or exposed.

</details>

## Example prompts

Once connected, try asking your AI assistant:

- "What are the DNS records for github.com?"
- "Check the MX records for google.com"
- "Has the DNS propagated for my-domain.com A record?"
- "What IP addresses does cloudflare.com resolve to?"
- "Show me the DNSKEY records for example.com"
- "Check the SPF record for amazon.com"
- "Run a DNS health check on example.com"
- "What's the DNSSEC status of cloudflare.com?"
- "Check the DNS health score for my-domain.com — are there any critical issues?"
- "Check the SSL certificate for github.com"
- "Does google.com have a BIMI record?"
- "Run a security scan on example.com"
- "Is https://cloudflare.com up right now?"
- "Check if github.com is accessible from all global locations"
- "Check DNS propagation for example.com NS records across all global servers"
- "Check the GEO score for github.com"
- "Is example.com optimized for AI search engines?"
- "Which AI crawlers does cloudflare.com block?"
- "Who owns the IP 8.8.8.8?"
- "Look up registration data for AS13335"
- "Who hosts github.com?"
- "Review this DNS change for example.com before I apply it: ..."
- "Scan example.com's email security (SPF, DKIM, DMARC)"
- "Is the nslookup-io status page reporting any incidents?"

And once signed in to your nslookup.io account:

- "How healthy is my monitoring right now?"
- "List all my monitors — anything down or expiring?"
- "Do I have any open incidents?"
- "Show me the uptime history for https://myapp.com over the last 48 hours"
- "Any risky DNS changes on my domains recently?"
- "Which of my SSL certificates expire soonest?"

## Feedback

We'd love to hear from you! At [nslookup.io](https://nslookup.io), we're building a fast, reliable, and free DNS lookup tool and monitoring platform for everyone — from developers and sysadmins to everyday internet users.

Your feedback is what helps us improve. Whether you've spotted a bug, have a feature idea, or just want to share your thoughts — we're listening. [Contact us](https://nslookup.io/contact-us/).

## License

Apache 2.0
