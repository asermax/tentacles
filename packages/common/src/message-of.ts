/** The text of a thrown or rejected value: an Error's message, or the value as a string. */
export const messageOf = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause);
