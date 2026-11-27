/** What the promise rejects with, or null when it resolves. */
export const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (cause: unknown) => cause,
  );
