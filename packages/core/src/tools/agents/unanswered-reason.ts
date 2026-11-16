import * as Predicate from "effect/Predicate";

type Unanswered = { readonly reason: string; readonly detail?: unknown };

/** The reason pi-durable settled a child's input unanswered, with the failure's message when it carries one. */
export const unansweredReason = ({ reason, detail }: Unanswered) =>
  Predicate.isString(detail) ? `${reason}: ${detail}` : reason;
