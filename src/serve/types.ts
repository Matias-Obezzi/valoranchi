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

export interface RouteParam {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required?: boolean;
}

export interface RouteDefinition {
  method: "GET" | "POST";
  namespace: string;
  action: string;
  path: string;
  summary: string;
  isConfirmGated?: boolean;
  responseSchema?: string;
  params?: RouteParam[];
}

