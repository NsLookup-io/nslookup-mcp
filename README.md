<p align="center">
  <a href="https://nslookup.io">
    <img src="https://www.nslookup.io/img/logo.svg" alt="NSLookup.io" width="300" />
  </a>
</p>

<p align="center">
  <strong>MCP Server for nslookup.io</strong><br/>
  DNS lookups, SSL certificate checks, security scanning, GEO (AI readiness) scoring, and domain intelligence — via the Model Context Protocol.
</p>

<p align="center">
  <a href="https://nslookup.io">Website</a> · <a href="https://docs.nslookup.io">API Docs</a> · <a href="https://www.npmjs.com/package/@nslookup-io/mcp-server">npm</a> · <a href="https://nslookup.io/contact-us/">Contact</a>
</p>

## Tools

### DNS Tools

| Tool | Description |
|------|-------------|
| `dns_lookup` | Look up all common DNS records (A, AAAA, NS, MX, TXT, CNAME, SOA) for a domain |
| `dns_record` | Look up a specific DNS record type — supports all 53 types (HTTPS, DNSKEY, TLSA, SPF, etc.) |
| `dns_propagation` | Check DNS propagation across 18+ global servers (Cloudflare, Google, Quad9, regional, authoritative) |
| `webservers` | Get IPv4 and IPv6 addresses for a domain |
| `dns_change_review` | **NEW** — Review proposed DNS changes before applying them: diff vs current DNS, rule-based findings with fixes, and a 0–100 risk score |

### Domain Intelligence Tools

| Tool | Description |
|------|-------------|
| `rdap_lookup` | **NEW** — Registration data (RDAP) for an IP, AS number, or domain — owner org, network range, RIR, contacts, dates |
| `hosting_report` | **NEW** — Who hosts a website: hosting provider, CDN/proxy, DNS provider, mail servers, server location, SSL issuer |
| `status_page` | **NEW** — Read a public status page (by slug or custom domain): overall status, components, active incidents |

### DNS Health & Security Tools

| Tool | Description |
|------|-------------|
| `dns_health` | **NEW** — Run a DNS health audit (39 checks across DNSSEC, MX, hygiene, TTL, nameservers, CAA, operational maturity) with severity-weighted scoring |
| `ssl_certificate` | Check SSL/TLS certificate — issuer, expiry, chain validity, cipher strength, SAN domains, TLS version |
| `bimi_vmc` | Check BIMI record and VMC (Verified Mark Certificate) — logo URL, trademark info, certificate expiry |
| `bimi_check` | **NEW** — Check only the BIMI DNS record (faster — skips the VMC certificate fetch) |
| `security_scan` | Scan a domain for security issues — SPF/DKIM/DMARC, cookie security, DNS misconfigurations |
| `domain_scanner` | **NEW** — Scan a domain's email security posture (SPF, DKIM, DMARC, BIMI) with per-indicator scores |
| `uptime_check` | One-time HTTP uptime check — status, response time, HTTP status code |
| `uptime_check_multi` | Check if a site is up from 7 global locations — Amsterdam, Sydney, London, Frankfurt, Delhi, Warsaw, South Carolina |

### GEO (AI Readiness) Tools

| Tool | Description |
|------|-------------|
| `geo_checker` | Check a domain's GEO (Generative Engine Optimization) score — AI crawler access, structured data, entity signals, content extractability, and prioritized recommendations |

### Your Account (Sign-in) Tools

