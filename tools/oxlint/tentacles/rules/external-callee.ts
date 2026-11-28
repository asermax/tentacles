import type { FileScope } from "./file-scope.ts";
import type { ESTree } from "@oxlint/plugins";

const rootName = (node: ESTree.Node): string | null => {
  switch (node.type) {
    case "Identifier":
      return node.name;
    case "MemberExpression":
      return rootName(node.object);
    case "CallExpression":
      return rootName(node.callee);
    case "ChainExpression":
      return rootName(node.expression);
    case "TSNonNullExpression":
      return rootName(node.expression);
    default:
      return null;
  }
};

/** A call whose callee starts at an identifier imported from another package, such as `HttpApiBuilder.group(...)`. */
export const isExternalCall = (node: ESTree.CallExpression, scope: FileScope) => {
  const name = rootName(node.callee);

  return name != null && scope.externalImports.has(name);
};
