import { describe, it } from "vitest";
import { RuleTester } from "oxlint/plugins-dev";

import { noAdHocEventLineRule } from "../tentacles/rules/no-ad-hoc-event-line.ts";

RuleTester.describe = describe;

RuleTester.it = it;

const tester = new RuleTester();

const relayFile = "/repo/apps/claude-relay/src/server.ts";
const eventLineFile = "/repo/packages/relay-protocol/src/event-line.ts";

tester.run("no-ad-hoc-event-line", noAdHocEventLineRule, {
  valid: [
    { code: "const line = eventLine(event);", filename: relayFile },
    { code: "const text = JSON.stringify(event);", filename: relayFile },
    { code: "const text = JSON.stringify(event) + suffix;", filename: relayFile },
    { code: 'const text = JSON.stringify(event) + "\\n\\n";', filename: relayFile },
    { code: 'const text = JSON.stringify(value, null, 2) + "\\n";', filename: relayFile },
    { code: "const text = `${JSON.stringify(value, null, 2)}\\n`;", filename: relayFile },
    { code: 'const text = "\\n" + JSON.stringify(event);', filename: relayFile },
    { code: 'const text = other.stringify(event) + "\\n";', filename: relayFile },
    { code: "const text = `${label}\\n`;", filename: relayFile },
    { code: "const text = `${JSON.stringify(event)} done\\n`;", filename: relayFile },
    { code: "const text = `${JSON.stringify(event)}`;", filename: relayFile },
    { code: "const text = `${JSON.stringify(event)}${terminator}`;", filename: relayFile },
    { code: "const text = `${JSON.stringify(event)}\\n`;", filename: eventLineFile },
    { code: 'const text = JSON.stringify(event) + "\\n";', filename: eventLineFile },
  ],
  invalid: [
    {
      code: "const text = `${JSON.stringify(event)}\\n`;",
      filename: relayFile,
      errors: [{ messageId: "adHocEventLine" }],
    },
    {
      code: "const text = `event: ${JSON.stringify(event)}\\n`;",
      filename: relayFile,
      errors: [{ messageId: "adHocEventLine" }],
    },
    {
      code: 'const text = JSON.stringify(event) + "\\n";',
      filename: relayFile,
      errors: [{ messageId: "adHocEventLine" }],
    },
    {
      code: 'response.write(JSON.stringify(event, replacer) + "\\n");',
      filename: "/repo/packages/provider-cloudflare/test/fake-container.ts",
      errors: [{ messageId: "adHocEventLine" }],
    },
    {
      code: "const text = `${JSON.stringify(event)}\\n`;",
      filename: "/repo/packages/relay-protocol/src/other.ts",
      errors: [{ messageId: "adHocEventLine" }],
    },
  ],
});
