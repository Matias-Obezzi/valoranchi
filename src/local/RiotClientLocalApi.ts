import { Agent, fetch as undiciFetch } from "undici";
import { RiotClientNotReadyError, RiotClientNotRunningError } from "../errors.js";

export interface LocalEntitlementsToken {
  accessToken: string;
  token: string;
  subject: string;
}

export interface LocalSessionInfo {
  region: string;
  shard: string;
}

export interface LocalApiResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type LocalApiFetchFn = (
  url: string,
  init?: {
    headers?: Record<string, string>;
    dispatcher?: Agent;
  },
) => Promise<LocalApiResponse>;

interface ExternalSessionEntry {
  productId?: string;
  launchConfiguration?: {
    arguments?: string[];
  };
}

export class RiotClientLocalApi {
  private readonly port: number;
  private readonly authorization: string;
  private readonly agent: Agent;
  private readonly fetchFn: LocalApiFetchFn;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(
    port: number,
    password: string,
    options?: {
      agent?: Agent;
      fetchFn?: LocalApiFetchFn;
      sleepFn?: (ms: number) => Promise<void>;
    },
  ) {
    this.port = port;
    this.authorization = `Basic ${Buffer.from(`riot:${password}`).toString("base64")}`;
    this.agent =
      options?.agent ??
      new Agent({
        connect: {
          rejectUnauthorized: false,
        },
      });
    this.fetchFn = options?.fetchFn ?? (undiciFetch as unknown as LocalApiFetchFn);
    this.sleepFn =
      options?.sleepFn ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async entitlementsToken(): Promise<LocalEntitlementsToken> {
    const maxRetries = 5;
    const retryDelayMs = 1500;
    const url = `https://127.0.0.1:${this.port}/entitlements/v1/token`;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.fetchFn(url, {
          headers: { Authorization: this.authorization },
          dispatcher: this.agent,
        });

        if (response.ok) {
          const data = (await response.json()) as {
            accessToken?: string;
            token?: string;
            subject?: string;
          };
          if (data.accessToken && data.token && data.subject) {
            return {
              accessToken: data.accessToken,
              token: data.token,
              subject: data.subject,
            };
          }
        }

        const bodyText = await response.text();
        const isNotReady =
          response.status === 404 || bodyText.includes("Entitlements token is not ready yet");

        if (isNotReady && attempt < maxRetries) {
          await this.sleepFn(retryDelayMs);
          continue;
        }

        throw new RiotClientNotReadyError();
      } catch (error) {
        if (error instanceof RiotClientNotReadyError) {
          throw error;
        }
        if (this.isConnectionRefused(error)) {
          throw new RiotClientNotRunningError();
        }
        if (attempt < maxRetries) {
          await this.sleepFn(retryDelayMs);
          continue;
        }
        throw new RiotClientNotReadyError();
      }
    }

    throw new RiotClientNotReadyError();
  }

  async valorantSession(): Promise<LocalSessionInfo | null> {
    const url = `https://127.0.0.1:${this.port}/product-session/v1/external-sessions`;
    try {
      const response = await this.fetchFn(url, {
        headers: { Authorization: this.authorization },
        dispatcher: this.agent,
      });
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as Record<string, ExternalSessionEntry>;
      return this.parseExternalSessions(data);
    } catch {
      return null;
    }
  }

  private parseExternalSessions(
    sessions: Record<string, ExternalSessionEntry>,
  ): LocalSessionInfo | null {
    const valorant = Object.values(sessions).find(
      (entry) => entry.productId?.toLowerCase() === "valorant",
    );
    const args = valorant?.launchConfiguration?.arguments;
    if (!args || !Array.isArray(args)) {
      return null;
    }

    const regionArg = args.find((a) => a.startsWith("-ares-deployment="));
    const endpointArg = args.find((a) => a.startsWith("-config-endpoint="));
    if (!regionArg || !endpointArg) {
      return null;
    }

    const region = regionArg.split("=")[1]?.trim().toLowerCase();
    const shardMatch = endpointArg.match(/shared\.([a-z0-9]+)\.a\.pvp\.net/i);
    const shard = shardMatch?.[1]?.trim().toLowerCase();
    if (!region || !shard) {
      return null;
    }

    return { region, shard };
  }

  private isConnectionRefused(error: unknown): boolean {
    const err = error as { code?: string; cause?: { code?: string } };
    return err?.code === "ECONNREFUSED" || err?.cause?.code === "ECONNREFUSED";
  }
}
