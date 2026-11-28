import { eslintCompatPlugin } from "@oxlint/plugins";

import { noAdHocErrorMessageRule } from "./rules/no-ad-hoc-error-message.ts";
import { noAdHocEventLineRule } from "./rules/no-ad-hoc-event-line.ts";
import { noEnumRule } from "./rules/no-enum.ts";
import { noGenericNamesRule } from "./rules/no-generic-names.ts";
import { nullCheckRule } from "./rules/null-check.ts";
import { testLocationRule } from "./rules/test-location.ts";

/** tentacles' TypeScript and test conventions that oxlint does not ship. */
const tentaclesPlugin = eslintCompatPlugin({
  meta: { name: "tentacles" },
  rules: {
    "null-check": nullCheckRule,
    "no-enum": noEnumRule,
    "test-location": testLocationRule,
    "no-ad-hoc-event-line": noAdHocEventLineRule,
    "no-ad-hoc-error-message": noAdHocErrorMessageRule,
    "no-generic-names": noGenericNamesRule,
  },
});

export default tentaclesPlugin;
