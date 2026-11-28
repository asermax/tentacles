import * as Option from "effect/Option";

import { decodeCallId, type CallId } from "./call-id";

const endReportPattern = /^\/claude\/calls\/([^/]+)\/end$/;

/** The host the relay posts end reports to; the container's loopback interception answers it, and it is not on any network. */
export const endReportHost = "tentacles.internal";

/** The path the relay posts to when a call ends. */
export const endReportPath = (callId: CallId) => `/claude/calls/${callId}/end`;

/** The call an end report's path names, or none when the path is not an end report's. */
export const parseEndReportPath = (path: string) =>
  Option.flatMap(Option.fromNullishOr(endReportPattern.exec(path)?.[1]), decodeCallId);
