const connectionLostPattern = /connection.?lost/i;

/**
 * The error text of a call the model never answered because the path to it broke. It matches pi-ai's
 * retry pattern (connection.?lost), so pi-durable retries the call; pi-durable reads only this text.
 */
export const lostCallMessage = (errorMessage: string) =>
  `Claude relay lost the call (connection lost): ${errorMessage}`;

/** Whether an error text already reads as a lost call, which pi-durable retries. */
export const isLostCallMessage = (errorMessage: string) => connectionLostPattern.test(errorMessage);
