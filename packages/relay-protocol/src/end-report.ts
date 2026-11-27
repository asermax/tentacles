import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { CallId } from "./call-id";

const endReportPattern = /^\/claude\/calls\/([^/]+)\/end$/;

const decodeCallId = Schema.decodeUnknownOption(CallId);

/** The path the relay posts to when a call ends; the host is the sender's. */
export const endReportPath = (callId: CallId) => `/claude/calls/${callId}/end`;

/** The call an end report's path names, or none when the path is not an end report's. */
export const parseEndReportPath = (path: string) =>
  Option.flatMap(Option.fromNullishOr(endReportPattern.exec(path)?.[1]), decodeCallId);
