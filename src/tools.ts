import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost } from "./api.js";

const DNS_RECORD_TYPES = [
  "A",
  "AAAA",
  "AFSDB",
  "APL",
  "AXFR",
  "CAA",
  "CDNSKEY",
  "CDS",
  "CERT",
  "CNAME",
  "CSYNC",
  "DHCID",
  "DLV",
  "DNAME",
  "DNSKEY",
  "DS",
  "EUI48",
  "EUI64",
  "HINFO",
  "HIP",
  "HTTPS",
  "IPSECKEY",
  "IXFR",
  "KEY",
  "KX",
  "LOC",
  "MX",
  "NAPTR",
  "NS",
  "NSEC",
  "NSEC3",
  "NSEC3PARAM",
  "NXT",
  "OPENPGPKEY",
  "OPT",
  "PTR",
  "RP",
  "RRSIG",
  "SIG",
  "SMIMEA",
  "SOA",
  "SPF",
  "SRV",
  "SSHFP",
  "SVCB",
  "TA",
  "TKEY",
  "TLSA",
  "TSIG",
  "TXT",
  "URI",
  "ZONEMD",
] as const;

const DNS_SERVERS = [
  "cloudflare",
  "cloudflare2",
  "google",
  "quad9",
  "opendns",
  "authoritative",
  "southafrica",
  "australia",
  "india",
  "thenetherlands",
  "canada",
  "usa",
  "brazil",
  "ukraine",
  "russia",
] as const;

