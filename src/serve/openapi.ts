import fs from "node:fs";
import path from "node:path";
import { ROUTE_DEFINITIONS } from "./routes.js";

export function buildOpenApiSpec(schemaDir?: string): Record<string, unknown> {
  const dir = schemaDir ?? path.resolve("schema");
  const schemas: Record<string, unknown> = {};

  if (fs.existsSync(dir)) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const name = path.basename(file, ".json");
        try {
          const content = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8")) as unknown;
          schemas[name] = content;
        } catch {}
      }
    } catch {}
  }

  const paths: Record<string, Record<string, unknown>> = {};

  for (const r of ROUTE_DEFINITIONS) {
    if (!paths[r.path]) {
      paths[r.path] = {};
    }
    const methodLower = r.method.toLowerCase();
    const responses: Record<string, unknown> = {
      "200": {
        description: "Successful response",
        content: {
          "application/json": {
            schema: r.responseSchema && schemas[r.responseSchema]
              ? { $ref: `#/components/schemas/${r.responseSchema}` }
              : { type: "object" },
          },
        },
      },
      "400": { description: "Validation error or invalid argument" },
      "502": { description: "Riot API upstream error" },
      "503": { description: "Riot Client not running or not ready" },
      "500": { description: "Internal error" },
    };

    const parameters: unknown[] = [];
    if (r.method === "POST") {
      parameters.push({
        name: "dryRun",
        in: "query",
        description: "Dry-run execution without applying changes (1 for yes, 0 for no)",
        schema: { type: "string", default: "1" },
      });
      if (r.isConfirmGated) {
        parameters.push({
          name: "X-Confirm",
          in: "header",
          description: "Must be 'yes' to execute confirmed write",
          schema: { type: "string" },
        });
      }
    }

    paths[r.path]![methodLower] = {
      summary: r.summary,
      tags: [r.namespace],
      parameters: parameters.length > 0 ? parameters : undefined,
      requestBody: r.method === "POST"
        ? {
            required: false,
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          }
        : undefined,
      responses,
    };
  }

  paths["/events"] = {
    get: {
      summary: "Server-Sent Events real-time event stream",
      tags: ["events"],
      parameters: [
        {
          name: "only",
          in: "query",
          description: "Comma-separated list of event names to stream",
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          description: "SSE event stream",
          content: {
            "text/event-stream": {},
          },
        },
      },
    },
  };

  return {
    openapi: "3.0.3",
    info: {
      title: "Valorant Riot Client Local API",
      version: "0.3.0",
      description: "Local HTTP API serving read and write endpoints, Server-Sent Events, and OpenAPI documentation for Riot Client and Valorant.",
    },
    paths,
    components: {
      schemas,
    },
  };
}
