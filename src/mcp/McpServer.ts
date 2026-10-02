import { readFileSync } from "node:fs";
import readline from "node:readline";
import type { RiotClient } from "../RiotClient.js";
import { executeMcpTool, getMcpTools, McpError } from "./tools.js";
import type { JsonRpcRequest, JsonRpcResponse, McpServerOptions } from "./types.js";

const SUPPORTED_PROTOCOL_VERSIONS = new Set(["2025-06-18", "2025-03-26", "2024-11-05"]);
const DEFAULT_PROTOCOL_VERSION = "2025-06-18";

function getPackageVersion(): string {
  try {
    const url = new URL("../../package.json", import.meta.url);
    return (JSON.parse(readFileSync(url, "utf-8")) as { version: string }).version;
  } catch {
    return "0.4.0";
  }
}

function resolveProtocolVersion(clientVersion: unknown): string {
  if (typeof clientVersion === "string" && SUPPORTED_PROTOCOL_VERSIONS.has(clientVersion)) {
    return clientVersion;
  }
  return DEFAULT_PROTOCOL_VERSION;
}

export class McpServer {
  private readonly client: RiotClient;
  private readonly input: NodeJS.ReadableStream;
  private readonly output: NodeJS.WritableStream;
  private readonly version: string;
  private rl?: readline.Interface;
  private startPromise?: Promise<void>;
  private resolveClose?: () => void;

  constructor(client: RiotClient, options: McpServerOptions = {}) {
    this.client = client;
    this.input = options.input ?? process.stdin;
    this.output = options.output ?? process.stdout;
    this.version = options.version ?? getPackageVersion();
  }

  start(): Promise<void> {
    if (this.startPromise) return this.startPromise;

    this.startPromise = new Promise<void>((resolve) => {
      this.resolveClose = resolve;
    });

    const rl = readline.createInterface({
      input: this.input,
      terminal: false,
    });
    this.rl = rl;

    rl.on("line", (line: string) => {
      void this.handleLine(line);
    });

    rl.on("close", () => {
      this.resolveClose?.();
    });

    return this.startPromise;
  }

  close(): void {
    this.rl?.close();
    this.resolveClose?.();
  }

  private sendResponse(response: JsonRpcResponse): void {
    this.output.write(`${JSON.stringify(response)}\n`);
  }

  private handleInitialize(params?: Record<string, unknown>): unknown {
    const protocolVersion = resolveProtocolVersion(params?.protocolVersion);
    return {
      protocolVersion,
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "valoranchi-riot-client",
        version: this.version,
      },
    };
  }

  private async handleToolsCall(params?: Record<string, unknown>): Promise<unknown> {
    const toolName = params?.name;
    if (typeof toolName !== "string" || !toolName) {
      throw new McpError(-32602, "Tool name is required");
    }
    const toolArgs = (params.arguments as Record<string, unknown> | undefined) ?? {};
    return executeMcpTool(this.client, toolName, toolArgs);
  }

  private async dispatchRequest(req: JsonRpcRequest): Promise<unknown> {
    switch (req.method) {
      case "initialize":
        return this.handleInitialize(req.params);
      case "ping":
        return {};
      case "tools/list":
        return { tools: getMcpTools() };
      case "tools/call":
        return await this.handleToolsCall(req.params);
      default:
        throw new McpError(-32601, `Method not found: ${req.method}`);
    }
  }

  private async handleMessage(rawMessage: Record<string, unknown>): Promise<JsonRpcResponse | null> {
    const req = rawMessage as unknown as JsonRpcRequest;
    if (req.id === undefined || req.method === "notifications/initialized") {
      return null;
    }

    const id = req.id ?? null;
    try {
      const result = await this.dispatchRequest(req);
      return { jsonrpc: "2.0", id, result };
    } catch (error: unknown) {
      if (error instanceof McpError) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: error.code, message: error.message },
        };
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32603, message },
      };
    }
  }

  async handleLine(line: string): Promise<void> {
    const trimmed = line.trim();
    if (!trimmed) return;

    let message: Record<string, unknown>;
    try {
      message = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      this.sendResponse({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      });
      return;
    }

    const response = await this.handleMessage(message);
    if (response) {
      this.sendResponse(response);
    }
  }
}