**NEW in v1.5.0** — six `my_` tools read your own [NsLookup.io monitoring account](https://www.nslookup.io/portal/) (uptime, DNS, WHOIS, SSL, propagation, BIMI/VMC monitors). They are always listed, but require authentication to call.

| Tool | Description |
|------|-------------|
| `my_overview` | Account health snapshot — aggregated 0–100 score with per-subsystem breakdown, plus your limits/quota |
| `my_monitors` | List all your monitors across every type (uptime, API, DNS, WHOIS, propagation, certificates, VMC) |
| `my_incidents` | Open (or all recent) incidents across all monitoring types, with a per-status/per-source summary |
| `my_uptime_history` | Uptime + response-time history for one monitor (by id or URL) over a configurable window |
| `my_dns_changes` | Recent DNS changes on your monitored domains with their risk reviews (0–100 score, severity counts) |
| `my_certificates` | SSL certificate expiry overview — alert-level counts and certificates sorted by soonest expiry |

#### How authentication works

- **Hosted connector (`https://mcp.nslookup.io/mcp`)** — OAuth 2.1. The server is an OAuth *resource server*: calling a `my_` tool without credentials returns a `401` with a `WWW-Authenticate` challenge pointing at `/.well-known/oauth-protected-resource`, and OAuth-capable MCP clients (Claude, etc.) then walk you through sign-in against the NsLookup.io identity provider. Everything else keeps working anonymously.
- **API token** — instead of OAuth you can send a personal access token (created in the portal under *API Tokens*, format `nslk_...`) as `Authorization: Bearer nslk_...`.
- **Local / stdio** — no OAuth flow; set the `NSLOOKUP_API_TOKEN` environment variable to an `nslk_...` token (or a raw access token) and the `my_` tools pick it up.

```json
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

## Setup

### Claude Desktop — Remote Connector (Recommended)

The easiest way to get started. No installation required.

1. Open **Claude Desktop**
2. Go to **Settings** (click your profile icon or use the menu)
3. In the left sidebar, click **Connectors**
4. Click **"Add custom connector"** at the bottom
5. Enter the following:
   - **Name:** `nslookup`
   - **URL:** `https://mcp.nslookup.io/mcp`
6. Click **Add** to confirm

Done — Claude can now use all 17 public DNS, security, and health tools. Try asking _"Run a DNS health check on github.com"_. The first time you use a `my_` account tool, Claude will prompt you to sign in to your NsLookup.io account.

### ChatGPT

1. Open **ChatGPT** (desktop app or web)
2. Go to **Settings** (click your profile icon)
3. Navigate to **Connected apps** (or **Tools & integrations**)
4. Click **"Add custom integration"** or **"Add MCP server"**
5. Enter the following:
   - **Name:** `nslookup`
   - **URL:** `https://mcp.nslookup.io/mcp`
6. Save the connection

Done — ChatGPT can now perform DNS lookups, certificate checks, and security scans.

### Any MCP Client (Remote)

Any MCP-compatible client that supports Streamable HTTP transport can connect using:

```
https://mcp.nslookup.io/mcp
```

No API key or authentication required for the 17 public tools. The six `my_` account tools respond with a standard OAuth 2.1 challenge (RFC 9728 protected-resource metadata), so OAuth-capable clients offer sign-in automatically; alternatively pass `Authorization: Bearer nslk_...` with an API token.

---

### Claude Desktop — Local (via config JSON)

If you prefer running the server locally (requires Node.js 18+), add to your `claude_desktop_config.json`:

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

### Claude Code

Available globally (all projects):

```bash
claude mcp add nslookup --scope user -- npx -y @nslookup-io/mcp-server
```

Or for a specific project only:

```bash
claude mcp add nslookup --scope project -- npx -y @nslookup-io/mcp-server
```

### Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json`):

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

### Windsurf

Add to your Windsurf MCP config (`~/.codeium/windsurf/mcp_config.json`):

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

## Supported DNS Record Types

A, AAAA, AFSDB, APL, AXFR, CAA, CDNSKEY, CDS, CERT, CNAME, CSYNC, DHCID, DLV, DNAME, DNSKEY, DS, EUI48, EUI64, HINFO, HIP, HTTPS, IPSECKEY, IXFR, KEY, KX, LOC, MX, NAPTR, NS, NSEC, NSEC3, NSEC3PARAM, NXT, OPENPGPKEY, OPT, PTR, RP, RRSIG, SIG, SMIMEA, SOA, SPF, SRV, SSHFP, SVCB, TA, TKEY, TLSA, TSIG, TXT, URI, ZONEMD

## DNS Servers

`cloudflare`, `google`, `quad9`, `opendns`, `authoritative`, and regional servers in South Africa, Australia, India, Netherlands, Canada, USA, Brazil, Ukraine, Russia.

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `NSLOOKUP_API_URL` | `https://www.nslookup.io` | Base URL for the nslookup.io API |
| `NSLOOKUP_API_TOKEN` | — | Credential for the `my_` account tools when running locally (stdio): an `nslk_...` API token or a raw access token |
| `MCP_RESOURCE_URL` | `https://mcp.nslookup.io` | (HTTP server) Public URL of this resource server, used in OAuth metadata |
| `KEYCLOAK_ISSUER` | `https://auth.nslookup.io/realms/nslookup-io` | (HTTP server) OAuth issuer used to validate sign-in tokens |

## Example Prompts

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
- "Does easydmarc.com have a BIMI record?"
- "Scan example.com's email security (SPF, DKIM, DMARC)"
- "Is the nslookup-io status page reporting any incidents?"

And once signed in to your NsLookup.io account:

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
