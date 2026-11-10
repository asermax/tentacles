/** Polls until `check` holds or `timeoutMs` passes. */
export const eventually = async (check: () => boolean, timeoutMs = 2000) => {
  for (let waited = 0; !check() && waited < timeoutMs; waited += 20) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};
