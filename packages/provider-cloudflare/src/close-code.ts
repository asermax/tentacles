/**
 * The close code a socket can send for a close the runtime reported: 1005 (no
 * code received) and 1006 (dropped without a close frame) are reserved for
 * reporting, and close() rejects them.
 */
export const sendableCode = (code: number) => (code === 1005 || code === 1006 ? 1000 : code);
