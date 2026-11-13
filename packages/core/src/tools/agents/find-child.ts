import type { Child } from "./subagents-doc.ts";

export const findChild = (children: readonly Child[], id: string) => {
  const child = children.find((each) => each.id === id);

  if (child == null) {
    throw new Error(`No subagent with id ${id}. Use the list action to see them.`);
  }

  return child;
};
