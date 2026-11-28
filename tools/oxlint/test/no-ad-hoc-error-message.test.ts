import { describe, it } from "vitest";
import { RuleTester } from "oxlint/plugins-dev";

import { noAdHocErrorMessageRule } from "../tentacles/rules/no-ad-hoc-error-message.ts";

RuleTester.describe = describe;

RuleTester.it = it;

const tester = new RuleTester();

const relayFile = "/repo/apps/claude-relay/src/log.ts";
const messageOfFile = "/repo/packages/common/src/message-of.ts";

tester.run("no-ad-hoc-error-message", noAdHocErrorMessageRule, {
  valid: [
    { code: "const text = messageOf(cause);", filename: relayFile },
    {
      code: "const text = cause instanceof Error ? cause.message : String(other);",
      filename: relayFile,
    },
    {
      code: "const text = cause instanceof Error ? other.message : String(cause);",
      filename: relayFile,
    },
    {
      code: "const text = cause instanceof Error ? cause.stack : String(cause);",
      filename: relayFile,
    },
    {
      code: "const text = cause instanceof Error ? cause.message : JSON.stringify(cause);",
      filename: relayFile,
    },
    {
      code: "const text = cause instanceof TypeError ? cause.message : String(cause);",
      filename: relayFile,
    },
    {
      code: "const text = cause instanceof Error ? cause.message : String(cause, 1);",
      filename: relayFile,
    },
    {
      code: 'const text = cause instanceof Error ? cause["message"] : String(cause);',
      filename: relayFile,
    },
    {
      code: "const text = cause instanceof Error ? cause.message : undefined;",
      filename: relayFile,
    },
    {
      code: "const text = cause instanceof Error ? cause.message : String(cause);",
      filename: messageOfFile,
    },
  ],
  invalid: [
    {
      code: "const text = cause instanceof Error ? cause.message : String(cause);",
      filename: relayFile,
      errors: [{ messageId: "adHocErrorMessage", data: { name: "cause" } }],
    },
    {
      code: "failCall(error instanceof Error ? error.message : String(error));",
      filename: "/repo/packages/provider-cloudflare/src/model-providers.ts",
      errors: [{ messageId: "adHocErrorMessage", data: { name: "error" } }],
    },
    {
      code: "const text = cause instanceof Error ? cause.message : String(cause);",
      filename: "/repo/packages/relay-protocol/src/message-of.ts",
      errors: [{ messageId: "adHocErrorMessage", data: { name: "cause" } }],
    },
    {
      code: "const text = cause instanceof Error ? cause.message : String(cause);",
      filename: "/repo/packages/common/src/other.ts",
      errors: [{ messageId: "adHocErrorMessage", data: { name: "cause" } }],
    },
  ],
});
