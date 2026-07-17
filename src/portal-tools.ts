import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "./api.js";

/**
 * Authenticated portal ("my_") tools — read the caller's own NsLookup.io
 * monitoring account through portal-api. Every request forwards the caller's
 * bearer credential (Keycloak JWT or `nslk_` personal access token) verbatim;
 * portal-api is the authorization authority (its JwtAuthGuard maps the
 * credential to the acting organization).
 *
 * Endpoint map (all verified against ns-lookup-io-portal-api controllers):
 *   my_overview        GET /v1/overview/health + GET /v1/limits
 *   my_monitors        GET /v1/uptime/monitors, /v1/api-monitors,
 *                      /v1/dns-monitors, /v1/whois-monitors,
 *                      /v1/propagation-monitors, /v1/certificates/monitored,
 *                      /v1/vmc/monitored (parallel, failure-tolerant)
 *   my_incidents       GET /v1/alerts/incidents
 *   my_uptime_history  GET /v1/uptime/monitors/:id/stats + /chart/hourly
 *   my_dns_changes     GET /v1/dns-change-reviews (+ /summary)
 *   my_certificates    GET /v1/certificates/dashboard
 */

const AUTH_SUFFIX =
  "Requires sign-in to your NsLookup.io account (or an API token).";

const NOT_SIGNED_IN =
  "Not signed in. This tool reads your NsLookup.io monitoring account. " +
  "Hosted connector (https://mcp.nslookup.io/mcp): complete the OAuth sign-in your MCP client offers. " +
  "Local/stdio: set the NSLOOKUP_API_TOKEN environment variable to a personal access token (nslk_..., created in the portal under API Tokens) or a Keycloak access token.";

/** How the per-request credential reaches a tool handler. */
export interface PortalAuthOptions {
  /**
   * Returns the caller's bearer credential, or undefined when anonymous.
   * HTTP: closure over the validated per-request Authorization header.
   * stdio: NSLOOKUP_API_TOKEN from the environment.
   */
  getToken: () => string | undefined;
}

function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function errorText(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("API error 401") || msg.includes("API error 403")) {
    return `${msg}\n\nThe credential was rejected by the portal API. ${NOT_SIGNED_IN}`;
  }
  return `Error: ${msg}`;
}

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: formatJson(data) }] };
}

function fail(error: unknown): ToolResult {
  return {
    content: [{ type: "text", text: errorText(error) }],
    isError: true,
  };
}

const notSignedIn = (): ToolResult => ({
  content: [{ type: "text", text: NOT_SIGNED_IN }],
  isError: true,
});

/** Allow-list projection — unknown/absent keys are silently dropped. */
function pick(
  row: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) out[key] = row[key];
  }
  return out;
}

function trimList(
  data: unknown,
  keys: string[],
  cap = 50
): { total: number; items: Array<Record<string, unknown>> } | unknown {
  if (!Array.isArray(data)) return data;
  return {
    total: data.length,
    items: data
      .slice(0, cap)
      .map((row) => pick(row as Record<string, unknown>, keys)),
  };
}

const MONITOR_KEYS = [
  "id",
  "name",
  "url",
  "domain",
  "monitor_type",
  "record_type",
  "is_active",
  "check_interval",
  "last_checked",
  "last_checked_at",
  "last_status",
  "current_status",
  "status",
  "consistency_status",
  "alert_level",
  "days_until_expiry",
  "expiry_date",
  "expires_at",
  "valid_to",
  "registrar",
  "tag",
  "created_at",
];

const INCIDENT_KEYS = [
  "id",
  "source",
  "status",
  "severity",
  "title",
  "message",
  "monitor_id",
  "monitor_name",
  "domain",
  "url",
  "location",
  "started_at",
  "acknowledged_at",
  "resolved_at",
  "duration_seconds",
];

const REVIEW_KEYS = [
  "id",
  "monitor_id",
  "domain",
  "detected_at",
  "risk_score",
  "risk_level",
  "critical_count",
  "high_count",
  "medium_count",
  "low_count",
  "info_count",
  "added_count",
  "removed_count",
  "modified_count",
  "alerted",
];

const CERT_KEYS = [
  "domain",
  "issuer",
  "status",
  "valid_from",
  "valid_to",
  "days_until_expiry",
  "alert_level",
  "chain_valid",
  "error_message",
  "checked_at",
];

