import type { FileScope } from "./file-scope.ts";
import type { Pattern } from "./binding-identifiers.ts";
import type { ESTree } from "@oxlint/plugins";

// Generic containers and utility types of the language itself. A parameter typed `ReadonlyArray<string>` has no
// library vocabulary to follow, so these do not count as ambient types.
const languageTypes = new Set([
  "Array",
  "ReadonlyArray",
  "Promise",
  "PromiseLike",
  "Record",
  "Partial",
  "Required",
  "Readonly",
  "Pick",
  "Omit",
  "Exclude",
  "Extract",
  "NonNullable",
  "ReturnType",
  "Parameters",
  "ConstructorParameters",
  "InstanceType",
  "Awaited",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "ReadonlyMap",
  "ReadonlySet",
  "Iterable",
  "AsyncIterable",
  "Iterator",
  "AsyncIterator",
  "IterableIterator",
  "Generator",
  "AsyncGenerator",
  "Date",
  "RegExp",
  "Error",
  "Function",
  "Object",
  "Symbol",
  "BigInt",
  "ArrayBuffer",
  "Uint8Array",
]);

const rootName = (node: ESTree.Node): string | null => {
  if (node.type === "Identifier") {
    return node.name;
  }

  return node.type === "TSQualifiedName" ? rootName(node.left) : null;
};

const headNames = (type: ESTree.TSType): string[] => {
  switch (type.type) {
    case "TSTypeReference": {
      const name = rootName(type.typeName);

      return name == null ? [] : [name];
    }

    case "TSTypeQuery": {
      const name = rootName(type.exprName);

      return name == null ? [] : [name];
    }

    case "TSUnionType":
    case "TSIntersectionType":
      return type.types.flatMap((member) => headNames(member));
    case "TSIndexedAccessType":
      return headNames(type.objectType);
    case "TSTypeOperator":
    case "TSParenthesizedType":
      return headNames(type.typeAnnotation);
    default:
      return [];
  }
};

const isExternalName = (name: string, scope: FileScope) => {
  if (scope.externalImports.has(name)) {
    return true;
  }

  return !(scope.internalImports.has(name) || scope.declared.has(name) || languageTypes.has(name));
};

const annotationOf = (pattern: Pattern): ESTree.TSType | null => {
  switch (pattern.type) {
    case "AssignmentPattern":
      return annotationOf(pattern.left);
    case "TSParameterProperty":
      return annotationOf(pattern.parameter);
    case "RestElement":
      return pattern.typeAnnotation?.typeAnnotation ?? annotationOf(pattern.argument);
    default:
      return pattern.typeAnnotation?.typeAnnotation ?? null;
  }
};

/**
 * A pattern annotated with a type from another package, or with an ambient type (a global such as
 * `DurableObjectState` or `typeof fetch`), takes its names from that type's vocabulary.
 */
export const hasExternalAnnotation = (pattern: Pattern, scope: FileScope) => {
  const annotation = annotationOf(pattern);

  return annotation != null && headNames(annotation).some((name) => isExternalName(name, scope));
};
