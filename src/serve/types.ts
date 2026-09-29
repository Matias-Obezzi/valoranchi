import type { Server } from "node:http";

export interface ServeOptions {
  port?: number;
  host?: string;
  cacheSeconds?: number;
  allowRemote?: boolean;
}

export interface ServerInstance {
  server: Server;
  port: number;
  host: string;
  url: string;
  close(): Promise<void>;
}

export interface RouteDefinition {
  method: "GET" | "POST";
  namespace: string;
  action: string;
  path: string;
  summary: string;
  isConfirmGated?: boolean;
  responseSchema?: string;
}
