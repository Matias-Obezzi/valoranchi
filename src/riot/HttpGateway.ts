import { ForbiddenHostError, RiotApiError } from "../errors.js";

export type HttpFetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const REQUEST_TIMEOUT_MS = 30_000;

export class HttpGateway {
  private readonly fetchFn: HttpFetchFn;

  constructor(fetchFn: HttpFetchFn = globalThis.fetch) {
    this.fetchFn = fetchFn;
  }

  async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(url, { method: "GET" }, headers);
  }

  async getOrNull<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
    try {
      return await this.get<T>(url, headers);
    } catch (error) {
      if (error instanceof RiotApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async post<T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.sendWithBody<T>("POST", url, body, headers);
  }

  async put<T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.sendWithBody<T>("PUT", url, body, headers);
  }

  private async sendWithBody<T>(
    method: "POST" | "PUT",
    url: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const serializedBody =
      typeof body === "string" ? body : body !== undefined ? JSON.stringify(body) : undefined;

    const requestHeaders: Record<string, string> = {
      ...(serializedBody !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    };

    return this.request<T>(
      url,
      {
        method,
        headers: requestHeaders,
        body: serializedBody,
      },
      headers,
    );
  }

  private async request<T>(
    url: string,
    init: RequestInit,
    headers?: Record<string, string>,
  ): Promise<T> {
    this.assertAllowedHost(url, headers);
    const response = await this.fetchFn(url, {
      ...init,
      headers: (init.headers as Record<string, string> | undefined) ?? headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch((error: unknown) => {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new RiotApiError(408, url, `Request to ${url.split("?")[0]} timed out`);
      }
      throw error;
    });

    if (!response.ok) {
      throw new RiotApiError(response.status, url);
    }

    return (await response.json()) as T;
  }

  private assertAllowedHost(urlStr: string, headers?: Record<string, string>): void {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();

    const isRiotHost =
      host === "127.0.0.1" ||
      host === "riotgames.com" ||
      host.endsWith(".riotgames.com") ||
      host.endsWith(".pvp.net");

    const isValorantApiHost = host === "valorant-api.com" || host.endsWith(".valorant-api.com");

    if (!isRiotHost && !isValorantApiHost) {
      throw new ForbiddenHostError(host);
    }

    if (!isRiotHost && headers) {
      const containsToken = Object.entries(headers).some(([key, val]) => {
        const lowerKey = key.toLowerCase();
        return (
          (lowerKey === "authorization" || lowerKey === "x-riot-entitlements-jwt") &&
          Boolean(val && val.length > 0)
        );
      });
      if (containsToken) {
        throw new ForbiddenHostError(host);
      }
    }
  }
}
