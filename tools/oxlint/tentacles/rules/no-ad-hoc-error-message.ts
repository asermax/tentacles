import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

const messageOfFile = /(^|\/)packages\/common\/src\/message-of\.ts$/;

const identifierName = (node: ESTree.Node) => (node.type === "Identifier" ? node.name : null);

const isInstanceOfError = (node: ESTree.Node, name: string) =>
  node.type === "BinaryExpression" &&
  node.operator === "instanceof" &&
  identifierName(node.left) === name &&
  identifierName(node.right) === "Error";

const isMessageOf = (node: ESTree.Node, name: string) =>
  node.type === "MemberExpression" &&
  !node.computed &&
  identifierName(node.object) === name &&
  identifierName(node.property) === "message";

const isStringOf = (node: ESTree.Node, name: string) =>
  node.type === "CallExpression" &&
  identifierName(node.callee) === "String" &&
  node.arguments.length === 1 &&
  node.arguments[0] != null &&
  identifierName(node.arguments[0]) === name;

/** How an unknown cause becomes a message is decided once, by `messageOf`. */
export const noAdHocErrorMessageRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Use messageOf instead of `x instanceof Error ? x.message : String(x)`.",
    },
    messages: {
      adHocErrorMessage:
        "Use `messageOf` from `@tentacles/common/message-of` instead of repeating `{{name}} instanceof Error ? {{name}}.message : String({{name}})`. (design/red-flags, Knowledge: Information leakage)",
    },
  },
  createOnce(context) {
    return {
      before() {
        return !messageOfFile.test(context.filename.replaceAll("\\", "/"));
      },
      ConditionalExpression(node) {
        const name = node.test.type === "BinaryExpression" ? identifierName(node.test.left) : null;

        if (
          name != null &&
          isInstanceOfError(node.test, name) &&
          isMessageOf(node.consequent, name) &&
          isStringOf(node.alternate, name)
        ) {
          context.report({ node, messageId: "adHocErrorMessage", data: { name } });
        }
      },
    };
  },
});
