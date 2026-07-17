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

/**
 * Trim the (large) public status page payload down to the useful summary:
 * page identity, overall status, per-component status, and active incidents.
 * Per-day history bars and per-location breakdowns are dropped.
 */
function summarizeStatusPage(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const page = data as Record<string, unknown>;
  if (!Array.isArray(page.components)) return data;

  const components = (page.components as Array<Record<string, unknown>>).map(
    (c) => ({
      name: c.name,
      status: c.status,
      uptimePercentage: c.uptimePercentage,
      avgResponseMs: c.avgResponseMs,
      group: c.group,
      isExternal: c.isExternal,
    })
  );

  const incidents = Array.isArray(page.incidents)
    ? (page.incidents as Array<Record<string, unknown>>)
    : [];
  const activeIncidents = incidents
    .filter((i) => i.status !== "resolved" && !i.resolvedAt)
    .map((i) => ({
      title: i.title,
      status: i.status,
      impact: i.impact,
      isMaintenance: i.isMaintenance,
      startedAt: i.startedAt,
      affectedComponents: i.affectedComponents,
    }));

  return {
    name: page.name,
    description: page.description,
    verifiedDomain: page.verifiedDomain,
    overallStatus: page.overallStatus,
    statusMessage: page.statusMessage,
    overallUptimePercentage: page.overallUptimePercentage,
    components,
    activeIncidents,
    recentResolvedIncidents: incidents.length - activeIncidents.length,
    lastUpdated: page.lastUpdated,
  };
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

  // Tool 10: DNS Health Report
  server.tool(
    "dns_health",
    "Run a comprehensive DNS health audit on a domain — 39 checks across 7 categories: DNSSEC (chain of trust, algorithms, validation), MX & email (PTR, MTA-STS, redundancy), DNS hygiene (SPF conflicts, wildcards, apex CNAME), TTL & SOA configuration, nameserver setup (diversity, lame delegation, EDNS0), CAA certificates, and operational maturity (security.txt, abuse mailbox). Returns an overall severity-weighted score (0–100) plus per-category scores.",
    {
      domain: z.string().describe("Domain name to check DNS health for (e.g. example.com)"),
    },
    async ({ domain }) => {
      try {
        const result = await apiGet(
          `/v1/dns-health/${encodeURIComponent(domain)}`,
          {},
          { prefix: "/api", timeout: 30000 }
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

  // Tool 11: GEO Checker (Generative Engine Optimization)
  server.tool(
    "geo_checker",
    "Check a domain's GEO (Generative Engine Optimization) score — how well the site is optimized for AI search engines like ChatGPT, Gemini, Claude, and Perplexity. Returns three scores (Technical Readiness, Entity Readiness, Answer Readiness), AI crawler access status, structured data analysis, and prioritized recommendations.",
    {
      domain: z.string().describe("Domain name to check GEO score for (e.g. github.com)"),
    },
    async ({ domain }) => {
      try {
        const result = await apiPost(
          "/v1/geo/check",
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

  // Tool 12: RDAP Lookup — registration data for an IP, ASN, or domain
  server.tool(
    "rdap_lookup",
    "Look up registration data (RDAP — the successor to WHOIS) for an IP address, AS number, or domain name. The query type is detected automatically. Returns the owning organization, network range/CIDR, RIR (ARIN, RIPE, APNIC, LACNIC, AFRINIC), country, status, registration/last-changed dates, nameservers, and abuse/registrant contacts, plus the raw RDAP JSON.",
    {
      query: z
        .string()
        .describe(
          "What to look up: an IPv4/IPv6 address (e.g. 8.8.8.8), an AS number (e.g. AS13335 or 13335), or a domain name (e.g. example.com)"
        ),
    },
    async ({ query }) => {
      try {
        const result = await apiGet(
          "/v1/rdap/lookup",
          { q: query },
          { timeout: 20000 }
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

  // Tool 13: Hosting Report — who hosts a website
  server.tool(
    "hosting_report",
    "Find out who hosts a website. Returns the hosting provider, IP/ASN/network owner, server location, DNS/nameserver provider, CDN or proxy detection (Cloudflare, Fastly, etc.), SSL certificate issuer, and mail servers/provider for a domain in one combined report.",
    {
      domain: z
        .string()
        .describe(
          "Domain or URL to build a hosting report for (e.g. github.com). URLs are normalized to a bare hostname."
        ),
    },
    async ({ domain }) => {
      try {
        const result = await apiGet(
          "/v1/hosting-report",
          { domain },
          { timeout: 30000 }
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

  // Tool 14: Domain Scanner — email security posture scan
  server.tool(
    "domain_scanner",
    "Scan a domain's email security posture: SPF, DKIM, DMARC, and BIMI configuration. Returns per-indicator scores and detected issues so you can see how well the domain is protected against spoofing and phishing.",
    {
      domain: z.string().describe("Domain name to scan (e.g. example.com)"),
    },
    async ({ domain }) => {
      try {
        const result = await apiGet(
          "/v1/domain-scanner",
          { domain },
          { timeout: 30000 }
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

  // Tool 15: DNS Change Review — deterministic DNS-change linter
  server.tool(
    "dns_change_review",
    "Review proposed DNS changes BEFORE applying them. Compares a domain's current public DNS with a proposed future state, returns a diff, deterministic rule-based findings (SPF/DMARC/MX/CAA/DNSSEC pitfalls, dangling records, mail breakage, etc.) with suggested fixes, and an overall 0-100 risk score. Stateless — nothing is stored.",
    {
      domain: z
        .string()
        .describe(
          "Domain whose current public DNS will be compared against the proposed records (e.g. example.com)"
        ),
      records: z
        .union([
          z
            .string()
            .describe(
              "Proposed DNS records as BIND zone-file text, e.g. 'example.com. 300 IN MX 10 mail.example.com.'"
            ),
          z
            .array(
              z.object({
                type: z
                  .string()
                  .describe("Record type, e.g. A, AAAA, MX, TXT, CNAME, NS, CAA"),
                name: z
                  .string()
                  .optional()
                  .describe(
                    "Record name — subdomain, FQDN, or '@' for the apex (default: '@')"
                  ),
                value: z
                  .string()
                  .describe(
                    "Record value, e.g. '93.184.216.34' or 'v=spf1 include:_spf.google.com ~all'"
                  ),
                ttl: z.number().optional().describe("TTL in seconds"),
                priority: z
                  .number()
                  .optional()
                  .describe("Priority (MX/SRV records)"),
              })
            )
            .describe("Proposed DNS records as a structured array"),
        ])
        .describe(
          "The proposed (future) DNS state: either BIND zone-file text or an array of {type, name?, value, ttl?, priority?} records. This is the COMPLETE desired state for the zone — records present now but omitted here are treated as deletions."
        ),
      server: z
        .enum(DNS_SERVERS)
        .optional()
        .describe(
          "DNS server to use when fetching the current records. Default: cloudflare."
        ),
    },
    async ({ domain, records, server: dnsServer }) => {
      try {
        const body: Record<string, unknown> = { domain };
        if (typeof records === "string") {
          body.proposed = records;
          body.format = "auto";
        } else {
          body.proposed = JSON.stringify(records);
          body.format = "json";
        }
        if (dnsServer) body.server = dnsServer;

        const result = await apiPost("/v1/dns-change-review", body, {
          timeout: 45000,
        });
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

  // Tool 16: BIMI Check — BIMI DNS record only (no VMC certificate fetch)
  server.tool(
    "bimi_check",
    "Check only the BIMI (Brand Indicators for Message Identification) DNS record for a domain — faster than bimi_vmc because it skips the VMC certificate download and validation. Returns the BIMI record at default._bimi.<domain>, logo URL, and authority (VMC) URL if declared.",
    {
      domain: z.string().describe("Domain name to check the BIMI record for (e.g. easydmarc.com)"),
    },
    async ({ domain }) => {
      try {
        const result = await apiPost(
          "/v1/vmc/check-bimi",
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

  // Tool 17: Status Page — read a public status page
  server.tool(
    "status_page",
    "Read a public status page hosted on nslookup.io status pages. Returns the page name, overall status, per-component status and uptime, and active incidents/maintenance. Look up by slug (pages served at hosted.nslookup.io/<slug>) or by the custom domain the page is served on. Provide exactly one of slug or domain.",
    {
      slug: z
        .string()
        .optional()
        .describe("Status page slug (e.g. 'nslookup-io' for hosted.nslookup.io/nslookup-io)"),
      domain: z
        .string()
        .optional()
        .describe("Custom domain the status page is served on (e.g. status.acme.com)"),
    },
    async ({ slug, domain }) => {
      try {
        if ((slug ? 1 : 0) + (domain ? 1 : 0) !== 1) {
          throw new Error("Provide exactly one of 'slug' or 'domain'.");
        }

        const result = slug
          ? await apiGet(
              `/v1/status-pages/public/${encodeURIComponent(slug)}`,
              {},
              { prefix: "/portal-api", timeout: 15000 }
            )
          : await apiGet(
              "/v1/status-pages/public/by-domain",
              { domain: domain as string },
              { prefix: "/portal-api", timeout: 15000 }
            );
        return {
          content: [{ type: "text", text: formatJson(summarizeStatusPage(result)) }],
        };
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
