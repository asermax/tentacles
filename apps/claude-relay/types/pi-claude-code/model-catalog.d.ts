import type { Model } from "@earendil-works/pi-ai";

export type ClaudeCodeModel = Model<"claude-code-stream-json">;

export interface DiscoveredClaudeModel {
  value: string;
  resolvedModel?: string;
  displayName: string;
  description: string;
  supportsEffort?: boolean;
  supportedEffortLevels?: Array<"low" | "medium" | "high" | "xhigh" | "max">;
  supportsAdaptiveThinking?: boolean;
  supportsFastMode?: boolean;
  supportsAutoMode?: boolean;
}

export declare const CLAUDE_CODE_MODELS: Array<ClaudeCodeModel>;

export declare const modelFromDiscovery: (info: DiscoveredClaudeModel) => ClaudeCodeModel;
