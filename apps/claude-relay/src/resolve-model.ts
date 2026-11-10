import { discoverClaudeModels } from "@earendil-works/pi-claude-code/src/claude-cli.ts";
import {
  CLAUDE_CODE_MODELS,
  modelFromDiscovery,
  type ClaudeCodeModel,
} from "@earendil-works/pi-claude-code/src/model-catalog.ts";

let discovered: Promise<ReadonlyArray<ClaudeCodeModel>> | undefined;

// pi-claude-code's offline catalog lags behind the CLI, so an id it lacks is looked up in the catalog the
// installed CLI serves. Asking spawns a CLI process, so the answer is kept; a failed ask is retried.
const cliModels = () => {
  if (discovered == null) {
    discovered = discoverClaudeModels().then((models) => models.map(modelFromDiscovery));

    discovered.catch(() => {
      discovered = undefined;
    });
  }

  return discovered;
};

/** The model for an id from pi-claude-code's catalog or the CLI's; undefined when both lack it. */
export const resolveModel = async (modelId: string): Promise<ClaudeCodeModel | undefined> =>
  CLAUDE_CODE_MODELS.find((model) => model.id === modelId) ??
  (await cliModels()).find((model) => model.id === modelId);
