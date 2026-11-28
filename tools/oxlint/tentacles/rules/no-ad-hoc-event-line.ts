import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

const eventLineFile = /(^|\/)packages\/relay-protocol\/src\/event-line\.ts$/;

// A third argument indents the output, which is a file's text and cannot be one NDJSON line.
const isCompactJsonStringifyCall = (node: ESTree.Node) =>
  node.type === "CallExpression" &&
  node.arguments.length < 3 &&
  node.callee.type === "MemberExpression" &&
  !node.callee.computed &&
  node.callee.object.type === "Identifier" &&
  node.callee.object.name === "JSON" &&
  node.callee.property.type === "Identifier" &&
  node.callee.property.name === "stringify";

const isBareNewline = (node: ESTree.Node) => node.type === "Literal" && node.value === "\n";

/** The framing of an NDJSON line (the serialized event plus its terminator) is owned by `eventLine`. */
export const noAdHocEventLineRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Frame NDJSON lines with eventLine instead of appending a newline to JSON.stringify.",
    },
    messages: {
      adHocEventLine:
        "Frame the line with `eventLine` from `@tentacles/relay-protocol/event-line` instead of ending `JSON.stringify(...)` with a newline. (design/red-flags, Knowledge: Information leakage)",
    },
  },
  createOnce(context) {
    return {
      before() {
        return !eventLineFile.test(context.filename.replaceAll("\\", "/"));
      },
      TemplateLiteral(node) {
        const lastExpression = node.expressions.at(-1);

        if (
          lastExpression != null &&
          node.quasis.at(-1)?.value.cooked === "\n" &&
          isCompactJsonStringifyCall(lastExpression)
        ) {
          context.report({ node, messageId: "adHocEventLine" });
        }
      },
      BinaryExpression(node) {
        if (
          node.operator === "+" &&
          isCompactJsonStringifyCall(node.left) &&
          isBareNewline(node.right)
        ) {
          context.report({ node, messageId: "adHocEventLine" });
        }
      },
    };
  },
});
