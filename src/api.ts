const DEFAULT_API_URL = "https://nslookup.io/api";

function getApiUrl(): string {
  return process.env.NSLOOKUP_API_URL || DEFAULT_API_URL;
}

export interface ApiOptions {
  timeout?: number;
}

export async function apiGet(
  path: string,
  params: Record<string, string>,
  options: ApiOptions = {}
): Promise<unknown> {
  const url = new URL(path, getApiUrl());
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout || 30000
  );

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "nslookup-mcp/1.0",
        Accept: "application/json",
      },
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
  const url = new URL(path, getApiUrl());

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout || 30000
  );

  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "User-Agent": "nslookup-mcp/1.0",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
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
