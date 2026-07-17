const DEFAULT_BASE_URL = "https://www.nslookup.io";

function getBaseUrl(): string {
  return (process.env.NSLOOKUP_API_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export interface ApiOptions {
  timeout?: number;
  /** API prefix path, e.g. "/api", "/portal-api", "/scanner-api" */
  prefix?: string;
  /**
   * Bearer credential forwarded upstream as-is (Keycloak JWT or `nslk_` PAT).
   * Used by the authenticated portal (`my_`) tools.
   */
  authToken?: string;
}

function buildUrl(path: string, options: ApiOptions = {}): string {
  const base = getBaseUrl();
  const prefix = options.prefix ?? "/api";
  return `${base}${prefix}${path}`;
}

export async function apiGet(
  path: string,
  params: Record<string, string>,
  options: ApiOptions = {}
): Promise<unknown> {
  const url = new URL(buildUrl(path, options));
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout || 30000
  );

  try {
    const headers: Record<string, string> = {
      "User-Agent": "nslookup-mcp/1.0",
      Accept: "application/json",
    };
    if (options.authToken) headers["Authorization"] = `Bearer ${options.authToken}`;

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`API error ${response.status}: ${body}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiPost(
  path: string,
  body: Record<string, unknown>,
  options: ApiOptions = {}
): Promise<unknown> {
  const url = new URL(buildUrl(path, options));

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout || 30000
  );

  try {
    const headers: Record<string, string> = {
      "User-Agent": "nslookup-mcp/1.0",
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (options.authToken) headers["Authorization"] = `Bearer ${options.authToken}`;

    const response = await fetch(url.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(`API error ${response.status}: ${responseBody}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}
