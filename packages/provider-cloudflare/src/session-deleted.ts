/**
 * The reason a session object aborts with once it has deleted itself, which rejects the delete call.
 * The abort drops the instance, whose memory still holds the session, so a later call builds a new
 * one over the empty storage and finds no session.
 */
export const sessionDeletedReason = "session deleted";
