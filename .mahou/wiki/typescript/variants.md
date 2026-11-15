# Variants with Effect Schema

Overrides the global `typescript/variants` entry for unions declared with Effect Schema.

## Knowledge

- A union declared with `Schema.TaggedStruct` per shape and `Schema.toTaggedUnion("_tag")` already carries its tags as a map: `.cases` holds one constructor per tag and `.guards` one guard per tag. That union is the constant map the global entry asks for; declare no second map of the tag names.
- The discriminant is `_tag`, the field Effect's tagged structs use.
- Branch on such a union with `Match.tagsExhaustive` or the union's `.match`, which fail to compile when a shape is added, instead of a `switch` with a `never` default.
