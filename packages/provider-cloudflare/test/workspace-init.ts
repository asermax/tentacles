import type { WorkspaceInit } from "@tentacles/contracts/workspace";

/** A setup request for a workspace with no repository and no archives, with the given parts replaced. */
export const workspaceInit = (overrides: Partial<WorkspaceInit> = {}): WorkspaceInit => ({
  repository: null,
  image: "default",
  size: "basic",
  skills: null,
  context: null,
  ...overrides,
});
