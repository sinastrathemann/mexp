import { z } from "zod";

export const mcpToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  inputSchema: z.record(z.string(), z.unknown()).default({}),
});

export type McpTool = z.infer<typeof mcpToolSchema>;

export interface McpToolRegistry {
  list(): McpTool[];
  register(tool: McpTool): void;
}

export class InMemoryMcpToolRegistry implements McpToolRegistry {
  private readonly tools = new Map<string, McpTool>();

  list(): McpTool[] {
    return Array.from(this.tools.values());
  }

  register(tool: McpTool): void {
    const parsed = mcpToolSchema.parse(tool);
    this.tools.set(parsed.name, parsed);
  }
}