function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function registerTools(server: McpServer): void {
  // Tool 1: DNS Lookup — get common records (A, AAAA, NS, MX, TXT, CNAME, SOA)
  server.tool(
    "dns_lookup",
    "Look up all common DNS records (A, AAAA, NS, MX, TXT, CNAME, SOA) for a domain. Returns results from a specified DNS server.",
    {
      domain: z.string().describe("Domain name to look up (e.g. example.com)"),
      server: z
        .enum(DNS_SERVERS)
        .optional()
        .describe(
          "DNS server to query. Default: cloudflare. Use 'authoritative' for the domain's own nameservers."
        ),
    },
    async ({ domain, server: dnsServer }) => {
      try {
        const params: Record<string, string> = { domain };
        if (dnsServer) params.server = dnsServer;

        const result = await apiGet("/v1/records", params);
        return { content: [{ type: "text", text: formatJson(result) }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 2: DNS Record — get a specific record type
  server.tool(
    "dns_record",
    "Look up a specific DNS record type for a domain. Supports 53 record types including A, AAAA, MX, TXT, CNAME, SOA, PTR, CAA, SRV, DNSKEY, DS, TLSA, HTTPS, SPF, and more.",
    {
      domain: z
        .string()
        .describe(
          "Domain name (or IP address for PTR lookups) to query (e.g. example.com)"
        ),
      type: z.enum(DNS_RECORD_TYPES).describe("DNS record type (e.g. A, MX, TXT, CNAME, SPF, HTTPS, DNSKEY)"),
      server: z
        .enum(DNS_SERVERS)
        .optional()
        .describe(
          "DNS server to query. Default: cloudflare. Use 'authoritative' for the domain's own nameservers."
        ),
    },
    async ({ domain, type, server: dnsServer }) => {
      try {
        const params: Record<string, string> = { domain, type };
        if (dnsServer) params.server = dnsServer;

        const result = await apiGet("/v1/records/other", params);
        return { content: [{ type: "text", text: formatJson(result) }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 3: DNS Propagation — check propagation across global servers
  server.tool(
    "dns_propagation",
    "Check DNS propagation for a domain across 18+ global DNS servers (Cloudflare, Google, Quad9, OpenDNS, regional servers, and authoritative nameservers). Shows if DNS changes have propagated worldwide.",
    {
      domain: z.string().describe("Domain name to check propagation for (e.g. example.com)"),
      recordType: z
        .enum(DNS_RECORD_TYPES)
        .describe("DNS record type to check (e.g. A, AAAA, MX, NS, TXT, CNAME)"),
    },
    async ({ domain, recordType }) => {
      try {
        const result = await apiPost(
          "/v1/propagation",
          { domain, recordType },
          { timeout: 45000 }
        );
        return { content: [{ type: "text", text: formatJson(result) }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 4: Webservers — get IP addresses (A + AAAA) for a domain
  server.tool(
    "webservers",
    "Get the IP addresses (both IPv4 and IPv6) for a domain by looking up A and AAAA records. Also returns the punycode and unicode domain representations.",
    {
      domain: z.string().describe("Domain name to look up IP addresses for (e.g. example.com)"),
    },
    async ({ domain }) => {
      try {
        const result = await apiPost("/v1/records/webservers", { domain });
        return { content: [{ type: "text", text: formatJson(result) }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 5: SSL Certificate Check — check SSL/TLS certificate for a domain
  server.tool(
    "ssl_certificate",
    "Check the SSL/TLS certificate for a domain. Returns issuer, expiry date, days until expiry, certificate chain validity, cipher strength, SAN domains, fingerprint, and TLS protocol version.",
    {
      domain: z.string().describe("Domain name to check SSL certificate for (e.g. github.com)"),
    },
    async ({ domain }) => {
      try {
        const result = await apiPost(
          "/v1/certificates/check",
          { domain },
          { prefix: "/portal-api", timeout: 15000 }
        );
        return { content: [{ type: "text", text: formatJson(result) }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 6: BIMI/VMC Check — check BIMI record and VMC certificate for a domain
  server.tool(
    "bimi_vmc",
    "Check BIMI (Brand Indicators for Message Identification) and VMC (Verified Mark Certificate) for a domain. Returns BIMI DNS record status, VMC certificate details, logo URL, trademark info, and expiry.",
    {
      domain: z.string().describe("Domain name to check BIMI/VMC for (e.g. google.com)"),
    },
    async ({ domain }) => {
      try {
        const result = await apiPost(
          "/v1/vmc/check",
          { domain },
          { prefix: "/portal-api", timeout: 15000 }
        );
        return { content: [{ type: "text", text: formatJson(result) }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 7: Security Scan — scan a domain for DNS and web security issues
  server.tool(
    "security_scan",
    "Run a security scan on a domain to detect DNS misconfigurations, missing SPF/DKIM/DMARC records, cookie security issues, and other web security vulnerabilities. Returns findings with severity levels (critical, high, medium, low, info).",
    {
      domain: z.string().describe("Domain name to security scan (e.g. example.com)"),
    },
    async ({ domain }) => {
      try {
        const result = await apiPost(
          "/v1/security-scan",
          { domain },
          { prefix: "/scanner-api", timeout: 60000 }
        );
        return { content: [{ type: "text", text: formatJson(result) }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 8: Uptime Check — perform a one-time HTTP availability check
  server.tool(
    "uptime_check",
    "Perform a one-time HTTP uptime check on a URL from a single location. Returns whether the site is up or down, HTTP status code, and response time in milliseconds. For multi-location checks, use uptime_check_multi instead.",
    {
      url: z.string().describe("Full URL to check (e.g. https://github.com)"),
      timeout: z
        .number()
        .optional()
        .describe("Timeout in milliseconds (default: 10000)"),
    },
    async ({ url, timeout: checkTimeout }) => {
      try {
        const body: Record<string, unknown> = { url };
        if (checkTimeout) body.timeout = checkTimeout;

        const result = await apiPost(
          "/v1/uptime/check",
          body,
          { prefix: "/portal-api", timeout: 30000 }
        );
        return { content: [{ type: "text", text: formatJson(result) }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 9: Multi-Location Uptime Check — check from 7 global locations
  server.tool(
    "uptime_check_multi",
    "Check if a website is up or down from 7 global locations simultaneously: Amsterdam, Sydney, London, Frankfurt, Delhi, Warsaw, and South Carolina. Returns status, response time, and HTTP status code for each location.",
    {
      url: z.string().describe("Full URL to check (e.g. https://github.com)"),
      timeout: z
        .number()
        .optional()
        .describe("Timeout in milliseconds (default: 30000)"),
    },
    async ({ url, timeout: checkTimeout }) => {
      try {
        const body: Record<string, unknown> = { url };
        if (checkTimeout) body.timeout = checkTimeout;

        const result = await apiPost(
          "/v1/uptime/check-multi",
          body,
          { prefix: "/portal-api", timeout: 60000 }
        );
        return { content: [{ type: "text", text: formatJson(result) }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
