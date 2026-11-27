import * as Schema from "effect/Schema";

/** The one workspace image; custom images are not offered. */
export const defaultImage = "default";

const InstanceTypes = {
  lite: "lite",
  basic: "basic",
  standard1: "standard-1",
  standard2: "standard-2",
  standard3: "standard-3",
  standard4: "standard-4",
} as const;

/** The size a workspace starts with until its setup keeps one. */
export const defaultSize = InstanceTypes.basic;

/** The container the session's settings ask for: the one image and a Cloudflare instance type. */
export const ContainerSettings = Schema.Struct({
  image: Schema.Literal(defaultImage),
  size: Schema.Enum(InstanceTypes),
});

/** Why a session's settings name no container this setup can start. */
export const unsupportedSettings = ({ image, size }: { image: string; size: string }) =>
  `The workspace takes the image "${defaultImage}" and a Cloudflare instance type as its size; got image "${image}" and size "${size}"`;