export function registerPortalTools(
  server: McpServer,
  auth: PortalAuthOptions
): void {
  const portal = (path: string, params: Record<string, string>, token: string) =>
    apiGet(path, params, {
      prefix: "/portal-api",
      timeout: 20000,
      authToken: token,
    });

  // Tool 18: my_overview — account health snapshot
  server.tool(
    "my_overview",
    `Get an account health snapshot for your NsLookup.io monitoring: an aggregated 0-100 health score with per-subsystem breakdown (uptime, SSL, DNS, propagation, VMC, WHOIS) plus your current product limits/quota. ${AUTH_SUFFIX}`,
    {},
    async () => {
      const token = auth.getToken();
      if (!token) return notSignedIn();
      try {
        const [health, limits] = await Promise.allSettled([
          portal("/v1/overview/health", {}, token),
          portal("/v1/limits", {}, token),
        ]);
        if (health.status === "rejected") throw health.reason;
        return ok({
          health: health.value,
          limits:
            limits.status === "fulfilled"
              ? limits.value
              : { error: String(limits.reason) },
        });
      } catch (error) {
        return fail(error);
      }
    }
  );

  // Tool 19: my_monitors — all monitors across types
  server.tool(
    "my_monitors",
    `List all monitors in your NsLookup.io account across every type — uptime, API, DNS, WHOIS, DNS propagation, SSL certificates, and BIMI/VMC — with their configuration and latest known state. ${AUTH_SUFFIX}`,
    {},
    async () => {
      const token = auth.getToken();
      if (!token) return notSignedIn();

      const sources: Array<[string, string]> = [
        ["uptime", "/v1/uptime/monitors"],
        ["api", "/v1/api-monitors"],
        ["dns", "/v1/dns-monitors"],
        ["whois", "/v1/whois-monitors"],
        ["propagation", "/v1/propagation-monitors"],
        ["certificates", "/v1/certificates/monitored"],
        ["vmc", "/v1/vmc/monitored"],
      ];

      const settled = await Promise.allSettled(
        sources.map(([, path]) => portal(path, {}, token))
      );

      // A 401 on every source means the credential itself is bad — surface it.
      if (
        settled.every(
          (r) =>
            r.status === "rejected" && String(r.reason).includes("API error 401")
        )
      ) {
        return fail(settled[0].status === "rejected" ? settled[0].reason : "401");
      }

      const result: Record<string, unknown> = {};
      sources.forEach(([label], i) => {
        const r = settled[i];
        result[label] =
          r.status === "fulfilled"
            ? trimList(r.value, MONITOR_KEYS)
            : { error: String(r.reason) };
      });
      return ok(result);
    }
  );

  // Tool 20: my_incidents — open + recent incidents
  server.tool(
    "my_incidents",
    `List incidents from your NsLookup.io monitoring (downtime, SSL expiry, DNS changes, propagation issues, VMC problems) — open ones by default, or the full recent history — plus a per-status/per-source summary. ${AUTH_SUFFIX}`,
    {
      status: z
        .enum(["open", "all"])
        .optional()
        .describe(
          "'open' (default) = unresolved incidents (triggered or acknowledged); 'all' = include resolved history"
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Maximum incidents to return (default 20)"),
    },
    async ({ status, limit }) => {
      const token = auth.getToken();
      if (!token) return notSignedIn();
      try {
        const wantOpen = (status ?? "open") === "open";
        const max = limit ?? 20;
        // Upstream filters on a single status value; "open" spans two
        // (triggered + acknowledged), so over-fetch and filter here.
        const data = (await portal(
          "/v1/alerts/incidents",
          { limit: wantOpen ? "200" : String(max) },
          token
        )) as { incidents?: Array<Record<string, unknown>>; summary?: unknown };

        let incidents = Array.isArray(data?.incidents) ? data.incidents : [];
        if (wantOpen) {
          incidents = incidents.filter((i) => i.status !== "resolved");
        }
        return ok({
          filter: wantOpen ? "open" : "all",
          summary: data?.summary,
          incidents: incidents.slice(0, max).map((i) => pick(i, INCIDENT_KEYS)),
        });
      } catch (error) {
        return fail(error);
      }
    }
  );

  // Tool 21: my_uptime_history — uptime + response-time history for one monitor
  server.tool(
    "my_uptime_history",
    `Get uptime and response-time history for one of your NsLookup.io uptime monitors: availability stats plus hourly buckets over the requested window. Identify the monitor by id or by URL. ${AUTH_SUFFIX}`,
    {
      monitorId: z
        .number()
        .int()
        .optional()
        .describe("Monitor id (from my_monitors)"),
      url: z
        .string()
        .optional()
        .describe(
          "Monitor URL to match instead of an id (e.g. https://example.com)"
        ),
      hours: z
        .number()
        .int()
        .min(1)
        .max(720)
        .optional()
        .describe("History window in hours (default 24)"),
    },
    async ({ monitorId, url, hours }) => {
      const token = auth.getToken();
      if (!token) return notSignedIn();
      try {
        if (!monitorId && !url) {
          throw new Error("Provide 'monitorId' or 'url'.");
        }

        let id = monitorId;
        let monitorMeta: Record<string, unknown> | undefined;
        if (!id) {
          const monitors = (await portal(
            "/v1/uptime/monitors",
            {},
            token
          )) as Array<Record<string, unknown>>;
          const needle = String(url).toLowerCase().replace(/\/+$/, "");
          const match = monitors.find((m) => {
            const mu = String(m.url ?? "").toLowerCase().replace(/\/+$/, "");
            return mu === needle || mu.includes(needle) || needle.includes(mu);
          });
          if (!match) {
            throw new Error(
              `No uptime monitor matches url '${url}'. Available: ${monitors
                .map((m) => `#${m.id} ${m.url}`)
                .join(", ") || "(none)"}`
            );
          }
          id = Number(match.id);
          monitorMeta = pick(match, ["id", "name", "url", "check_interval"]);
        }

        const h = hours ?? 24;
        const days = Math.max(1, Math.ceil(h / 24));
        const [stats, hourly] = await Promise.allSettled([
          portal(`/v1/uptime/monitors/${id}/stats`, { days: String(days) }, token),
          portal(
            `/v1/uptime/monitors/${id}/chart/hourly`,
            { hours: String(h) },
            token
          ),
        ]);
        if (stats.status === "rejected" && hourly.status === "rejected") {
          throw stats.reason;
        }
        return ok({
          monitor: monitorMeta ?? { id },
          windowHours: h,
          stats:
            stats.status === "fulfilled"
              ? stats.value
              : { error: String(stats.reason) },
          hourly:
            hourly.status === "fulfilled"
              ? hourly.value
              : { error: String(hourly.reason) },
        });
      } catch (error) {
        return fail(error);
      }
    }
  );

  // Tool 22: my_dns_changes — recent DNS changes + risk reviews
  server.tool(
    "my_dns_changes",
    `List recent DNS changes detected on your monitored domains, each with its DNS Change Review risk assessment (0-100 risk score, severity counts, added/removed/modified record counts), plus the latest risk per monitor. ${AUTH_SUFFIX}`,
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Maximum reviews to return (default 10)"),
    },
    async ({ limit }) => {
      const token = auth.getToken();
      if (!token) return notSignedIn();
      try {
        const max = limit ?? 10;
        const [list, summary] = await Promise.allSettled([
          portal("/v1/dns-change-reviews", { limit: String(max) }, token),
          portal("/v1/dns-change-reviews/summary", {}, token),
        ]);
        if (list.status === "rejected") throw list.reason;

        // The list may be a bare array or {reviews/items, total} — trim either.
        const raw = list.value as Record<string, unknown> | unknown[];
        const rows = Array.isArray(raw)
          ? raw
          : (Object.values(raw ?? {}).find(Array.isArray) as unknown[]) ?? [];
        return ok({
          latestPerMonitor:
            summary.status === "fulfilled" ? summary.value : undefined,
          reviews: rows
            .slice(0, max)
            .map((r) => pick(r as Record<string, unknown>, REVIEW_KEYS)),
        });
      } catch (error) {
        return fail(error);
      }
    }
  );

  // Tool 23: my_certificates — certificate expiry overview
  server.tool(
    "my_certificates",
    `Get an SSL certificate expiry overview for your monitored domains: per-alert-level counts (ok / warning / critical / expired) and every certificate sorted by soonest expiry, highlighting the ones expiring within 30 days. ${AUTH_SUFFIX}`,
    {},
    async () => {
      const token = auth.getToken();
      if (!token) return notSignedIn();
      try {
        const data = (await portal(
          "/v1/certificates/dashboard",
          {},
          token
        )) as Record<string, unknown>;

        const certs = (Array.isArray(data?.certificates)
          ? (data.certificates as Array<Record<string, unknown>>)
          : []
        )
          .map((c) => pick(c, CERT_KEYS))
          .sort(
            (a, b) =>
              Number(a.days_until_expiry ?? Infinity) -
              Number(b.days_until_expiry ?? Infinity)
          );

        return ok({
          totalDomains: data?.total_domains,
          activeDomains: data?.active_domains,
          alerts: data?.alerts,
          expiringSoon: certs.filter(
            (c) => Number(c.days_until_expiry ?? Infinity) <= 30
          ),
          certificates: certs.slice(0, 100),
        });
      } catch (error) {
        return fail(error);
      }
    }
  );
}
