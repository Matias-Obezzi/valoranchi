import { RiotClientError } from "../errors.js";
import { formatError } from "../formatError.js";
import type { RiotClient } from "../RiotClient.js";
import { CONFIRM_GATED_ROUTES, ROUTE_DEFINITIONS, dispatchApiRoute } from "../serve/index.js";
import type { RouteDefinition } from "../serve/types.js";
import type { McpTool, McpToolInputSchema, McpToolProperty, McpToolResult } from "./types.js";

export class McpError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "McpError";
    this.code = code;
  }
}

function buildToolInputSchema(route: RouteDefinition): McpToolInputSchema {
  const properties: Record<string, McpToolProperty> = {};
  const required: string[] = [];

  if (route.params) {
    for (const param of route.params) {
      properties[param.name] = {
        type: param.type,
        description: param.description,
      };
      if (param.required) {
        required.push(param.name);
      }
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function isReadOnlyRoute(route: RouteDefinition): boolean {
  if (route.method !== "GET") return false;
  if (route.isConfirmGated) return false;
  return !CONFIRM_GATED_ROUTES.has(`${route.namespace}/${route.action}`);
}

const READ_ONLY_ROUTES = ROUTE_DEFINITIONS.filter(isReadOnlyRoute);

const TOOL_MAP = new Map<string, RouteDefinition>(
  READ_ONLY_ROUTES.map((route) => [`${route.namespace}_${route.action}`, route]),
);

export function getMcpTools(): McpTool[] {
  return READ_ONLY_ROUTES.map((route) => ({
    name: `${route.namespace}_${route.action}`,
    description: route.summary,
    inputSchema: buildToolInputSchema(route),
  }));
}

function stringifyArgs(args: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined && value !== null) {
      result[key] = String(value);
    }
  }
  return result;
}

export async function executeMcpTool(
  client: RiotClient,
  name: string,
  args: Record<string, unknown> = {},
): Promise<McpToolResult> {
  const route = TOOL_MAP.get(name);
  if (!route) {
    throw new McpError(-32602, `Unknown tool: ${name}`);
  }

  const stringifiedArgs = stringifyArgs(args);

  try {
    const result = await dispatchApiRoute(
      client,
      route.namespace,
      route.action,
      stringifiedArgs,
      {},
      { method: "GET", headers: {} },
    );

    return {
      content: [{ type: "text", text: JSON.stringify(result ?? null) }],
      structuredContent: result,
    };
  } catch (error: unknown) {
    if (error instanceof RiotClientError) {
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(formatError(error)) }],
      };
    }
    throw error;
  }
}
