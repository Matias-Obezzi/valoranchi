export interface McpToolProperty {
  type: string;
  description: string;
}

export interface McpToolInputSchema {
  type: "object";
  properties: Record<string, McpToolProperty>;
  required?: string[];
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: McpToolInputSchema;
}

export interface McpTextContent {
  type: "text";
  text: string;
}

export interface McpToolResult {
  content: McpTextContent[];
  structuredContent?: unknown;
  isError?: boolean;
}

export interface McpServerOptions {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  version?: string;
}

export interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}
