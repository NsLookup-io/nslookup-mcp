# @nslookup-io/mcp-server

MCP (Model Context Protocol) server for DNS lookups, propagation checks, and domain intelligence — powered by [nslookup.io](https://nslookup.io).

Lets AI assistants like Claude perform real-time DNS queries across 53 record types and 18+ global DNS servers.

## Tools

| Tool | Description |
|------|-------------|
| `dns_lookup` | Look up all common DNS records (A, AAAA, NS, MX, TXT, CNAME, SOA) for a domain |
| `dns_record` | Look up a specific DNS record type — supports all 53 types (HTTPS, DNSKEY, TLSA, SPF, etc.) |
| `dns_propagation` | Check DNS propagation across 18+ global servers (Cloudflare, Google, Quad9, regional, authoritative) |
| `webservers` | Get IPv4 and IPv6 addresses for a domain |

### Supported DNS Record Types

A, AAAA, AFSDB, APL, AXFR, CAA, CDNSKEY, CDS, CERT, CNAME, CSYNC, DHCID, DLV, DNAME, DNSKEY, DS, EUI48, EUI64, HINFO, HIP, HTTPS, IPSECKEY, IXFR, KEY, KX, LOC, MX, NAPTR, NS, NSEC, NSEC3, NSEC3PARAM, NXT, OPENPGPKEY, OPT, PTR, RP, RRSIG, SIG, SMIMEA, SOA, SPF, SRV, SSHFP, SVCB, TA, TKEY, TLSA, TSIG, TXT, URI, ZONEMD

### DNS Servers

`cloudflare`, `google`, `quad9`, `opendns`, `authoritative`, and regional servers in South Africa, Australia, India, Netherlands, Canada, USA, Brazil, Ukraine, Russia.

## Setup

### Claude Desktop

Add to your `claude_desktop_config.json`:

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

```bash
claude mcp add nslookup -- npx -y @nslookup-io/mcp-server
```

### Manual / Local

```bash
git clone https://github.com/nslookup-io/nslookup-mcp.git
cd nslookup-mcp
npm install
npm run build
npm start
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `NSLOOKUP_API_URL` | `https://nslookup.io/api` | API base URL |

## Example Prompts

Once configured, you can ask Claude things like:

- "What are the DNS records for github.com?"
- "Check the MX records for google.com"
- "Has the DNS propagated for my-domain.com A record?"
- "What IP addresses does cloudflare.com resolve to?"
- "Show me the DNSKEY records for example.com"
- "Check the SPF record for amazon.com"
- "What's the HTTPS record for cloudflare.com?"
- "Look up the CAA records for github.com using Google DNS"
- "Check DNS propagation for example.com NS records across all global servers"

## License

MIT
