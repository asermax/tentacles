import { build } from "vite";

// The process tests run the relay as the image does, from the bundle the build writes to dist/.
export const setup = async () => {
  await build({ root: new URL("..", import.meta.url).pathname, logLevel: "warn" });
};
