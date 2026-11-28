import type { ESTree } from "@oxlint/plugins";

export type Pattern = ESTree.ParamPattern | ESTree.BindingPattern | ESTree.BindingRestElement;

/** The names a pattern declares. A shorthand destructured field keeps its source's name, so it is not one of them. */
export const bindingIdentifiers = (pattern: Pattern | null): ESTree.BindingIdentifier[] => {
  if (pattern == null) {
    return [];
  }

  switch (pattern.type) {
    case "Identifier":
      return [pattern];
    case "AssignmentPattern":
      return bindingIdentifiers(pattern.left);
    case "RestElement":
      return bindingIdentifiers(pattern.argument);
    case "TSParameterProperty":
      return bindingIdentifiers(pattern.parameter);
    case "ArrayPattern":
      return pattern.elements.flatMap((element) => bindingIdentifiers(element));
    default:
      return pattern.properties.flatMap((property) => {
        if (property.type === "RestElement") {
          return bindingIdentifiers(property);
        }

        return property.shorthand ? [] : bindingIdentifiers(property.value);
      });
  }
};
