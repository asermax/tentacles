// Preloaded into the relay the process tests start: a signal makes the process fail outside any call,
// by an exception thrown from a handler (SIGUSR2) or by a rejection nobody handles (SIGHUP).
process.on("SIGUSR2", () => {
  throw new Error("test hook: uncaught exception");
});

process.on("SIGHUP", () => {
  void Promise.reject(new Error("test hook: unhandled rejection"));
});
