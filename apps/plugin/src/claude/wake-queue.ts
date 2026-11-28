/**
 * Serializes wakes into prompts. A submitted prompt cannot be withdrawn and
 * waits for the session to go idle, so while one is in flight every later
 * wake folds into the next prompt instead of queueing a turn of its own.
 */
export const createWakeQueue = (
  submit: (text: string) => Promise<void>,
): ((text: string) => void) => {
  let pendingWakes: Array<string> = [];
  let isInFlight = false;

  const flush = async (): Promise<void> => {
    if (isInFlight || pendingWakes.length === 0) {
      return;
    }

    const text = pendingWakes.join("\n\n");

    isInFlight = true;
    pendingWakes = [];

    // A refused prompt loses this wake only; list stays the backstop.
    await submit(text).catch(() => undefined);

    isInFlight = false;
    void flush();
  };

  return (text) => {
    pendingWakes.push(text);
    void flush();
  };
};
