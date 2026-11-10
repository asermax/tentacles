import { eslintCompatPlugin } from "@oxlint/plugins";

import { noEnumRule } from "./rules/no-enum.ts";
import { nullCheckRule } from "./rules/null-check.ts";
import { testLocationRule } from "./rules/test-location.ts";

/** tentacles' TypeScript and test conventions that oxlint does not ship. */
const tentaclesPlugin = eslintCompatPlugin({
  meta: { name: "tentacles" },
  rules: {
    "null-check": nullCheckRule,
    "no-enum": noEnumRule,
    "test-location": testLocationRule,
  },
});

export default tentaclesPlugin;
