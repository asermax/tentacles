import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";

/** A model turn that runs one code mode script. */
export const script = (code: string) =>
  fauxAssistantMessage(fauxToolCall("codemode", { code }), { stopReason: "toolUse" });

// The code mode tool reports a script's returned text after its timing lines.
const outputMarker = "Output:\n";

/** The text a script returned, out of the code mode tool's result. */
export const scriptOutput = (result: string | undefined) => {
  const at = result?.indexOf(outputMarker) ?? -1;

  if (result == null || at === -1) {
    throw new Error(`not a finished script's result: ${result}`);
  }

  return result.slice(at + outputMarker.length);
};
