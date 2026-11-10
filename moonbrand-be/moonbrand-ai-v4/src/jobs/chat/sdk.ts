import { z } from 'zod';

// Al posto di tool e createSdkMcpServer dell'Agent SDK: i file dei tool sono quelli del v3, ma qui non diventano server
// MCP. Restano definizioni (nome, descrizione, schema zod, funzione) che l'estensione di Pi (pi/moonbrand.ts) registra
// come tool di Pi.

export interface ToolResult {
  content: { type: string; text?: string; data?: string; mimeType?: string }[];
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
  handler: (args: any) => Promise<ToolResult> | ToolResult;
}

export function tool<Shape extends z.ZodRawShape>(
  name: string,
  description: string,
  inputSchema: Shape,
  handler: (args: z.infer<z.ZodObject<Shape>>) => Promise<ToolResult> | ToolResult,
  _extras?: unknown,
): ToolDefinition {
  return { name, description, inputSchema, handler };
}

export interface ToolGroup {
  name: string;
  tools: ToolDefinition[];
}

export function createSdkMcpServer({ name, tools }: { name: string; version?: string; tools: ToolDefinition[] }): ToolGroup {
  return { name, tools };
}
