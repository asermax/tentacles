import * as Predicate from "effect/Predicate";

import { bindingIdentifiers } from "./binding-identifiers.ts";

import type { ESTree } from "@oxlint/plugins";

export interface FileScope {
  readonly externalImports: ReadonlySet<string>;
  readonly internalImports: ReadonlySet<string>;
  readonly declared: ReadonlySet<string>;
}

/** An import source owned by another package, as opposed to a relative path or a tentacles workspace package. */
const isExternalSource = (source: string) =>
  !source.startsWith(".") && !source.startsWith("@tentacles/");

const isNode = (value: unknown): value is ESTree.Node =>
  Predicate.hasProperty(value, "type") && Predicate.isString(value.type);

const childrenOf = (node: ESTree.Node): ESTree.Node[] =>
  Object.entries(node).flatMap(([key, value]) => {
    if (key === "parent") {
      return [];
    }

    if (Array.isArray(value)) {
      return value.filter(isNode);
    }

    return isNode(value) ? [value] : [];
  });

/** Every imported name, split by where its module lives, and every name the file declares (values, types, type parameters). */
export const collectFileScope = (program: ESTree.Program): FileScope => {
  const externalImports = new Set<string>();
  const internalImports = new Set<string>();
  const declared = new Set<string>();
  const unvisited: ESTree.Node[] = [program];

  for (let node = unvisited.pop(); node != null; node = unvisited.pop()) {
    unvisited.push(...childrenOf(node));

    switch (node.type) {
      case "ImportDeclaration": {
        const names = isExternalSource(node.source.value) ? externalImports : internalImports;

        for (const specifier of node.specifiers) {
          names.add(specifier.local.name);
        }

        break;
      }

      case "TSTypeAliasDeclaration":
      case "TSInterfaceDeclaration":
      case "TSEnumDeclaration":
        declared.add(node.id.name);
        break;
      case "TSTypeParameter":
        declared.add(node.name.name);
        break;
      case "ClassDeclaration":
      case "ClassExpression":
      case "FunctionDeclaration":
        if (node.id != null) {
          declared.add(node.id.name);
        }

        break;
      case "TSModuleDeclaration":
        if (node.id.type === "Identifier") {
          declared.add(node.id.name);
        }

        break;
      case "VariableDeclarator":
        for (const identifier of bindingIdentifiers(node.id)) {
          declared.add(identifier.name);
        }

        break;
    }
  }

  return { externalImports, internalImports, declared };
};
