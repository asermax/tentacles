import { defineRule } from "@oxlint/plugins";

const testFile = /\.test\.tsx?$/;
const testFolder = /\/(apps|packages)\/[^/]+\/test\//;

/** Tests exercise a package or app through its entry points, so they live in its test folder. */
export const testLocationRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Keep test files in the test folder of their app or package.",
    },
    messages: {
      misplacedTest: "Move this test to the test folder of its app or package, next to src.",
    },
  },
  createOnce(context) {
    return {
      Program(node) {
        const filename = context.filename.replaceAll("\\", "/");

        if (testFile.test(filename) && !testFolder.test(filename)) {
          context.report({ node, messageId: "misplacedTest" });
        }
      },
    };
  },
});
