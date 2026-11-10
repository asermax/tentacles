import type { FauxResponseFactory } from "@earendil-works/pi-ai/providers/faux";
import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";

/**
 * A model answer that waits until the test releases it, or until its request
 * is aborted, as a long turn would.
 */
export const heldAnswer = (text: string) => {
  const released = Promise.withResolvers<void>();

  const response: FauxResponseFactory = (_context, options) =>
    new Promise((resolve) => {
      const answer = () => resolve(fauxAssistantMessage(text));

      void released.promise.then(answer);
      options?.signal?.addEventListener("abort", answer, { once: true });
    });

  return { response, release: () => released.resolve() };
};
