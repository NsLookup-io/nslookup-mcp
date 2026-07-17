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

Done — Claude can now use all 17 DNS, security, and health tools. Try asking _"Run a DNS health check on github.com"_.

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

No API key or authentication required.

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

## Feedback

We'd love to hear from you! At [nslookup.io](https://nslookup.io), we're building a fast, reliable, and free DNS lookup tool and monitoring platform for everyone — from developers and sysadmins to everyday internet users.

Your feedback is what helps us improve. Whether you've spotted a bug, have a feature idea, or just want to share your thoughts — we're listening. [Contact us](https://nslookup.io/contact-us/).

## License

Apache 2.0
