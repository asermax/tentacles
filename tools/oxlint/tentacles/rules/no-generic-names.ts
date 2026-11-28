import { defineRule } from "@oxlint/plugins";

import { bindingIdentifiers } from "./binding-identifiers.ts";
import { hasExternalAnnotation } from "./external-annotation.ts";
import { isExternalCall } from "./external-callee.ts";
import { collectFileScope } from "./file-scope.ts";

import type { FileScope } from "./file-scope.ts";
import type { ESTree } from "@oxlint/plugins";

type AnyFunction = ESTree.Function | ESTree.ArrowFunctionExpression;

const deniedNames = new Set([
  "data",
  "result",
  "value",
  "info",
  "item",
  "items",
  "pending",
  "handle",
  "process",
  "run",
  "collect",
  "settle",
  "release",
  "tree",
  "lines",
  "page",
  "input",
  "writes",
  "rows",
  "response",
  "body",
  "state",
  "last",
  "other",
  "handlers",
  "saved",
]);

const keyedCollectionName = /By[A-Z]/;
const pastParticipleName = /^[a-z]+ed$/;

const notParticiples = new Set([
  "seed",
  "need",
  "speed",
  "feed",
  "bed",
  "red",
  "shed",
  "bleed",
  "breed",
  "embed",
  "exceed",
  "proceed",
  "succeed",
  "indeed",
]);

const isFunction = (node: ESTree.Node): node is AnyFunction =>
  node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression";

const returnsTypePredicate = (node: AnyFunction) =>
  node.returnType?.typeAnnotation.type === "TSTypePredicate";

const unwrap = (node: ESTree.Node): ESTree.Node =>
  node.type === "TSAsExpression" ||
  node.type === "TSSatisfiesExpression" ||
  node.type === "TSNonNullExpression" ||
  node.type === "ParenthesizedExpression"
    ? unwrap(node.expression)
    : node;

const isCollectionConstruction = (node: ESTree.Node) => {
  const construction = unwrap(node);

  return (
    construction.type === "NewExpression" &&
    construction.callee.type === "Identifier" &&
    (construction.callee.name === "Map" || construction.callee.name === "WeakMap")
  );
};

const isCallResult = (node: ESTree.Node) => {
  const expression = unwrap(node);

  return (
    expression.type === "CallExpression" ||
    (expression.type === "AwaitExpression" && unwrap(expression.argument).type === "CallExpression")
  );
};

/** A name states what a value holds or what a function does to what, so `data` and `result` are not names. */
export const noGenericNamesRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Name bindings after what they hold or do, not with a generic word.",
    },
    messages: {
      deniedName:
        "`{{name}}` says nothing about what it holds or does. Name a value after its content and a function after its action and object. (naming/values, Knowledge)",
      collectionName:
        "Name the keyed collection `{{name}}` after its key, as in `valueBy<Key>`. (naming/values, Knowledge)",
      participleName:
        "`{{name}}` is a past participle that does not say what the call returned. Name the value after its result. (naming/values, Knowledge)",
    },
  },
  createOnce(context) {
    let scope: FileScope | null = null;
    let functionsWithForeignParams = new WeakSet<ESTree.Node>();

    const fileScope = () => {
      scope ??= collectFileScope(context.sourceCode.ast);

      return scope;
    };

    const reportFunction = (node: AnyFunction) => {
      const params =
        functionsWithForeignParams.has(node) || returnsTypePredicate(node) ? [] : node.params;

      const identifiers = [
        ...bindingIdentifiers(node.type === "ArrowFunctionExpression" ? null : node.id),
        ...params
          .filter((param) => !hasExternalAnnotation(param, fileScope()))
          .flatMap((param) => bindingIdentifiers(param)),
      ];

      for (const identifier of identifiers) {
        if (deniedNames.has(identifier.name)) {
          context.report({
            node: identifier,
            messageId: "deniedName",
            data: { name: identifier.name },
          });
        }
      }
    };

    return {
      before() {
        scope = null;
        functionsWithForeignParams = new WeakSet();
      },
      CallExpression(node) {
        const callbacks = node.arguments.filter((argument) => isFunction(argument));

        if (callbacks.length > 0 && isExternalCall(node, fileScope())) {
          for (const callback of callbacks) {
            functionsWithForeignParams.add(callback);
          }
        }
      },
      VariableDeclarator(node) {
        if (node.parent.type === "VariableDeclaration" && node.parent.declare === true) {
          return;
        }

        if (hasExternalAnnotation(node.id, fileScope())) {
          const initializer = node.init == null ? null : unwrap(node.init);

          if (initializer != null && isFunction(initializer)) {
            functionsWithForeignParams.add(initializer);
          }

          return;
        }

        for (const identifier of bindingIdentifiers(node.id)) {
          const { name } = identifier;

          if (deniedNames.has(name)) {
            context.report({ node: identifier, messageId: "deniedName", data: { name } });
          } else if (
            node.id.type === "Identifier" &&
            node.init != null &&
            isCollectionConstruction(node.init) &&
            !keyedCollectionName.test(name)
          ) {
            context.report({ node: identifier, messageId: "collectionName", data: { name } });
          } else if (
            node.id.type === "Identifier" &&
            node.init != null &&
            !notParticiples.has(name) &&
            pastParticipleName.test(name) &&
            isCallResult(node.init)
          ) {
            context.report({ node: identifier, messageId: "participleName", data: { name } });
          }
        }
      },
      FunctionDeclaration: reportFunction,
      FunctionExpression: reportFunction,
      ArrowFunctionExpression: reportFunction,
      CatchClause(node) {
        for (const identifier of bindingIdentifiers(node.param)) {
          if (deniedNames.has(identifier.name)) {
            context.report({
              node: identifier,
              messageId: "deniedName",
              data: { name: identifier.name },
            });
          }
        }
      },
    };
  },
});
