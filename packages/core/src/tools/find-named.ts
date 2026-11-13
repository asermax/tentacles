/** The held entry named `name`; throws with the names held when there is none. */
export const findNamed = <Held extends { readonly name: string }>(
  kind: { readonly singular: string; readonly plural: string },
  held: readonly Held[],
  name: string,
) => {
  const found = held.find((candidate) => candidate.name === name);

  if (found == null) {
    const names = held.map((candidate) => candidate.name).join(", ");

    throw new Error(
      `No ${kind.singular} ${name}. ${kind.plural}: ${names === "" ? "none" : names}`,
    );
  }

  return found;
};
