/** The Worker secrets the tests bind; the Worker reads them as plain text. */
export const testSecrets = {
  TENTACLES_API_KEY: "test-api-key-0123456789abcdef0123456789",
  TENTACLES_CLAUDE_TOKEN: "test-claude-token",
  TENTACLES_GITHUB_TOKEN: "test-github-token",
  TENTACLES_CDP_SECRET: "test-cdp-secret-0123456789abcdef0123456789",
} as const;
