<p align="center">
  <a href="https://nslookup.io">
    <img src="https://www.nslookup.io/img/logo.svg" alt="NSLookup.io" width="300" />
  </a>
</p>

<p align="center">
  <strong>MCP Server for nslookup.io</strong><br/>
  DNS lookups, SSL certificate checks, security scanning, and domain intelligence — via the Model Context Protocol.
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

### Security & Certificate Tools

| Tool | Description |
|------|-------------|
| `ssl_certificate` | Check SSL/TLS certificate — issuer, expiry, chain validity, cipher strength, SAN domains, TLS version |
| `bimi_vmc` | Check BIMI record and VMC (Verified Mark Certificate) — logo URL, trademark info, certificate expiry |
| `security_scan` | Scan a domain for security issues — SPF/DKIM/DMARC, cookie security, DNS misconfigurations |
| `uptime_check` | One-time HTTP uptime check — status, response time, HTTP status code |
| `uptime_check_multi` | Check if a site is up from 7 global locations — Amsterdam, Sydney, London, Frankfurt, Delhi, Warsaw, South Carolina |

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

Done — Claude can now use all 8 DNS and security tools. Try asking _"Check the SSL certificate for github.com"_.

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
- "Check the SSL certificate for github.com"
- "Does google.com have a BIMI record?"
- "Run a security scan on example.com"
- "Is https://cloudflare.com up right now?"
- "Check if github.com is accessible from all global locations"
- "Check DNS propagation for example.com NS records across all global servers"

## Feedback

We'd love to hear from you! At [nslookup.io](https://nslookup.io), we're building a fast, reliable, and free DNS lookup tool and monitoring platform for everyone — from developers and sysadmins to everyday internet users.

Your feedback is what helps us improve. Whether you've spotted a bug, have a feature idea, or just want to share your thoughts — we're listening. [Contact us](https://nslookup.io/contact-us/).

## License

Apache 2.0
