import type { DiscoveredClaudeModel } from "./model-catalog.d";

export declare const discoverClaudeModels: (
  envInput?: Record<string, string | undefined>,
  signal?: AbortSignal,
  timeoutMs?: number,
) => Promise<Array<DiscoveredClaudeModel>>;
