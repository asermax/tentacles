// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Pipeable.js
/**
* The `Pipeable` module defines the shared interface and implementation helpers
* for values that support Effect-style method chaining with `.pipe(...)`.
*
* A `Pipeable` value can pass itself through a sequence of unary functions from
* left to right, so code can be written as `value.pipe(f, g, h)` instead of
* deeply nesting calls. This is the method form used by many Effect data types
* to compose transformations, validations, and effectful operations while
* keeping the original value as the starting point of the pipeline.
*
* @stability stable
* @since 2.0.0
*/
/**
* Applies a `pipe` method's variadic arguments to an initial value from left
* to right.
*
* **When to use**
*
* Use to implement a custom `.pipe(...)` method from JavaScript's `arguments`
* object.
*
* **Details**
*
* This helper is intended for implementing `Pipeable.pipe` methods that
* receive JavaScript's `arguments` object. With no functions it returns the
* original value; otherwise it feeds each result into the next function.
*
* **Example** (Implementing a pipe method)
*
* ```ts import.meta.vitest
* import { Pipeable } from "effect"
*
* class NumberBox {
*   constructor(readonly value: number) {}
*
*   pipe(..._fns: ReadonlyArray<(value: number) => number>): number {
*     return Pipeable.pipeArguments(this.value, arguments) as number
*   }
* }
*
* const result = new NumberBox(5).pipe(
*   (n) => n + 2,
*   (n) => n * 3
* )
* result // => 21
* ```
*
* @stability stable
* @category combinators
* @since 2.0.0
*/
var pipeArguments = (self, args) => {
	switch (args.length) {
		case 0: return self;
		case 1: return args[0](self);
		case 2: return args[1](args[0](self));
		case 3: return args[2](args[1](args[0](self)));
		case 4: return args[3](args[2](args[1](args[0](self))));
		case 5: return args[4](args[3](args[2](args[1](args[0](self)))));
		case 6: return args[5](args[4](args[3](args[2](args[1](args[0](self))))));
		case 7: return args[6](args[5](args[4](args[3](args[2](args[1](args[0](self)))))));
		case 8: return args[7](args[6](args[5](args[4](args[3](args[2](args[1](args[0](self))))))));
		case 9: return args[8](args[7](args[6](args[5](args[4](args[3](args[2](args[1](args[0](self)))))))));
		default: {
			let ret = self;
			for (let i = 0, len = args.length; i < len; i++) ret = args[i](ret);
			return ret;
		}
	}
};
/**
* Reusable prototype that implements `Pipeable.pipe`.
*
* **When to use**
*
* Use when classes or object prototypes can reuse this value when they need the
* standard pipe implementation backed by `pipeArguments`.
*
* @stability stable
* @category prototypes
* @since 3.15.0
*/
var Prototype$1 = { pipe() {
	return pipeArguments(this, arguments);
} };
/**
* Provides a base constructor whose instances implement the standard `Pipeable.pipe`
* method.
*
* **When to use**
*
* Use when you need to define a class that supports Effect-style method
* chaining through `.pipe(...)`.
*
* @stability stable
* @category constructors
* @since 3.15.0
*/
var Class$1 = /*#__PURE__*/ function() {
	function PipeableBase() {}
	PipeableBase.prototype = Prototype$1;
	return PipeableBase;
}();
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Function.js
/**
* Creates a function that can be called in data-first style or data-last
* (`pipe`-friendly) style.
*
* **When to use**
*
* Use to expose one implementation through both direct and `pipe`-friendly
* call styles.
*
* **Details**
*
* Pass either the arity of the uncurried function or a predicate that decides
* whether the current call is data-first. Arity is the common case. Use a
* predicate when optional arguments make arity ambiguous.
*
* **Example** (Selecting data-first or data-last style by arity)
*
* ```ts import.meta.vitest
* import { Function, pipe } from "effect"
*
* const sum = Function.dual<
*   (that: number) => (self: number) => number,
*   (self: number, that: number) => number
* >(2, (self, that) => self + that)
*
* sum(2, 3) // => 5
* pipe(2, sum(3)) // => 5
* ```
*
* **Example** (Defining overloads with call signatures)
*
* ```ts import.meta.vitest
* import { Function, pipe } from "effect"
*
* const sum: {
*   (that: number): (self: number) => number
*   (self: number, that: number): number
* } = Function.dual(2, (self: number, that: number): number => self + that)
*
* sum(2, 3) // => 5
* pipe(2, sum(3)) // => 5
* ```
*
* **Example** (Selecting data-first or data-last style with a predicate)
*
* ```ts import.meta.vitest
* import { Function, pipe } from "effect"
*
* const sum = Function.dual<
*   (that: number) => (self: number) => number,
*   (self: number, that: number) => number
* >(
*   (args) => args.length === 2,
*   (self, that) => self + that
* )
*
* sum(2, 3) // => 5
* pipe(2, sum(3)) // => 5
* ```
*
* @stability stable
* @category combinators
* @since 2.0.0
*/
var dual = function(arity, body) {
	if (typeof arity === "function") return function() {
		return arity(arguments) ? body.apply(this, arguments) : (self) => body(self, ...arguments);
	};
	switch (arity) {
		case 0:
		case 1: throw new RangeError(`Invalid arity ${arity}`);
		case 2: return function(a, b) {
			if (arguments.length >= 2) return body(a, b);
			return function(self) {
				return body(self, a);
			};
		};
		case 3: return function(a, b, c) {
			if (arguments.length >= 3) return body(a, b, c);
			return function(self) {
				return body(self, a, b);
			};
		};
		default: return function() {
			if (arguments.length >= arity) return body.apply(this, arguments);
			const args = arguments;
			return function(self) {
				return body(self, ...args);
			};
		};
	}
};
/**
* Returns its input argument unchanged.
*
* **When to use**
*
* Use to return a value unchanged where a function is required.
*
* **Example** (Returning the same value)
*
* ```ts import.meta.vitest
* import { identity } from "effect"
*
* identity(5) // => 5
* ```
*
* @stability stable
* @category combinators
* @since 2.0.0
*/
var identity = (a) => a;
/**
* Creates a zero-argument function that always returns the provided value.
*
* **When to use**
*
* Use when you need a thunk or callback that returns the same value on every
* invocation.
*
* **Example** (Creating a constant thunk)
*
* ```ts import.meta.vitest
* import { Function } from "effect"
*
* const constNull = Function.constant(null)
*
* constNull() // => null
* constNull() // => null
* ```
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var constant = (value) => () => value;
/**
* Returns `true` when called.
*
* **When to use**
*
* Use when you need a thunk that returns `true` on every invocation.
*
* **Example** (Returning true from a thunk)
*
* ```ts import.meta.vitest
* import { Function } from "effect"
*
* Function.constTrue() // => true
* ```
*
* @stability stable
* @category constants
* @since 2.0.0
*/
var constTrue = /*#__PURE__*/ constant(true);
/**
* Returns `undefined` when called.
*
* **When to use**
*
* Use when you need a thunk that returns `undefined` on every invocation.
*
* **Example** (Returning undefined from a thunk)
*
* ```ts import.meta.vitest
* import { Function } from "effect"
*
* Function.constUndefined() // => undefined
* ```
*
* @stability stable
* @category constants
* @since 2.0.0
*/
var constUndefined = /*#__PURE__*/ constant(void 0);
/**
* Returns no meaningful value when called.
*
* **When to use**
*
* Use when you need a thunk that is called only for its effect and has no
* meaningful return value.
*
* **Example** (Returning void from a thunk)
*
* ```ts import.meta.vitest
* import { Function } from "effect"
*
* Function.constVoid() // => undefined
* ```
*
* @stability stable
* @category constants
* @since 2.0.0
*/
var constVoid = constUndefined;
/**
* Creates a memoized function whose input is an object, caching results by
* object identity.
*
* **When to use**
*
* Use to reuse the result of a synchronous computation whose output is stable
* for a given object reference.
*
* **Details**
*
* Each memoized wrapper owns a private `WeakMap` keyed by object identity.
*
* **Gotchas**
*
* `undefined` is reserved to represent a cache miss and is therefore not
* supported as a return value.
*
* Structurally equal objects do not share cache entries. If the same object is
* mutated after its first call, later calls still return the cached result for
* that reference.
*
* @stability stable
* @category caching
* @since 4.0.0
*/
function memoize(f) {
	const cache = /* @__PURE__ */ new WeakMap();
	return (a) => {
		const cached = cache.get(a);
		if (cached !== void 0) return cached;
		const result = f(a);
		cache.set(a, result);
		return result;
	};
}
/**
* Creates a memoized idempotent object transformation that caches both inputs
* and their outputs by object identity.
*
* **When to use**
*
* Use when an object transformation is idempotent and its output can be safely
* reused as a fixed point.
*
* **Details**
*
* After computing an input, the returned function caches both the input and
* the output. Calling it with either reference returns the output without
* invoking the supplied function again.
*
* **Gotchas**
*
* The returned function treats each computed output as a fixed point. If
* applying the supplied function to an output would produce an observably
* different value, this memoization changes that behavior.
*
* @see {@link memoize} for memoizing functions without an idempotence requirement
* @stability stable
* @category caching
* @since 4.0.0
*/
function memoizeIdempotent(f) {
	const cache = /* @__PURE__ */ new WeakMap();
	return (a) => {
		const cached = cache.get(a);
		if (cached !== void 0) return cached;
		const result = f(a);
		cache.set(a, result);
		if (result !== a) cache.set(result, result);
		return result;
	};
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/equal.js
var errorSiteKeys = [
	"line",
	"column",
	"sourceURL",
	"originalLine",
	"originalColumn"
];
/** @internal */
var getAllObjectKeys = (obj) => {
	const keys = new Set(Reflect.ownKeys(obj));
	if (obj.constructor === Object) return keys;
	if (obj instanceof Error) {
		keys.delete("stack");
		for (const key of errorSiteKeys) if (!Object.prototype.propertyIsEnumerable.call(obj, key)) keys.delete(key);
	}
	const proto = Object.getPrototypeOf(obj);
	let current = proto;
	while (current !== null && current !== Object.prototype) {
		const ownKeys = Reflect.ownKeys(current);
		for (let i = 0; i < ownKeys.length; i++) keys.add(ownKeys[i]);
		current = Object.getPrototypeOf(current);
	}
	if (keys.has("constructor") && typeof obj.constructor === "function" && proto === obj.constructor.prototype) keys.delete("constructor");
	return keys;
};
/** @internal */
var byReferenceInstances = /*#__PURE__*/ new WeakSet();
/** @internal */
var viewBytes = (view) => new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
/** @internal */
var isArrayBufferLike = (u) => u instanceof ArrayBuffer || typeof SharedArrayBuffer !== "undefined" && u instanceof SharedArrayBuffer;
/**
* Returns `undefined` for detached buffers, which can no longer be read.
*
* @internal
*/
var bufferBytes = (buffer) => {
	try {
		return new Uint8Array(buffer);
	} catch {
		return;
	}
};
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/hash.js
/**
* Back-edge count used to avoid caching entry-point-dependent hashes.
*
* @internal
*/
var backEdges = 0;
/** @internal */
var addBackEdge = () => {
	backEdges++;
};
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Predicate.js
/**
* Defines runtime checks for values.
*
* A `Predicate<A>` returns `true` or `false` for an `A`. A
* `Refinement<A, B>` is a predicate that also narrows the TypeScript type when
* it succeeds. This module includes guards for common JavaScript values,
* property and tag checks, tuple and struct checks, boolean combinators, and
* helpers for composing predicates and refinements.
*
* @stability stable
* @since 2.0.0
*/
/**
* Checks whether a value is a `string`.
*
* **When to use**
*
* Use when you need a `Predicate` guard to narrow an `unknown` value to a
* string.
*
* **Details**
*
* Uses `typeof input === "string"`.
*
* **Example** (Guarding strings)
*
* ```ts import.meta.vitest
* import { Predicate } from "effect"
*
* const data: unknown = "hi"
*
* if (Predicate.isString(data)) {
*   data.toUpperCase() // => "HI"
* }
* ```
*
* @see {@link isNumber}
* @see {@link isBoolean}
* @see {@link Refinement}
* @stability stable
* @category guards
* @since 2.0.0
*/
function isString$1(input) {
	return typeof input === "string";
}
/**
* Checks whether a value is a `number`.
*
* **When to use**
*
* Use when you need a `Predicate` guard to narrow an `unknown` value to a
* number.
*
* **Details**
*
* Uses `typeof input === "number"` and does not exclude `NaN` or `Infinity`.
*
* **Example** (Guarding numbers)
*
* ```ts import.meta.vitest
* import { Predicate } from "effect"
*
* const data: unknown = 42
*
* if (Predicate.isNumber(data)) {
*   data + 1 // => 43
* }
* ```
*
* @see {@link isBigInt}
* @see {@link isString}
* @stability stable
* @category guards
* @since 2.0.0
*/
function isNumber(input) {
	return typeof input === "number";
}
/**
* Checks whether a value is a `boolean`.
*
* **When to use**
*
* Use when you need a `Predicate` guard to narrow an `unknown` value to a
* boolean.
*
* **Details**
*
* Uses `typeof input === "boolean"`.
*
* **Example** (Guarding booleans)
*
* ```ts import.meta.vitest
* import { Predicate } from "effect"
*
* const data: unknown = true
*
* if (Predicate.isBoolean(data)) {
*   data ? "yes" : "no" // => "yes"
* }
* ```
*
* @see {@link isString}
* @see {@link isNumber}
* @stability stable
* @category guards
* @since 2.0.0
*/
function isBoolean(input) {
	return typeof input === "boolean";
}
/**
* Checks whether a value is a `symbol`.
*
* **When to use**
*
* Use when you need a `Predicate` guard to narrow an `unknown` value to a
* symbol.
*
* **Details**
*
* Uses `typeof input === "symbol"`.
*
* **Example** (Guarding symbols)
*
* ```ts import.meta.vitest
* import { Predicate } from "effect"
*
* const data: unknown = Symbol.for("id")
*
* if (Predicate.isSymbol(data)) {
*   data.description // => "id"
* }
* ```
*
* @see {@link isPropertyKey}
* @stability stable
* @category guards
* @since 2.0.0
*/
function isSymbol(input) {
	return typeof input === "symbol";
}
/**
* Checks whether a value is a valid `PropertyKey` (string, number, or symbol).
*
* **When to use**
*
* Use when you need a `Predicate` guard for unknown property keys before
* indexing.
*
* **Details**
*
* Uses `isString`, `isNumber`, and `isSymbol`.
*
* **Example** (Guarding property keys)
*
* ```ts import.meta.vitest
* import { Predicate } from "effect"
*
* const key: unknown = "name"
* const obj: Record<PropertyKey, unknown> = { name: "Ada" }
*
* if (Predicate.isPropertyKey(key) && key in obj) {
*   obj[key] // => "Ada"
* }
* ```
*
* @see {@link isString}
* @see {@link isNumber}
* @see {@link isSymbol}
* @stability stable
* @category guards
* @since 4.0.0
*/
function isPropertyKey(u) {
	return isString$1(u) || isNumber(u) || isSymbol(u);
}
/**
* Checks whether a value is a `function`.
*
* **When to use**
*
* Use when you need a `Predicate` guard to narrow an `unknown` value to a
* callable function.
*
* **Details**
*
* Uses `typeof input === "function"`.
*
* **Example** (Guarding functions)
*
* ```ts import.meta.vitest
* import { Predicate } from "effect"
*
* const data: unknown = () => 1
*
* if (Predicate.isFunction(data)) {
*   data() // => 1
* }
* ```
*
* @see {@link isObjectKeyword}
* @stability stable
* @category guards
* @since 2.0.0
*/
function isFunction(input) {
	return typeof input === "function";
}
/**
* Checks whether a value is not `undefined`.
*
* **When to use**
*
* Use when you need a `Predicate` refinement that filters out `undefined`
* while preserving other falsy values.
*
* **Details**
*
* Returns a refinement that excludes `undefined`.
*
* **Example** (Filtering undefined values)
*
* ```ts import.meta.vitest
* import { Predicate } from "effect"
*
* const values = [1, undefined, 2]
* const defined = values.filter(Predicate.isNotUndefined) // => [1, 2]
* ```
*
* @see {@link isUndefined}
* @see {@link isNotNullish}
* @stability stable
* @category guards
* @since 2.0.0
*/
function isNotUndefined(input) {
	return input !== void 0;
}
/**
* Checks whether a value is not `null` and not `undefined`.
*
* **When to use**
*
* Use when you need a `Predicate` refinement that filters out nullish values
* but keeps other falsy ones.
*
* **Details**
*
* Uses `input != null`.
*
* **Example** (Filtering non-nullish values)
*
* ```ts import.meta.vitest
* import { Predicate } from "effect"
*
* const values = [0, null, "", undefined]
* const present = values.filter(Predicate.isNotNullish) // => [0, ""]
* ```
*
* @see {@link isNullish}
* @see {@link isNotNull}
* @see {@link isNotUndefined}
* @stability stable
* @category guards
* @since 4.0.0
*/
function isNotNullish(input) {
	return input != null;
}
/**
* Type guard that always returns `false`.
*
* **When to use**
*
* Use when you need a `Predicate` that never accepts, e.g. in default branches.
*
* **Example** (Matching no values)
*
* ```ts import.meta.vitest
* import { Predicate } from "effect"
*
* Predicate.isNever("anything") // => false
* ```
*
* @see {@link isUnknown}
* @stability stable
* @category guards
* @since 2.0.0
*/
function isNever$1(_) {
	return false;
}
/**
* Type guard that always returns `true`.
*
* **When to use**
*
* Use when you need a `Predicate` that always accepts, e.g. as a placeholder.
*
* **Example** (Matching every value)
*
* ```ts import.meta.vitest
* import { Predicate } from "effect"
*
* Predicate.isUnknown(123) // => true
* ```
*
* @see {@link isNever}
* @stability stable
* @category guards
* @since 2.0.0
*/
function isUnknown(_) {
	return true;
}
/**
* Checks whether a value is a non-null object value that is not an array.
*
* **When to use**
*
* Use to narrow unknown input to a non-null, non-array object with a
* `Predicate` guard.
*
* **Details**
*
* This is a structural runtime check using `typeof input === "object"`, so it
* also accepts object instances such as `Date`, `Map`, class instances, and
* typed arrays. It excludes `null` and arrays.
*
* **Example** (Guarding objects)
*
* ```ts import.meta.vitest
* import { Predicate } from "effect"
*
* Predicate.isObject({ a: 1 }) // => true
* Predicate.isObject([1, 2]) // => false
* ```
*
* @see {@link isObjectOrArray}
* @see {@link isReadonlyObject}
* @stability stable
* @category guards
* @since 2.0.0
*/
function isObject(input) {
	return typeof input === "object" && input !== null && !Array.isArray(input);
}
/**
* Checks whether a value is an `object` in the JavaScript sense (objects, arrays, functions).
*
* **When to use**
*
* Use when you need a `Predicate` guard that accepts arrays and functions as
* well as objects.
*
* **Details**
*
* Returns `true` for arrays and functions, and `false` for `null`.
*
* **Example** (Checking object keywords)
*
* ```ts import.meta.vitest
* import { Predicate } from "effect"
*
* Predicate.isObjectKeyword(() => 1) // => true
* Predicate.isObjectKeyword(null) // => false
* ```
*
* @see {@link isObject}
* @see {@link isObjectOrArray}
* @stability stable
* @category guards
* @since 4.0.0
*/
function isObjectKeyword(input) {
	return typeof input === "object" && input !== null || isFunction(input);
}
/**
* Checks whether a value has a given property key.
*
* **When to use**
*
* Use when you need a `Predicate` guard for property access on `unknown`
* values with a simple structural object check.
*
* **Details**
*
* Uses the `in` operator and `isObjectKeyword`. This does not check property
* value types.
*
* **Example** (Guarding object properties)
*
* ```ts import.meta.vitest
* import { Predicate } from "effect"
*
* const hasName = Predicate.hasProperty("name")
* const data: unknown = { name: "Ada" }
*
* if (hasName(data)) {
*   data.name // => "Ada"
* }
* ```
*
* @see {@link isTagged}
* @see {@link isObjectKeyword}
* @stability stable
* @category guards
* @since 2.0.0
*/
var hasProperty = /*#__PURE__*/ dual(2, (self, property) => isObjectKeyword(self) && property in self);
/**
* Checks whether a value has a `_tag` property equal to the given tag.
*
* **When to use**
*
* Use when you model tagged unions with a `_tag` field and want a quick
* `Predicate` guard for tagged values.
*
* **Details**
*
* Uses `hasProperty` and strict equality on `_tag`.
*
* **Example** (Guarding tagged values)
*
* ```ts import.meta.vitest
* import { Predicate } from "effect"
*
* const isOk = Predicate.isTagged("Ok")
*
* isOk({ _tag: "Ok", value: 1 }) // => true
* ```
*
* @see {@link hasProperty}
* @stability stable
* @category guards
* @since 2.0.0
*/
var isTagged = /*#__PURE__*/ dual(2, (self, tag) => hasProperty(self, "_tag") && self["_tag"] === tag);
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Hash.js
/**
* Computes Effect hash values and defines the interface for objects that want
* to provide their own hash implementation. Hashes are small numeric
* fingerprints used by Effect data structures to bucket values quickly; they
* are not cryptographic digests and they are not proof that two values are
* equal. The module also includes helpers for primitive, structure, array, and
* reference-based hashes, plus functions for combining and optimizing numeric
* hash values.
*
* @stability stable
* @since 2.0.0
*/
/**
* Defines the unique identifier used to identify objects that implement the Hash interface.
*
* **When to use**
*
* Use as the computed property key for the method that supplies a custom hash
* value on a `Hash` implementor.
*
* @see {@link Hash} for the interface implemented with this symbol
* @see {@link isHash} for checking whether a value implements `Hash`
* @see {@link hash} for computing hash values
*
* @stability stable
* @category symbols
* @since 2.0.0
*/
var symbol$1 = "~effect/Hash";
/**
* Computes a hash value for any given value.
*
* **When to use**
*
* Use to compute an Effect hash for primitives, collections, and hashable
* objects.
*
* **Details**
*
* This function can hash primitives (numbers, strings, booleans, etc.) as well as
* objects, arrays, and other complex data structures. It automatically handles
* different types and provides a consistent hash value for equivalent inputs.
*
* **Gotchas**
*
* Objects being hashed must be treated as immutable after their first hash
* computation. Hash results are cached, so mutating an object after hashing will
* lead to stale cached values and broken hash-based operations. For mutable
* objects, implement a custom `Hash` interface that hashes the object reference
* rather than its content.
*
* **Example** (Hashing different values)
*
* ```ts import.meta.vitest
* import { Hash } from "effect"
*
* Hash.hash(42) === Hash.hash(42) // => true
* Hash.hash("hello") === Hash.hash("hello") // => true
* Hash.hash([1, 2, 3]) === Hash.hash([1, 2, 3]) // => true
* ```
*
* @stability stable
* @category hashing
* @since 2.0.0
*/
var hash = (self) => {
	switch (typeof self) {
		case "number": return number$1(self);
		case "bigint": return string$1(self.toString(10));
		case "string": return string$1(self);
		case "function":
		case "object": if (self === null) break;
		else if (self instanceof Date) {
			if (Number.isNaN(self.getTime())) return string$1("Invalid Date");
			return string$1(self.toISOString());
		} else if (self instanceof RegExp) return string$1(self.toString());
		else {
			if (byReferenceInstances.has(self)) return random(self);
			const cached = hashCache.get(self);
			if (cached !== void 0) return cached;
			if (visitedObjects.has(self)) {
				addBackEdge();
				return string$1("[Circular]");
			}
			visitedObjects.add(self);
			const seen = backEdges;
			let h;
			try {
				if (isHash(self)) h = self[symbol$1]();
				else if (typeof self === "function") h = random(self);
				else if (isArrayBufferLike(self)) {
					const bytes = bufferBytes(self);
					h = bytes === void 0 ? random(self) : array(bytes);
				} else if (self instanceof DataView) h = array(viewBytes(self));
				else if (Array.isArray(self) || ArrayBuffer.isView(self)) h = array(self);
				else if (self instanceof Map) h = hashMap(self);
				else if (self instanceof Set) h = hashSet(self);
				else h = structure(self);
			} finally {
				visitedObjects.delete(self);
			}
			if (seen === backEdges) hashCache.set(self, h);
			return h;
		}
	}
	return optimize(mix(string$1(String(self))));
};
/**
* Generates a random hash value for an object and caches it.
*
* **When to use**
*
* Use to hash an object by reference identity instead of structural content.
*
* **Details**
*
* This function creates a random hash value for objects that don't have their own
* hash implementation. The hash value is cached using a WeakMap, so the same object
* will always return the same hash value during its lifetime.
*
* **Example** (Hashing objects by reference)
*
* ```ts import.meta.vitest
* import { Hash } from "effect"
*
* const obj1 = { a: 1 }
* const obj2 = { a: 1 }
*
* Hash.random(obj1) === Hash.random(obj1) // => true
*
* typeof Hash.random(obj2) // => "number"
* ```
*
* @stability stable
* @category hashing
* @since 2.0.0
*/
var random = (self) => {
	if (!randomHashCache.has(self)) randomHashCache.set(self, optimize(Math.random() * 4294967296 | 0));
	return randomHashCache.get(self);
};
var mix = (h) => {
	h ^= h >>> 16;
	h = Math.imul(h, 2246822507);
	h ^= h >>> 13;
	h = Math.imul(h, 3266489909);
	return h ^ h >>> 16;
};
/**
* Combines two hash values into a single hash value.
*
* **When to use**
*
* Use to build a hash for a composite value by folding together hash values for
* its parts.
*
* **Details**
*
* Supports direct and pipeable usage. Argument order affects the result.
*
* **Example** (Combining hash values)
*
* ```ts import.meta.vitest
* import { Hash, pipe } from "effect"
*
* const hash1 = Hash.hash("hello")
* const hash2 = Hash.hash("world")
*
* const combined = Hash.combine(hash2)(hash1)
* combined === pipe(hash1, Hash.combine(hash2)) // => true
* ```
*
* @see {@link hash} for computing hash values from arbitrary inputs
* @see {@link structureKeys} for hashing selected object fields without manual combination
*
* @stability stable
* @category hashing
* @since 2.0.0
*/
var combine = /*#__PURE__*/ dual(2, (self, b) => mix(Math.imul(self, 2654435761) + Math.imul(b, 2246822507)));
/**
* Applies bit manipulation techniques to optimize a hash value.
*
* **When to use**
*
* Use to improve the bit distribution of a raw numeric hash value.
*
* **Details**
*
* This function takes a hash value and applies bitwise operations to improve
* the distribution of hash values, reducing the likelihood of collisions.
*
* **Example** (Optimizing a hash value)
*
* ```ts import.meta.vitest
* import { Hash } from "effect"
*
* Hash.optimize(1234567890) // => 160826066
* ```
*
* @stability stable
* @category hashing
* @since 2.0.0
*/
var optimize = (n) => n & 3221225471 | n >>> 1 & 1073741824;
/**
* Checks whether a value implements the Hash interface.
*
* **When to use**
*
* Use to detect whether an unknown value provides a custom hash implementation.
*
* **Details**
*
* This function determines whether a given value has a function under the Hash
* symbol, indicating that it can provide its own hash value implementation.
* Data that merely carries the key, such as parsed JSON, is hashed as data.
*
* **Example** (Checking for Hash support)
*
* ```ts import.meta.vitest
* import { Hash } from "effect"
*
* class MyHashable implements Hash.Hash {
*   [Hash.symbol]() {
*     return 42
*   }
* }
*
* Hash.isHash(new MyHashable()) // => true
* Hash.isHash({}) // => false
* Hash.isHash("string") // => false
* ```
*
* @stability stable
* @category guards
* @since 2.0.0
*/
var isHash = (u) => hasProperty(u, "~effect/Hash") && typeof u["~effect/Hash"] === "function";
var float64 = /*#__PURE__*/ new DataView(/*#__PURE__*/ new ArrayBuffer(8));
/**
* Computes a hash value for a number.
*
* **When to use**
*
* Use to hash a JavaScript number with Effect's numeric hash semantics.
*
* **Details**
*
* Int32 values hash to themselves. Other numbers hash from their IEEE-754 bits,
* with a canonical representation for `NaN`.
*
* **Example** (Hashing numbers)
*
* ```ts import.meta.vitest
* import { Hash } from "effect"
*
* Number.isInteger(Hash.number(42)) // => true
* Number.isInteger(Hash.number(3.14)) // => true
* Hash.number(NaN) === Hash.number(NaN) // => true
* Hash.number(Infinity) === Hash.number(Infinity) // => true
* Hash.number(100) === Hash.number(100) // => true
* ```
*
* @stability stable
* @category hashing
* @since 2.0.0
*/
var number$1 = (n) => {
	const h = n | 0;
	if (h === n) return optimize(h);
	float64.setFloat64(0, n !== n ? NaN : n);
	return optimize(combine(float64.getInt32(0), float64.getInt32(4)));
};
/**
* Computes a hash value for a string using the djb2 algorithm.
*
* **When to use**
*
* Use when you need a string field to contribute to a custom structural hash
* implementation.
*
* **Details**
*
* This function implements a variation of the djb2 hash algorithm, which is
* known for its good distribution properties and speed. It processes each
* character of the string to produce a consistent hash value.
*
* **Example** (Hashing strings)
*
* ```ts import.meta.vitest
* import { Hash } from "effect"
*
* Hash.string("hello") // => 181380007
* Hash.string("world") // => 164394279
* Hash.string("") // => 5381
* Hash.string("test") === Hash.string("test") // => true
* ```
*
* @stability stable
* @category hashing
* @since 2.0.0
*/
var string$1 = (str) => {
	let h = 5381, i = str.length;
	while (i) h = h * 33 ^ str.charCodeAt(--i);
	return optimize(h);
};
/**
* Computes a hash value for an object using only the specified keys.
*
* **When to use**
*
* Use to hash an object by a selected set of property keys.
*
* **Details**
*
* This function allows you to hash an object by considering only specific keys,
* which is useful when you want to create a hash based on a subset of an object's
* properties.
*
* **Example** (Hashing selected object keys)
*
* ```ts import.meta.vitest
* import { Hash } from "effect"
*
* const person = { name: "John", age: 30, city: "New York" }
*
* const hash1 = Hash.structureKeys(person, ["name", "age"])
* const hash2 = Hash.structureKeys(person, ["name", "city"])
*
* hash1 // => -731887653
* hash2 // => 148523102
*
* const person2 = { name: "John", age: 30, city: "Boston" }
* const hash3 = Hash.structureKeys(person2, ["name", "age"])
* hash1 === hash3 // => true
* ```
*
* @stability stable
* @category hashing
* @since 2.0.0
*/
var structureKeys = (o, keys) => {
	let h = 12289;
	for (const key of keys) h ^= combine(hash(key), hash(o[key]));
	return optimize(h);
};
/**
* Computes a structural hash for an object using Effect's object key collection.
*
* **When to use**
*
* Use to hash an object from all structural keys collected by Effect.
*
* **Details**
*
* The hash is based on the object's structural keys and their values, including
* symbol keys and relevant prototype keys for non-plain objects.
*
* **Example** (Hashing object structures)
*
* ```ts import.meta.vitest
* import { Hash } from "effect"
*
* const obj1 = { name: "John", age: 30 }
* const obj2 = { name: "Jane", age: 25 }
* const obj3 = { name: "John", age: 30 }
*
* Hash.structure(obj1) // => -731887653
* Hash.structure(obj2) // => -222100417
* Hash.structure(obj3) // => -731887653
* Hash.structure(obj1) === Hash.structure(obj3) // => true
* ```
*
* @stability stable
* @category hashing
* @since 2.0.0
*/
var structure = (o) => structureKeys(o, getAllObjectKeys(o));
var unordered = (seed, f) => (iter) => {
	let h = seed;
	for (const element of iter) h ^= f(element);
	return optimize(h);
};
/**
* Computes a hash value for an iterable by hashing all of its elements.
*
* **When to use**
*
* Use to hash the values yielded by an iterable with Effect hash semantics.
*
* **Details**
*
* Folds element hashes with {@link combine}, so order and length affect the
* result.
*
* **Gotchas**
*
* A hash is not an equality proof. Distinct inputs can still share a hash.
*
* **Example** (Hashing arrays)
*
* ```ts import.meta.vitest
* import { Hash } from "effect"
*
* const arr1 = [1, 2, 3]
* const arr2 = [1, 2, 3]
* const arr3 = [3, 2, 1]
*
* Hash.array(arr1) === Hash.array(arr2) // => true
* Hash.array(arr1) === Hash.array(arr3) // => false
* ```
*
* @see {@link hash} for the general-purpose hash dispatcher
*
* @stability stable
* @category hashing
* @since 2.0.0
*/
var array = (arr) => {
	let h = 6151;
	for (const element of arr) h = combine(h, hash(element));
	return optimize(h);
};
var hashMap = /*#__PURE__*/ unordered(/*#__PURE__*/ string$1("Map"), ([k, v]) => combine(hash(k), hash(v)));
var setSeed = /*#__PURE__*/ string$1("Set");
var hashSet = /*#__PURE__*/ unordered(setSeed, (element) => combine(setSeed, hash(element)));
var randomHashCache = /*#__PURE__*/ new WeakMap();
var hashCache = /*#__PURE__*/ new WeakMap();
var visitedObjects = /*#__PURE__*/ new WeakSet();
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Equal.js
/**
* Defines the unique string identifier for the `Equal` interface.
*
* **When to use**
*
* Use when you implement custom equality and need the computed property key for
* the equality method.
*
* **Details**
*
* This is a pure constant with no allocation or side effects.
*
* **Example** (Implementing Equal on a class)
*
* ```ts import.meta.vitest
* import { Equal, Hash } from "effect"
*
* class UserId implements Equal.Equal {
*   constructor(readonly id: string) {}
*
*   [Equal.symbol](that: Equal.Equal): boolean {
*     return that instanceof UserId && this.id === that.id
*   }
*
*   [Hash.symbol](): number {
*     return Hash.string(this.id)
*   }
* }
*
* Equal.equals(new UserId("1"), new UserId("1")) // => true
* Equal.equals(new UserId("1"), new UserId("2")) // => false
* ```
*
* @see {@link Equal} — the interface that uses this symbol
* @see {@link isEqual} — type guard for `Equal` implementors
* @stability stable
* @category symbols
* @since 2.0.0
*/
var symbol = "~effect/Equal";
function equals$1() {
	if (arguments.length === 1) return (self) => compareBoth(self, arguments[0]);
	return compareBoth(arguments[0], arguments[1]);
}
function compareBoth(self, that) {
	if (self === that) return true;
	if (self == null || that == null) return false;
	const selfType = typeof self;
	if (selfType !== typeof that) return false;
	if (selfType === "number" && self !== self && that !== that) return true;
	if (selfType !== "object" && selfType !== "function") return false;
	if (byReferenceInstances.has(self) || byReferenceInstances.has(that)) return false;
	return compareObjects(self, that);
}
function compareObjects(self, that) {
	const depth = pathLeft.length;
	for (let i = depth; i-- > 0;) if (pathLeft[i] === self && pathRight[i] === that) return true;
	if (depth) return compareOnPath(self, that);
	let known = results.get(self);
	if (!known) results.set(self, known = /* @__PURE__ */ new WeakMap());
	let result = known.get(that);
	if (result === void 0) known.set(that, result = compareOnPath(self, that));
	return result;
}
function compareOnPath(self, that) {
	pathLeft.push(self);
	pathRight.push(that);
	try {
		return compareStructure(self, that);
	} finally {
		pathLeft.pop();
		pathRight.pop();
	}
}
var pathLeft = [];
var pathRight = [];
var results = /*#__PURE__*/ new WeakMap();
function compareStructure(self, that) {
	if (hash(self) !== hash(that)) return false;
	else if (self instanceof Date) {
		if (!(that instanceof Date)) return false;
		const selfTime = self.getTime();
		const thatTime = that.getTime();
		return selfTime === thatTime || Number.isNaN(selfTime) && Number.isNaN(thatTime);
	} else if (self instanceof RegExp) return that instanceof RegExp && self.toString() === that.toString();
	const bothEquals = isEqual(self);
	if (bothEquals !== isEqual(that) || typeof self === "function" && !bothEquals) return false;
	else if (bothEquals) return self[symbol](that);
	else if (Array.isArray(self)) {
		if (!Array.isArray(that) || self.length !== that.length) return false;
		return compareArrays(self, that);
	} else if (isArrayBufferLike(self)) {
		if (!isArrayBufferLike(that) || self instanceof ArrayBuffer !== that instanceof ArrayBuffer) return false;
		const selfBytes = bufferBytes(self);
		const thatBytes = bufferBytes(that);
		return selfBytes !== void 0 && thatBytes !== void 0 && compareTypedArrays(selfBytes, thatBytes);
	} else if (ArrayBuffer.isView(self)) {
		const selfIsDataView = self instanceof DataView;
		if (!ArrayBuffer.isView(that) || self.byteLength !== that.byteLength || selfIsDataView !== that instanceof DataView) return false;
		if (selfIsDataView) return compareTypedArrays(viewBytes(self), viewBytes(that));
		return compareTypedArrays(self, that);
	} else if (self instanceof Map) {
		if (!(that instanceof Map) || self.size !== that.size) return false;
		return compareHashed(self, that, entryHash, equalEntries);
	} else if (self instanceof Set) {
		if (!(that instanceof Set) || self.size !== that.size) return false;
		return compareHashed(self, that, hash, compareBoth);
	}
	return compareRecords(self, that);
}
function compareArrays(self, that) {
	for (let i = 0; i < self.length; i++) if (!compareBoth(self[i], that[i])) return false;
	return true;
}
function compareTypedArrays(self, that) {
	if (self.length !== that.length) return false;
	for (let i = 0; i < self.length; i++) if (self[i] !== that[i]) return false;
	return true;
}
function compareRecords(self, that) {
	const selfKeys = getAllObjectKeys(self);
	const thatKeys = getAllObjectKeys(that);
	if (selfKeys.size !== thatKeys.size) return false;
	for (const key of selfKeys) if (!thatKeys.has(key) || !compareBoth(self[key], that[key])) return false;
	return true;
}
function compareHashed(self, that, hashOf, equivalent) {
	const groups = /* @__PURE__ */ new Map();
	let remaining = 0;
	for (const item of that) {
		const h = hashOf(item);
		const group = groups.get(h);
		if (group) group.push(item);
		else groups.set(h, [item]);
		remaining++;
	}
	outer: for (const item of self) {
		const group = groups.get(hashOf(item));
		if (group) {
			for (let i = 0; i < group.length; i++) if (equivalent(item, group[i])) {
				group[i] = group[group.length - 1];
				group.pop();
				remaining--;
				continue outer;
			}
		}
		return false;
	}
	return remaining === 0;
}
var entryHash = (entry) => hash(entry[0]);
var equalEntries = (self, that) => compareBoth(self[0], that[0]) && compareBoth(self[1], that[1]);
/**
* Checks whether a value implements the {@link Equal} interface.
*
* **When to use**
*
* Use when you need generic utility code to distinguish `Equal` implementors
* from plain values before calling `[Equal.symbol]` directly.
*
* **Details**
*
* - Pure function, no side effects.
* - Returns `true` if and only if `u` has a function keyed by {@link symbol}.
*   Data that merely carries the key, such as parsed JSON, is not `Equal`.
* - Acts as a TypeScript type guard, narrowing the input to {@link Equal}.
*
* **Example** (Checking Equal values)
*
* ```ts import.meta.vitest
* import { Equal, Hash } from "effect"
*
* class Token implements Equal.Equal {
*   constructor(readonly value: string) {}
*   [Equal.symbol](that: Equal.Equal): boolean {
*     return that instanceof Token && this.value === that.value
*   }
*   [Hash.symbol](): number {
*     return Hash.string(this.value)
*   }
* }
*
* Equal.isEqual(new Token("abc")) // => true
* Equal.isEqual({ x: 1 }) // => false
* Equal.isEqual(42) // => false
* ```
*
* @see {@link Equal} — the interface being checked
* @see {@link symbol} — the property key that signals `Equal` support
* @stability stable
* @category guards
* @since 2.0.0
*/
var isEqual = (u) => hasProperty(u, "~effect/Equal") && typeof u["~effect/Equal"] === "function";
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/array.js
/**
* @since 2.0.0
*/
/** @internal */
var isArrayNonEmpty$1 = (self) => self.length > 0;
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/record.js
/** @internal */
function assignProperty(self, key, value) {
	if (key === "__proto__") Object.defineProperty(self, key, {
		value,
		writable: true,
		enumerable: true,
		configurable: true
	});
	else self[key] = value;
}
/** @internal */
function assignProperties(self, source) {
	if (!Object.hasOwn(source, "__proto__")) {
		Object.assign(self, source);
		return;
	}
	for (const key of Reflect.ownKeys(source)) if (Object.prototype.propertyIsEnumerable.call(source, key)) assignProperty(self, key, source[key]);
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Redactable.js
/**
* Defines the symbol used to identify objects that implement the {@link Redactable}
* protocol.
*
* **When to use**
*
* Use as the property key when implementing the `Redactable` protocol.
*
* **Details**
*
* Add a method under this key to make an object redactable. The method receives
* the current `Context` and must return the replacement value. The symbol is
* registered globally via `Symbol.for("~effect/Redactable")`, so it is
* identical across multiple copies of the library at runtime.
*
* **Example** (Masking an API key)
*
* ```ts import.meta.vitest
* import { Context, Redactable } from "effect"
*
* class ApiKey {
*   constructor(readonly raw: string) {}
*
*   [Redactable.symbolRedactable](_ctx: Context.Context<never>) {
*     return this.raw.slice(0, 4) + "..."
*   }
* }
*
* Redactable.redact(new ApiKey("secret-key")) // => "secr..."
* ```
*
* @see {@link Redactable} for the interface this symbol belongs to
* @see {@link isRedactable} to check whether a value has this symbol
* @stability stable
* @category symbols
* @since 3.10.0
*/
var symbolRedactable = /*#__PURE__*/ Symbol.for("~effect/Redactable");
/**
* Type guard that checks whether a value implements the {@link Redactable}
* interface.
*
* **When to use**
*
* Use to narrow an unknown value before calling redaction-specific helpers.
*
* @see {@link Redactable} for the interface being checked
* @see {@link redact} to apply redaction if the value is redactable
* @stability stable
* @category guards
* @since 3.10.0
*/
var isRedactable = (u) => hasProperty(u, symbolRedactable);
/**
* Returns a redacted value if it implements {@link Redactable}, otherwise returns it
* unchanged.
*
* **When to use**
*
* Use as the general-purpose entry point for redaction when the input may
* or may not implement the redaction protocol.
*
* **Details**
*
* This function calls {@link isRedactable} and, when it returns `true`,
* delegates to {@link getRedacted}.
*
* **Gotchas**
*
* Redaction is not recursive. Nested redactable values inside the returned
* object are not automatically redacted.
*
* @see {@link isRedactable} to check before redacting
* @see {@link getRedacted} for the lower-level variant for known redactables
* @stability stable
* @category destructors
* @since 3.10.0
*/
function redact$2(u) {
	if (isRedactable(u)) return getRedacted(u);
	return u;
}
/**
* Returns the result of calling `[symbolRedactable]` on a value that is
* already known to be {@link Redactable}.
*
* **When to use**
*
* Use when you need to read the redacted representation from a value already
* verified as `Redactable`.
*
* **Details**
*
* This function reads the current fiber's `Context` from the global fiber
* reference and passes it to the redaction method.
*
* **Gotchas**
*
* If no fiber is active, an empty `Context` is passed to the redaction method.
*
* @see {@link redact} for the higher-level variant that handles non-redactable values
* @see {@link isRedactable} for the type guard to verify before calling this
* @stability stable
* @category destructors
* @since 4.0.0
*/
function getRedacted(redactable) {
	return redactable[symbolRedactable](globalThis["~effect/Fiber/currentFiber"]?.context ?? emptyContext$1);
}
/** @internal */
var currentFiberTypeId = "~effect/Fiber/currentFiber";
var emptyMap = /*#__PURE__*/ new Map();
var emptyContext$1 = {
	"~effect/Context": {},
	base: emptyMap,
	depth: 0,
	mapUnsafe: emptyMap,
	pipe() {
		return pipeArguments(this, arguments);
	}
};
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Formatter.js
/**
* Formats JavaScript values into readable strings.
*
* `format` is intended for logs, diagnostics, and error messages. It handles
* primitives, objects, arrays, dates, regular expressions, maps, sets, class
* instances, errors, circular references, and redactable values. `formatJson`
* wraps JSON formatting with redaction and circular-reference handling, and the
* module also includes helpers for property keys, paths, and dates.
*
* @stability stable
* @since 4.0.0
*/
/**
* Converts any JavaScript value into a human-readable string.
*
* **When to use**
*
* Use when you need to format arbitrary JavaScript values for debugging,
* logging, or error messages.
*
* **Details**
*
* - Output is **not** valid JSON; use {@link formatJson} when you need
*   parseable JSON.
* - Handles `BigInt`, `Symbol`, `Set`, `Map`, `Date`, `RegExp`, and class
*   instances that `JSON.stringify` cannot represent.
* - Circular references are shown as `"[Circular]"` instead of throwing.
* - Failures while inspecting a value are rendered as diagnostic placeholders instead of throwing.
* - Primitives: stringified naturally (`null`, `undefined`, `123`, `true`).
*   Strings are JSON-quoted.
* - Objects with a custom `toString` (not `Object.prototype.toString`):
*   `toString()` is called unless `ignoreToString` is `true`.
* - Errors with a `cause`: formatted as `"<message> (cause: <cause>)"`.
* - Iterables (`Set`, `Map`, etc.): formatted as
*   `ClassName([...elements])`.
* - Class instances: wrapped as `ClassName({...})`.
* - `Redactable` values are automatically redacted.
* - Arrays/objects with 0–1 entries are inline; larger ones are
*   pretty-printed when `space` is set.
* - `space` — indentation unit (number of spaces, or a string like
*   `"\t"`). Defaults to `0` (compact).
* - `ignoreToString` — skip calling `toString()`. Defaults to `false`.
*
* **Example** (Formatting compact output)
*
* ```ts import.meta.vitest
* import { Formatter } from "effect"
*
* Formatter.format({ a: 1, b: [2, 3] }) // => "{\"a\":1,\"b\":[2,3]}"
* ```
*
* **Example** (Pretty-printed output)
*
* ```ts import.meta.vitest
* import { Formatter } from "effect"
*
* const output = Formatter.format({ a: 1, b: [2, 3] }, { space: 2 })
* output // => "{\n  \"a\": 1,\n  \"b\": [\n    2,\n    3\n  ]\n}"
* ```
*
* **Example** (Handling circular references)
*
* ```ts import.meta.vitest
* import { Formatter } from "effect"
*
* const obj: any = { name: "loop" }
* obj.self = obj
* Formatter.format(obj) // => "{\"name\":\"loop\",\"self\":[Circular]}"
* ```
*
* @see {@link formatJson}
* @see {@link Formatter}
* @stability stable
* @category formatting
* @since 2.0.0
*/
function format$1(input, options) {
	const space = options?.space ?? 0;
	const ancestors = /* @__PURE__ */ new WeakSet();
	const gap = !space ? "" : typeof space === "number" ? " ".repeat(space) : space;
	const ind = (d) => gap.repeat(d);
	const wrap = (v, body) => {
		const ctor = v?.constructor;
		return ctor && ctor !== Object.prototype.constructor && ctor.name ? `${ctor.name}(${body})` : body;
	};
	const ownKeys = (o) => {
		try {
			return Reflect.ownKeys(o);
		} catch {
			return ["[ownKeys threw]"];
		}
	};
	function recur(v, d = 0) {
		try {
			return recurUnsafe(v, d);
		} catch {
			if (typeof v === "object" && v !== null || typeof v === "function") ancestors.delete(v);
			return "[inspection threw]";
		}
	}
	function recurUnsafe(v, d = 0) {
		if (typeof v === "string") return JSON.stringify(v);
		if (typeof v === "number" || v == null || typeof v === "boolean" || typeof v === "symbol") return String(v);
		if (typeof v === "bigint") return String(v) + "n";
		if (typeof v === "object" || typeof v === "function") {
			if (ancestors.has(v)) return CIRCULAR;
			ancestors.add(v);
			let output;
			if (symbolRedactable in v) output = recur(getRedacted(v), d);
			else if (Array.isArray(v)) output = !gap || v.length <= 1 ? `[${v.map((x) => recur(x, d)).join(",")}]` : `[\n${ind(d + 1)}${v.map((x) => recur(x, d + 1)).join(",\n" + ind(d + 1))}\n${ind(d)}]`;
			else if (v instanceof Date) output = formatDate(v);
			else if (!options?.ignoreToString && hasProperty(v, "toString") && typeof v["toString"] === "function" && v["toString"] !== Object.prototype.toString && v["toString"] !== Array.prototype.toString) {
				const s = safeToString(v);
				output = v instanceof Error && v.cause !== void 0 ? `${s} (cause: ${recur(v.cause, d)})` : s;
			} else if (Symbol.iterator in v) output = `${v.constructor.name}(${recur(Array.from(v), d)})`;
			else {
				const keys = ownKeys(v);
				if (!gap || keys.length <= 1) {
					const body = `{${keys.map((k) => `${formatPropertyKey(k)}:${recur(safeGet(v, k), d)}`).join(",")}}`;
					output = wrap(v, body);
				} else {
					const body = `{\n${keys.map((k) => `${ind(d + 1)}${formatPropertyKey(k)}: ${recur(safeGet(v, k), d + 1)}`).join(",\n")}\n${ind(d)}}`;
					output = wrap(v, body);
				}
			}
			ancestors.delete(v);
			return output;
		}
		return String(v);
	}
	return recur(input, 0);
}
var CIRCULAR = "[Circular]";
/**
* @internal
*/
function formatPropertyKey(name) {
	return typeof name === "string" ? JSON.stringify(name) : String(name);
}
/**
* Formats an array of property keys as a bracket-notation path string.
*
* @internal
*/
function formatPath(path) {
	return path.map((key) => `[${formatPropertyKey(key)}]`).join("");
}
/**
* Formats a `Date` as an ISO 8601 string, returning `"Invalid Date"` for
* invalid dates instead of throwing.
*
* @internal
*/
function formatDate(date) {
	try {
		return date.toISOString();
	} catch {
		return "Invalid Date";
	}
}
function safeToString(input) {
	try {
		const s = input.toString();
		return typeof s === "string" ? s : String(s);
	} catch {
		return "[toString threw]";
	}
}
function safeGet(input, key) {
	try {
		return input[key];
	} catch {
		return "[property access threw]";
	}
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Inspectable.js
/**
* Controls how values appear in logs and debugging output.
*
* Effect data types use `Inspectable` to provide stable string, JSON, and
* Node.js inspection output. This keeps custom values readable in logs, REPLs,
* test failures, and diagnostics. This module defines the Node inspect symbol,
* the `Inspectable` interface, safe conversion helpers, and shared prototype or
* class implementations for custom values.
*
* @stability stable
* @since 2.0.0
*/
/**
* Defines the symbol used by Node.js for custom object inspection.
*
* **When to use**
*
* Use to implement Node.js custom inspection for a value.
*
* **Details**
*
* This symbol is recognized by Node.js's `util.inspect()` function and the REPL
* for custom object representation. When an object has a method with this symbol,
* it will be called to determine how the object should be displayed.
*
* **Example** (Defining custom Node inspection)
*
* ```ts import.meta.vitest
* import { Inspectable } from "effect"
*
* class CustomObject {
*   constructor(private value: string) {}
*
*   [Inspectable.NodeInspectSymbol]() {
*     return `CustomObject(${this.value})`
*   }
* }
*
* const obj = new CustomObject("hello")
* obj[Inspectable.NodeInspectSymbol]() // => "CustomObject(hello)"
* ```
*
* @stability stable
* @category symbols
* @since 2.0.0
*/
var NodeInspectSymbol = /*#__PURE__*/ Symbol.for("nodejs.util.inspect.custom");
/**
* Converts a value to its structured inspection representation.
*
* **When to use**
*
* Use when you need the structured representation of an inspectable value
* without risking unhandled errors.
*
* **Details**
*
* This function applies redaction before extracting data from objects that
* implement `toJSON`, recursively processes arrays, and handles errors
* gracefully. Plain objects are returned unchanged, so the result is not
* guaranteed to be accepted by `JSON.stringify`; it may still contain values
* such as `BigInt`, functions, or circular references.
*
* @see {@link toStringUnknown} for converting unknown values to strings
*
* @stability stable
* @category converting
* @since 4.0.0
*/
var toJson = (input) => {
	try {
		input = redact$2(input);
		if (hasProperty(input, "toJSON") && isFunction(input["toJSON"]) && input["toJSON"].length === 0) return input.toJSON();
		else if (Array.isArray(input)) return input.map(toJson);
		return input;
	} catch {
		return "[toJSON threw]";
	}
};
/**
* A base prototype object that implements the {@link Inspectable} interface.
*
* **When to use**
*
* Use as a prototype for plain objects that should share standard inspectable behavior.
*
* **Details**
*
* This object provides default implementations for the {@link Inspectable} methods.
* It can be used as a prototype for objects that want to be inspectable,
* or as a mixin to add inspection capabilities to existing objects.
*
* **Example** (Using the base inspectable prototype)
*
* ```ts import.meta.vitest
* import { Inspectable } from "effect"
*
* // Use as prototype
* const myObject = Object.create(Inspectable.BaseProto)
* myObject.name = "example"
* myObject.value = 42
*
* myObject.toString() // => "\"[toJSON threw]\""
*
* // Or extend in a constructor
* function MyClass(this: any, name: string) {
*   this.name = name
* }
* MyClass.prototype = Object.create(Inspectable.BaseProto)
* MyClass.prototype.constructor = MyClass
* ```
*
* @stability stable
* @category prototypes
* @since 2.0.0
*/
var BaseProto = {
	toJSON() {
		return toJson(this);
	},
	[NodeInspectSymbol]() {
		return this.toJSON();
	},
	toString() {
		return format$1(this.toJSON());
	}
};
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/stackTraceLimit.js
/**
* Check if `Error.stackTraceLimit` is writable.
* Returns `false` if the property is frozen, non-writable, or `Error` is non-extensible.
*
* @internal
*/
var isStackTraceLimitWritable = () => {
	const desc = Object.getOwnPropertyDescriptor(Error, "stackTraceLimit");
	if (desc === void 0) return Object.isExtensible(Error);
	return Object.hasOwn(desc, "writable") ? desc.writable === true : desc.set !== void 0;
};
var canWriteStackTraceLimit = /*#__PURE__*/ isStackTraceLimitWritable();
/**
* Get the current `Error.stackTraceLimit` value.
* Returns `undefined` if the property doesn't exist.
*
* @internal
*/
var getStackTraceLimit = () => Error.stackTraceLimit;
/**
* Safely set `Error.stackTraceLimit` if possible, otherwise no-op.
*
* Accepts `undefined` so a value read via {@link getStackTraceLimit} can be
* restored faithfully.
*
* @internal
*/
var setStackTraceLimit = (value) => {
	if (canWriteStackTraceLimit) Error.stackTraceLimit = value;
};
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Utils.js
/**
* Yields its wrapped value exactly once, then completes with the value sent
* back in.
*
* **When to use**
*
* Use to implement `[Symbol.iterator]()` on Effect-like types so they can be
* `yield*`-ed inside generator functions, such as `Effect.gen` and
* `Option.gen`.
*
* **Details**
*
* The first call to `next()` returns a fresh `{ value: self, done: false }`.
* Every subsequent call returns `{ value: a, done: true }` where `a` is the
* argument passed to `next()`. To keep `yield*` cheap, the completion result
* is the iterator itself rather than a new object, so only the iterator and
* the single yielded result are allocated per `yield*`.
*
* **Example** (Yielding a wrapped value in a generator)
*
* ```ts import.meta.vitest
* import { Utils } from "effect"
*
* const gen = new Utils.SingleShotGen<string, number>("hello")
*
* gen.next(0).value // => "hello"
*
* gen.next(42).value // => 42
* ```
*
* @see {@link Gen} for the type-level signature that relies on `SingleShotGen`
* @stability stable
* @category constructors
* @since 2.0.0
*/
var SingleShotGen = class {
	constructor(self) {
		this.value = self;
		this.done = false;
	}
	/**
	* Yields the stored value once, then completes with the value sent back in.
	*
	* **When to use**
	*
	* Use to advance a `SingleShotGen` through its single yield and completion
	* step.
	*
	* @since 2.0.0
	*/
	next(a) {
		if (this.done) {
			this.value = a;
			return this;
		}
		this.done = true;
		return {
			value: this.value,
			done: false
		};
	}
};
var pickInternalCall = () => {
	const InternalTypeId = "~effect/Utils/internal";
	const standard = { [InternalTypeId]: (body) => {
		return body();
	} };
	const forced = { [InternalTypeId]: (body) => {
		try {
			return body();
		} finally {}
	} };
	const limit = getStackTraceLimit();
	if (limit === 0) return forced[InternalTypeId];
	setStackTraceLimit(2);
	const error = standard[InternalTypeId](() => /* @__PURE__ */ new Error());
	setStackTraceLimit(limit);
	return error.stack?.includes(InternalTypeId) === true ? standard[InternalTypeId] : forced[InternalTypeId];
};
/** @internal */
var internalCall = /*#__PURE__*/ pickInternalCall();
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/core.js
/** @internal */
var EffectTypeId = `~effect/Effect`;
/** @internal */
var ExitTypeId = `~effect/Exit`;
var effectVariance = {
	_A: identity,
	_E: identity,
	_R: identity
};
/** @internal */
var identifier = `${EffectTypeId}/identifier`;
/** @internal */
var args = `${EffectTypeId}/args`;
/** @internal */
var evaluate = `${EffectTypeId}/evaluate`;
/** @internal */
var contA = `${EffectTypeId}/successCont`;
/** @internal */
var contE = `${EffectTypeId}/failureCont`;
/** @internal */
var contAll = `${EffectTypeId}/ensureCont`;
/** @internal */
var Yield = /*#__PURE__*/ Symbol.for("effect/Effect/Yield");
/** @internal */
var PipeInspectableProto = {
	pipe() {
		return pipeArguments(this, arguments);
	},
	toJSON() {
		return { ...this };
	},
	toString() {
		return format$1(this.toJSON(), {
			ignoreToString: true,
			space: 2
		});
	},
	[NodeInspectSymbol]() {
		return this.toJSON();
	}
};
/** @internal */
var EffectProto = {
	[EffectTypeId]: effectVariance,
	...PipeInspectableProto,
	[Symbol.iterator]() {
		return new SingleShotGen(this);
	},
	toJSON() {
		return {
			_id: "Effect",
			op: this[identifier],
			..."~effect/Effect/args" in this ? { args: this[args] } : void 0
		};
	}
};
/** @internal */
var isEffect$1 = (u) => hasProperty(u, EffectTypeId);
/** @internal */
var isExit = (u) => hasProperty(u, ExitTypeId);
/** @internal */
var CauseTypeId = "~effect/Cause";
/** @internal */
var CauseReasonTypeId = "~effect/Cause/Reason";
/** @internal */
var isCause = (self) => hasProperty(self, CauseTypeId);
/** @internal */
var CauseImpl = class {
	constructor(failures) {
		this[CauseTypeId] = CauseTypeId;
		this.reasons = failures;
	}
	pipe() {
		return pipeArguments(this, arguments);
	}
	toJSON() {
		return {
			_id: "Cause",
			reasons: this.reasons.map((f) => f.toJSON())
		};
	}
	toString() {
		return `Cause(${format$1(this.reasons)})`;
	}
	[NodeInspectSymbol]() {
		return this.toJSON();
	}
	[symbol](that) {
		return isCause(that) && this.reasons.length === that.reasons.length && this.reasons.every((e, i) => equals$1(e, that.reasons[i]));
	}
	[symbol$1]() {
		return array(this.reasons);
	}
};
var annotationsMap = /*#__PURE__*/ new WeakMap();
/** @internal */
var ReasonBase = class {
	[CauseReasonTypeId];
	annotations;
	_tag;
	constructor(_tag, annotations, originalError) {
		this[CauseReasonTypeId] = CauseReasonTypeId;
		this._tag = _tag;
		if (annotations !== constEmptyAnnotations && typeof originalError === "object" && originalError !== null && annotations.size > 0) {
			const prevAnnotations = annotationsMap.get(originalError);
			if (prevAnnotations) annotations = new Map([...prevAnnotations, ...annotations]);
			annotationsMap.set(originalError, annotations);
		}
		this.annotations = annotations;
	}
	annotate(annotations, options) {
		if (annotations.mapUnsafe.size === 0) return this;
		const newAnnotations = new Map(this.annotations);
		annotations.mapUnsafe.forEach((value, key) => {
			if (options?.overwrite !== true && newAnnotations.has(key)) return;
			newAnnotations.set(key, value);
		});
		if (options?.overwrite !== true && newAnnotations.size === this.annotations.size) return this;
		const self = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
		self.annotations = newAnnotations;
		return self;
	}
	pipe() {
		return pipeArguments(this, arguments);
	}
	toString() {
		return format$1(this);
	}
	[NodeInspectSymbol]() {
		return this.toString();
	}
};
/** @internal */
var constEmptyAnnotations = /*#__PURE__*/ new Map();
/** @internal */
var Fail = class extends ReasonBase {
	constructor(error, annotations = constEmptyAnnotations) {
		super("Fail", annotations, error);
		this.error = error;
	}
	toString() {
		return `Fail(${format$1(this.error)})`;
	}
	toJSON() {
		return {
			_tag: "Fail",
			error: this.error
		};
	}
	[symbol](that) {
		return isFailReason$1(that) && equals$1(this.error, that.error) && equals$1(this.annotations, that.annotations);
	}
	[symbol$1]() {
		return combine(string$1(this._tag))(combine(hash(this.error))(hash(this.annotations)));
	}
};
/** @internal */
var causeFromReasons = (reasons) => new CauseImpl(reasons);
var dedupeReasons = (self, that) => {
	const buckets = /* @__PURE__ */ new Map();
	const out = [];
	for (const reason of self.concat(that)) {
		const hash$2 = hash(reason);
		const bucket = buckets.get(hash$2);
		if (bucket === void 0) buckets.set(hash$2, [reason]);
		else if (bucket.some((previous) => equals$1(previous, reason))) continue;
		else bucket.push(reason);
		out.push(reason);
	}
	return out;
};
/** @internal */
var causeCombine = /*#__PURE__*/ dual(2, (self, that) => {
	if (self.reasons.length === 0) return that;
	else if (that.reasons.length === 0) return self;
	const newCause = new CauseImpl(dedupeReasons(self.reasons, that.reasons));
	return equals$1(self, newCause) ? self : newCause;
});
/**
* Appends the interrupts from `interrupts` that `self` does not contain yet.
* Unlike `causeCombine`, it never calls hash or equality methods, which can be
* user-defined, random, or throwing.
*
* @internal
*/
var causeAddInterrupts = (self, interrupts) => {
	const reasons = self.reasons.slice();
	for (const reason of interrupts.reasons) if (isInterruptReason(reason) && !reasons.some((r) => isInterruptReason(r) && r.fiberId === reason.fiberId && r.annotations === reason.annotations)) reasons.push(reason);
	return reasons.length === self.reasons.length ? self : new CauseImpl(reasons);
};
/** @internal */
var causeFail = (error) => new CauseImpl([new Fail(error)]);
/** @internal */
var Die = class extends ReasonBase {
	constructor(defect, annotations = constEmptyAnnotations) {
		super("Die", annotations, defect);
		this.defect = defect;
	}
	toString() {
		return `Die(${format$1(this.defect)})`;
	}
	toJSON() {
		return {
			_tag: "Die",
			defect: this.defect
		};
	}
	[symbol](that) {
		return isDieReason(that) && equals$1(this.defect, that.defect) && equals$1(this.annotations, that.annotations);
	}
	[symbol$1]() {
		return combine(string$1(this._tag))(combine(hash(this.defect))(hash(this.annotations)));
	}
};
/** @internal */
var causeDie = (defect) => new CauseImpl([new Die(defect)]);
/** @internal */
var causeAnnotate = /*#__PURE__*/ dual((args) => isCause(args[0]), (self, annotations, options) => {
	if (annotations.mapUnsafe.size === 0) return self;
	return new CauseImpl(self.reasons.map((f) => f.annotate(annotations, options)));
});
/** @internal */
var isFailReason$1 = (self) => self._tag === "Fail";
/** @internal */
var isDieReason = (self) => self._tag === "Die";
/** @internal */
var isInterruptReason = (self) => self._tag === "Interrupt";
function defaultEvaluate(_fiber) {
	return exitDie(`Effect.evaluate: Not implemented`);
}
/** @internal */
var makePrimitiveProto = (options) => ({
	...EffectProto,
	[identifier]: options.op,
	[evaluate]: options["~effect/Effect/evaluate"] ?? defaultEvaluate,
	[contA]: options[contA],
	[contE]: options[contE],
	[contAll]: options[contAll]
});
/** @internal */
var makePrimitive = (options) => {
	const Proto = makePrimitiveProto(options);
	const PrimitiveImpl = function(value) {
		this[args] = value;
	};
	PrimitiveImpl.prototype = Proto;
	return function(value) {
		return new PrimitiveImpl(value);
	};
};
/** @internal */
var makeExit = (options) => {
	const Proto = {
		[ExitTypeId]: ExitTypeId,
		_tag: options.op,
		get [options.prop]() {
			return this[args];
		},
		...makePrimitiveProto(options),
		toString() {
			return `${options.op}(${format$1(this[args])})`;
		},
		toJSON() {
			return {
				_id: "Exit",
				_tag: options.op,
				[options.prop]: this[args]
			};
		},
		[symbol](that) {
			return isExit(that) && that._tag === this._tag && equals$1(this["~effect/Effect/args"], that["~effect/Effect/args"]);
		},
		[symbol$1]() {
			return combine(string$1(options.op), hash(this[args]));
		}
	};
	const ExitPrimitive = function(value) {
		this[args] = value;
	};
	ExitPrimitive.prototype = Proto;
	return function(value) {
		return new ExitPrimitive(value);
	};
};
/** @internal */
var exitSucceed = /*#__PURE__*/ makeExit({
	op: "Success",
	prop: "value",
	[evaluate](fiber) {
		const cont = fiber.getCont(contA);
		return cont ? cont[contA](this[args], fiber, this) : fiber.yieldWith(this);
	}
});
/** @internal */
var StackTraceKey = { key: "effect/Cause/StackTrace" };
/** @internal */
var InterruptorStackTrace = { key: "effect/Cause/InterruptorStackTrace" };
/** @internal */
var exitFailCause = /*#__PURE__*/ makeExit({
	op: "Failure",
	prop: "cause",
	[evaluate](fiber) {
		let cause = this[args];
		let annotated = false;
		if (fiber.cache.stackFrame) {
			cause = causeAnnotate(cause, { mapUnsafe: /* @__PURE__ */ new Map([[StackTraceKey.key, fiber.cache.stackFrame]]) });
			annotated = true;
		}
		let cont = fiber.getCont(contE);
		const interruptedCause = fiber._interruptedCause;
		if (interruptedCause && fiber.interruptible) {
			let skippedHandler = false;
			while (cont && fiber.interruptible) {
				skippedHandler ||= identifier in cont;
				cont = fiber.getCont(contE);
			}
			if (skippedHandler) cause = causeFromReasons(cause.reasons.filter((reason) => reason._tag !== "Fail"));
			cause = causeAddInterrupts(cause, interruptedCause);
			annotated = true;
		}
		return cont ? cont[contE](cause, fiber, annotated ? void 0 : this) : fiber.yieldWith(annotated ? exitFailCause(cause) : this);
	}
});
/** @internal */
var exitFail = (e) => exitFailCause(causeFail(e));
/** @internal */
var exitDie = (defect) => exitFailCause(causeDie(defect));
/** @internal */
var withFiber$1 = /*#__PURE__*/ makePrimitive({
	op: "WithFiber",
	[evaluate](fiber) {
		return this[args](fiber);
	}
});
/** @internal */
var YieldableError = /*#__PURE__*/ function() {
	class YieldableError extends globalThis.Error {}
	const proto = /*#__PURE__*/ makePrimitiveProto({
		op: "YieldableError",
		[evaluate]() {
			return exitFail(this);
		}
	});
	delete proto.toString;
	Object.assign(YieldableError.prototype, proto);
	return YieldableError;
}();
/** @internal */
var Error$3 = /*#__PURE__*/ function() {
	const plainArgsSymbol = /*#__PURE__*/ Symbol.for("effect/Data/Error/plainArgs");
	return class Base extends YieldableError {
		constructor(args) {
			super(args?.message, args?.cause ? { cause: args.cause } : void 0);
			if (args) {
				assignProperties(this, args);
				Object.defineProperty(this, plainArgsSymbol, {
					value: args,
					enumerable: false
				});
			}
		}
		toJSON() {
			return {
				...this[plainArgsSymbol],
				...this
			};
		}
	};
}();
/** @internal */
var TaggedError$2 = (tag) => {
	class Base extends Error$3 {
		_tag = tag;
	}
	Base.prototype.name = tag;
	return Base;
};
/** @internal */
var DoneTypeId = "~effect/Cause/Done";
/** @internal */
var isDone = (u) => hasProperty(u, DoneTypeId);
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/option.js
/**
* @since 2.0.0
*/
var TypeId$25 = "~effect/Option";
var CommonProto$1 = {
	[TypeId$25]: { _A: (_) => _ },
	...PipeInspectableProto,
	[Symbol.iterator]() {
		return new SingleShotGen(this);
	}
};
var SomeProto = /*#__PURE__*/ Object.defineProperty(/*#__PURE__*/ Object.assign(/*#__PURE__*/ Object.create(CommonProto$1), {
	_tag: "Some",
	_op: "Some",
	[symbol](that) {
		return isOption(that) && isSome$1(that) && equals$1(this.value, that.value);
	},
	[symbol$1]() {
		return combine(hash(this._tag))(hash(this.value));
	},
	toString() {
		return `some(${format$1(this.value)})`;
	},
	toJSON() {
		return {
			_id: "Option",
			_tag: this._tag,
			value: toJson(this.value)
		};
	}
}), "valueOrUndefined", { get() {
	return this.value;
} });
var NoneHash = /*#__PURE__*/ hash("None");
var NoneProto = /*#__PURE__*/ Object.assign(/*#__PURE__*/ Object.create(CommonProto$1), {
	_tag: "None",
	_op: "None",
	valueOrUndefined: void 0,
	[symbol](that) {
		return isOption(that) && isNone$1(that);
	},
	[symbol$1]() {
		return NoneHash;
	},
	toString() {
		return `none()`;
	},
	toJSON() {
		return {
			_id: "Option",
			_tag: this._tag
		};
	}
});
/** @internal */
var isOption = (input) => hasProperty(input, TypeId$25);
/** @internal */
var isNone$1 = (fa) => fa._tag === "None";
/** @internal */
var isSome$1 = (fa) => fa._tag === "Some";
/** @internal */
var none$1 = /*#__PURE__*/ Object.create(NoneProto);
/** @internal */
var SomeImpl = function(value) {
	this.value = value;
};
SomeImpl.prototype = SomeProto;
/** @internal */
var some$1 = (value) => new SomeImpl(value);
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/result.js
var TypeId$24 = "~effect/Result";
var CommonProto = {
	[TypeId$24]: {
		/* v8 ignore next 2 */
		_A: (_) => _,
		_E: (_) => _
	},
	...PipeInspectableProto,
	[Symbol.iterator]() {
		return new SingleShotGen(this);
	}
};
var SuccessProto = /*#__PURE__*/ Object.assign(/*#__PURE__*/ Object.create(CommonProto), {
	_tag: "Success",
	_op: "Success",
	[symbol](that) {
		return isResult$1(that) && isSuccess$2(that) && equals$1(this.success, that.success);
	},
	[symbol$1]() {
		return combine(hash(this._tag))(hash(this.success));
	},
	toString() {
		return `success(${format$1(this.success)})`;
	},
	toJSON() {
		return {
			_id: "Result",
			_tag: this._tag,
			value: toJson(this.success)
		};
	}
});
var FailureProto = /*#__PURE__*/ Object.assign(/*#__PURE__*/ Object.create(CommonProto), {
	_tag: "Failure",
	_op: "Failure",
	[symbol](that) {
		return isResult$1(that) && isFailure$1(that) && equals$1(this.failure, that.failure);
	},
	[symbol$1]() {
		return combine(hash(this._tag))(hash(this.failure));
	},
	toString() {
		return `failure(${format$1(this.failure)})`;
	},
	toJSON() {
		return {
			_id: "Result",
			_tag: this._tag,
			failure: toJson(this.failure)
		};
	}
});
/** @internal */
var isResult$1 = (input) => hasProperty(input, TypeId$24);
/** @internal */
var isFailure$1 = (result) => result._tag === "Failure";
/** @internal */
var isSuccess$2 = (result) => result._tag === "Success";
/** @internal */
var FailureImpl = function(failure) {
	this.failure = failure;
};
FailureImpl.prototype = FailureProto;
/** @internal */
var fail$5 = (failure) => new FailureImpl(failure);
/** @internal */
var SuccessImpl = function(success) {
	this.success = success;
};
SuccessImpl.prototype = SuccessProto;
/** @internal */
var succeed$5 = (success) => new SuccessImpl(success);
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Order.js
/**
* Defines comparison functions for ordered values.
*
* An `Order<A>` compares two `A` values and returns whether the first is less
* than, equal to, or greater than the second. Orders are used for sorting,
* choosing minimum or maximum values, checking ranges, and building ordered data
* structures. This module includes built-in orders, constructors for custom
* orders, tools for reversing and combining comparisons, tuple and struct
* helpers, comparison predicates, clamping, and reducer support.
*
* @stability stable
* @since 2.0.0
*/
/**
* Creates a new `Order` instance from a comparison function.
*
* **When to use**
*
* Use when you need a sorting rule not covered by the built-in orders or input
* mapping helpers, and you can provide a total comparison.
*
* **Details**
*
* Uses reference equality (`===`) as a shortcut: if `self === that`, it returns
* `0` without calling the comparison function. The comparison function should
* return `-1`, `0`, or `1`, and the returned order satisfies total ordering
* laws when the comparison function does.
*
* **Example** (Creating an Order)
*
* ```ts import.meta.vitest
* import { Order } from "effect"
*
* const byAge = Order.make<{ name: string; age: number }>((self, that) => {
*   if (self.age < that.age) return -1
*   if (self.age > that.age) return 1
*   return 0
* })
*
* byAge({ name: "Alice", age: 30 }, { name: "Bob", age: 25 }) // => 1
* byAge({ name: "Alice", age: 25 }, { name: "Bob", age: 30 }) // => -1
* ```
*
* @see {@link mapInput} to transform an order by mapping the input type
* @see {@link combine} to combine multiple orders
* @stability stable
* @category constructors
* @since 2.0.0
*/
function make$13(compare) {
	return (self, that) => self === that ? 0 : compare(self, that);
}
/**
* Order instance for strings that compares them lexicographically using JavaScript's `<` operator.
*
* **When to use**
*
* Use when you need lexicographic string ordering.
*
* **Details**
*
* Uses lexicographic dictionary ordering. The empty string is less than any
* non-empty string, and comparisons are case-sensitive.
*
* **Example** (Ordering strings)
*
* ```ts import.meta.vitest
* import { Order } from "effect"
*
* Order.String("apple", "banana") // => -1
* Order.String("banana", "apple") // => 1
* Order.String("apple", "apple") // => 0
* ```
*
* @see {@link mapInput} to compare objects by a string property
* @see {@link Struct} to combine with other orders for struct comparison
* @stability stable
* @category instances
* @since 4.0.0
*/
var String$4 = /*#__PURE__*/ make$13((self, that) => self < that ? -1 : 1);
/**
* Order instance for numbers that compares them numerically.
*
* **When to use**
*
* Use when you need numeric ordering for numbers.
*
* **Details**
*
* `0` is considered equal to `-0`. All `NaN` values are considered equal to
* each other, and any `NaN` is considered less than any non-`NaN` number. All
* other values use standard numeric comparison.
*
* **Example** (Ordering numbers)
*
* ```ts import.meta.vitest
* import { Order } from "effect"
*
* Order.Number(1, 1) // => 0
* Order.Number(1, 2) // => -1
* Order.Number(2, 1) // => 1
*
* Order.Number(0, -0) // => 0
* Order.Number(NaN, 1) // => -1
* ```
*
* @see {@link mapInput} to compare objects by a number property
* @see {@link BigInt} for bigint comparisons
* @stability stable
* @category instances
* @since 4.0.0
*/
var Number$4 = /*#__PURE__*/ make$13((self, that) => {
	if (globalThis.Number.isNaN(self) && globalThis.Number.isNaN(that)) return 0;
	if (globalThis.Number.isNaN(self)) return -1;
	if (globalThis.Number.isNaN(that)) return 1;
	return self < that ? -1 : 1;
});
/**
* Checks whether one value is greater than or equal to another according to the given order.
*
* **When to use**
*
* Use when you need a boolean greater-than-or-equal predicate using an
* `Order`.
*
* **Details**
*
* Returns `true` if the order returns `1` or `0`, and returns `false` only if
* the order returns `-1`.
*
* **Example** (Checking greater-than-or-equal comparisons)
*
* ```ts import.meta.vitest
* import { Order } from "effect"
*
* const isGreaterThanOrEqualToNumber = Order.isGreaterThanOrEqualTo(Order.Number)
*
* isGreaterThanOrEqualToNumber(2, 1) // => true
* isGreaterThanOrEqualToNumber(1, 1) // => true
* isGreaterThanOrEqualToNumber(1, 2) // => false
* ```
*
* @see {@link isGreaterThan} for strict greater than
* @see {@link isLessThanOrEqualTo} for less than or equal
* @stability stable
* @category predicates
* @since 4.0.0
*/
var isGreaterThanOrEqualTo$1 = (O) => dual(2, (self, that) => O(self, that) !== -1);
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Option.js
/**
* Creates an `Option` representing the absence of a value.
*
* **When to use**
*
* Use to represent a missing or uninitialized value, such as returning "no
* result" from a function.
*
* **Details**
*
* - Returns `Option<never>`, which is a subtype of `Option<A>` for any `A`
* - Always returns the same singleton instance
*
* **Example** (Creating an empty Option)
*
* ```ts import.meta.vitest
* import { Option } from "effect"
*
* //      ┌─── Option<never>
* //      ▼
* const noValue = Option.none() // => Option.none()
* ```
*
* @see {@link some} for the opposite operation.
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var none = () => none$1;
/**
* Wraps the given value into an `Option` to represent its presence.
*
* **When to use**
*
* Use to wrap a known present value as `Option`
* - Returning a successful result from a partial function
*
* **Details**
*
* - Always returns `Some<A>`
* - Does not filter `null` or `undefined`; use {@link fromNullishOr} for that
*
* **Example** (Wrapping a value)
*
* ```ts import.meta.vitest
* import { Option } from "effect"
*
* //      ┌─── Option<number>
* //      ▼
* const value = Option.some(1) // => Option.some(1)
* ```
*
* @see {@link none} for the opposite operation.
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var some = some$1;
/**
* Checks whether an `Option` is `None` (absent).
*
* **When to use**
*
* Use when you need to branch on an absent `Option` before accessing `.value`.
*
* **Details**
*
* - Acts as a type guard, narrowing to `None<A>`
*
* **Example** (Checking for None)
*
* ```ts import.meta.vitest
* import { Option } from "effect"
*
* Option.isNone(Option.some(1)) // => false
* Option.isNone(Option.none()) // => true
* ```
*
* @see {@link isSome} for the opposite check.
*
* @stability stable
* @category guards
* @since 2.0.0
*/
var isNone = isNone$1;
/**
* Checks whether an `Option` contains a value (`Some`).
*
* **When to use**
*
* Use when you need to branch on a present `Option` before accessing `.value`.
*
* **Details**
*
* - Acts as a type guard, narrowing to `Some<A>`
*
* **Example** (Checking for Some)
*
* ```ts import.meta.vitest
* import { Option } from "effect"
*
* Option.isSome(Option.some(1)) // => true
* Option.isSome(Option.none()) // => false
* ```
*
* @see {@link isNone} for the opposite check.
*
* @stability stable
* @category guards
* @since 2.0.0
*/
var isSome = isSome$1;
/**
* Extracts the value from a `Some`, or evaluates a fallback thunk on `None`.
*
* **When to use**
*
* Use when providing a default value for an absent `Option`
* - Unwrapping with lazy evaluation of the fallback
*
* **Details**
*
* - `Some` → returns the inner value
* - `None` → calls `onNone()` and returns its result
* - `onNone` is only called when needed (lazy)
*
* **Example** (Unwrapping with a fallback)
*
* ```ts import.meta.vitest
* import { Option } from "effect"
*
* Option.some(1).pipe(Option.getOrElse(() => 0)) // => 1
* Option.none().pipe(Option.getOrElse(() => 0)) // => 0
* ```
*
* @see {@link getOrNull} to fall back to `null`
* @see {@link getOrUndefined} to fall back to `undefined`
* @see {@link getOrThrow} to throw on `None`
*
* @stability stable
* @category getters
* @since 2.0.0
*/
var getOrElse = /*#__PURE__*/ dual(2, (self, onNone) => isNone(self) ? onNone() : self.value);
/**
* Transforms the value inside a `Some` using the provided function, leaving
* `None` unchanged.
*
* **When to use**
*
* Use to apply a pure transformation to an `Option`'s present value, especially
* when chaining transformations in a pipeline.
*
* **Details**
*
* - `Some` → applies `f` and wraps the result in a new `Some`
* - `None` → returns `None` unchanged
*
* **Example** (Mapping over an Option)
*
* ```ts import.meta.vitest
* import { Option } from "effect"
*
* Option.map(Option.some(2), (n) => n * 2) // => Option.some(4)
* Option.map(Option.none(), (n: number) => n * 2) // => Option.none()
* ```
*
* @see {@link flatMap} when `f` returns an `Option`
* @see {@link as} to replace the value with a constant
*
* @stability stable
* @category mapping
* @since 2.0.0
*/
var map$7 = /*#__PURE__*/ dual(2, (self, f) => isNone(self) ? none() : some(f(self.value)));
/**
* Filters an `Option` using a predicate. Returns `None` if the predicate is
* not satisfied or the input is `None`.
*
* **When to use**
*
* Use when you need to discard an `Option`'s present value when it does not
* meet a condition, while narrowing the type via a refinement predicate.
*
* **Details**
*
* - `None` → `None`
* - `Some` where `predicate(value)` is `true` → `Some(value)`
* - `Some` where `predicate(value)` is `false` → `None`
* - Supports refinements for type narrowing
*
* **Example** (Filtering with a predicate)
*
* ```ts import.meta.vitest
* import { Option } from "effect"
*
* const removeEmpty = (input: Option.Option<string>) =>
*   Option.filter(input, (value) => value !== "")
*
* removeEmpty(Option.some("hello")) // => Option.some("hello")
* removeEmpty(Option.some("")) // => Option.none()
* removeEmpty(Option.none()) // => Option.none()
* ```
*
* @see {@link filterMap} to transform and filter simultaneously
* @see {@link exists} to test without filtering
*
* @stability stable
* @category filtering
* @since 2.0.0
*/
var filter = /*#__PURE__*/ dual(2, (self, predicate) => isNone(self) ? none() : predicate(self.value) ? some(self.value) : none());
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Result.js
/**
* Creates a `Result` holding a `Success` value.
*
* **Details**
*
* - Use when you have a value and want to lift it into the `Result` type
* - The error type `E` defaults to `never`
*
* **Example** (Wrapping a value)
*
* ```ts import.meta.vitest
* import { Result } from "effect"
*
* Result.succeed(42) // => Result.succeed(42)
* ```
*
* @see {@link fail} to create a Failure
* @see {@link void_ void} for a pre-built `Success<void>`
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var succeed$4 = succeed$5;
/**
* Creates a `Result` holding a `Failure` value.
*
* **When to use**
*
* Use to represent a failed `Result` with a typed failure value.
*
* **Details**
*
* - The success type `A` defaults to `never`
*
* **Example** (Creating a failure)
*
* ```ts import.meta.vitest
* import { Result } from "effect"
*
* Result.fail("Something went wrong") // => Result.fail("Something went wrong")
* ```
*
* @see {@link succeed} to create a Success
* @see {@link mapError} to transform the error
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var fail$4 = fail$5;
/**
* Checks whether a value is a `Result` (either `Success` or `Failure`).
*
* **When to use**
*
* Use to validate unknown input before operating on it as a `Result`.
*
* **Details**
*
* - Returns `true` for both `Success` and `Failure` variants
* - Acts as a TypeScript type guard, narrowing to `Result<unknown, unknown>`
*
* **Example** (Checking if a value is a Result)
*
* ```ts import.meta.vitest
* import { Result } from "effect"
*
* Result.isResult(Result.succeed(1)) // => true
*
* Result.isResult({ value: 1 }) // => false
* ```
*
* @see {@link isSuccess} / {@link isFailure} to narrow to a specific variant
*
* @stability stable
* @category guards
* @since 4.0.0
*/
var isResult = isResult$1;
/**
* Checks whether a `Result` is a `Failure`.
*
* **When to use**
*
* Use to narrow a known `Result` to the `Failure` variant.
*
* **Details**
*
* - Acts as a TypeScript type guard, narrowing to `Failure<A, E>`
* - After narrowing, you can access `.failure` to read the error value
*
* **Example** (Narrowing to failure)
*
* ```ts import.meta.vitest
* import { Result } from "effect"
*
* const result = Result.fail("oops")
*
* if (Result.isFailure(result)) {
*   result.failure // => "oops"
* }
* ```
*
* @see {@link isSuccess} for the opposite check
* @see {@link isResult} to check if a value is any Result
*
* @stability stable
* @category guards
* @since 4.0.0
*/
var isFailure = isFailure$1;
/**
* Checks whether a `Result` is a `Success`.
*
* **When to use**
*
* Use to narrow a known `Result` to the `Success` variant.
*
* **Details**
*
* - Acts as a TypeScript type guard, narrowing to `Success<A, E>`
* - After narrowing, you can access `.success` to read the value
*
* **Example** (Narrowing to success)
*
* ```ts import.meta.vitest
* import { Result } from "effect"
*
* const result = Result.succeed(42)
*
* if (Result.isSuccess(result)) {
*   result.success // => 42
* }
* ```
*
* @see {@link isFailure} for the opposite check
* @see {@link isResult} to check if a value is any Result
*
* @stability stable
* @category guards
* @since 4.0.0
*/
var isSuccess$1 = isSuccess$2;
/**
* Folds a `Result` into a single value by applying one of two functions.
*
* **When to use**
*
* Use when a `Result`'s success and failure branches should be collapsed into
* one plain output type.
*
* **Details**
*
* - Applies `onSuccess` if the result is a `Success`
* - Applies `onFailure` if the result is a `Failure`
* - Both branches must return the same type (or a common supertype)
*
* **Example** (Folding to a string)
*
* ```ts import.meta.vitest
* import { pipe, Result } from "effect"
*
* const format = Result.match({
*   onSuccess: (n: number) => `Got ${n}`,
*   onFailure: (e: string) => `Err: ${e}`
* })
*
* format(Result.succeed(42)) // => "Got 42"
*
* format(Result.fail("timeout")) // => "Err: timeout"
* ```
*
* @see {@link merge} to extract `A | E` without mapping
* @see {@link getOrElse} to unwrap only the success with a fallback
*
* @stability stable
* @category pattern matching
* @since 2.0.0
*/
var match$1 = /*#__PURE__*/ dual(2, (self, { onFailure, onSuccess }) => isFailure(self) ? onFailure(self.failure) : onSuccess(self.success));
/**
* Maps a record into another record by applying a transformation function to each of its values.
*
* **Example** (Mapping record values)
*
* ```ts import.meta.vitest
* import { Record } from "effect"
*
* const f = (n: number) => `-${n}`
*
* Record.map({ a: 3, b: 5 }, f) // => { a: "-3", b: "-5" }
*
* const g = (n: number, key: string) => `${key.toUpperCase()}-${n}`
*
* Record.map({ a: 3, b: 5 }, g) // => { a: "A-3", b: "B-5" }
* ```
*
* @stability stable
* @category mapping
* @since 2.0.0
*/
var map$5 = /*#__PURE__*/ dual(2, (self, f) => {
	const out = { ...self };
	for (const key of keys(self)) assignProperty(out, key, f(self[key], key));
	return out;
});
/**
* Retrieves the keys of a given record as an array.
*
* **Example** (Getting record keys)
*
* ```ts import.meta.vitest
* import { Record } from "effect"
*
* Record.keys({ a: 1, b: 2, c: 3 }) // => ["a", "b", "c"]
* ```
*
* @stability stable
* @category getters
* @since 2.0.0
*/
var keys = (self) => Object.keys(self);
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Array.js
/**
* Exposes the global array constructor.
*
* **When to use**
*
* Use to access native JavaScript array constructor methods such as `isArray`
* or `from` from the Effect module namespace.
*
* **Example** (Accessing the Array constructor)
*
* ```ts import.meta.vitest
* import { Array } from "effect"
*
* Array.Array === globalThis.Array // => true
* ```
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Array$1 = globalThis.Array;
/**
* Converts an `Iterable` to an `Array`.
*
* **When to use**
*
* Use to convert any `Iterable` (Set, Generator, etc.) into an array.
*
* **Details**
*
* If the input is already an array, this returns it by reference without
* copying. Otherwise, it creates a new array from the iterable. Use `copy` if
* you need a fresh array even when the input is already an array.
*
* **Example** (Converting a Set to an array)
*
* ```ts import.meta.vitest
* import { Array } from "effect"
*
* Array.fromIterable(new Set([1, 2, 3])) // => [1, 2, 3]
* ```
*
* @see {@link ensure} — wrap a single value or return an existing array
* @see {@link copy} — create a shallow copy of an array
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var fromIterable$1 = (collection) => Array$1.isArray(collection) ? collection : Array$1.from(collection);
/**
* Normalizes a value that is either a single element or an array into an array.
*
* **When to use**
*
* Use to normalize input that may be a single value or an array into a consistent
* array.
*
* **Details**
*
* If the input is already an array, this returns it by reference. If the input
* is a single value, this wraps it in a one-element array. This is useful for
* APIs that accept `A | Array<A>`.
*
* **Example** (Normalizing input)
*
* ```ts import.meta.vitest
* import { Array } from "effect"
*
* Array.ensure("a") // => ["a"]
* Array.ensure(["a", "b", "c"]) // => ["a", "b", "c"]
* ```
*
* @see {@link of} — always wrap in a single-element array
* @see {@link fromIterable} — convert any iterable
*
* @stability stable
* @category constructors
* @since 3.3.0
*/
var ensure = (self) => Array$1.isArray(self) ? self : [self];
/**
* Adds a single element to the end of an iterable, returning a `NonEmptyArray`.
*
* **When to use**
*
* Use when you need to guarantee a non-empty result after adding a required
* trailing value.
*
* **Example** (Appending an element)
*
* ```ts import.meta.vitest
* import { Array } from "effect"
*
* Array.append([1, 2, 3], 4) // => [1, 2, 3, 4]
* ```
*
* @see {@link prepend} — add to the front
* @see {@link appendAll} — append multiple elements
*
* @stability stable
* @category combining
* @since 2.0.0
*/
var append = /*#__PURE__*/ dual(2, (self, last) => [...self, last]);
Array$1.isArray;
/**
* Checks whether a mutable `Array` is non-empty, narrowing the type to
* `NonEmptyArray`.
*
* **When to use**
*
* Use when you need the narrowed value to remain a mutable `Array` after proving
* it has at least one element.
*
* **Example** (Checking for a non-empty array)
*
* ```ts import.meta.vitest
* import { Array } from "effect"
*
* Array.isArrayNonEmpty([]) // => false
* Array.isArrayNonEmpty([1, 2, 3]) // => true
* ```
*
* @see {@link isReadonlyArrayNonEmpty} — readonly variant
* @see {@link isArrayEmpty} — opposite check
*
* @stability stable
* @category guards
* @since 4.0.0
*/
var isArrayNonEmpty = isArrayNonEmpty$1;
/**
* Checks whether a `ReadonlyArray` is non-empty, narrowing the type to
* `NonEmptyReadonlyArray`.
*
* **When to use**
*
* Use when you need to prove a readonly array has at least one element without
* requiring mutable array methods afterward.
*
* **Example** (Checking for a non-empty readonly array)
*
* ```ts import.meta.vitest
* import { Array } from "effect"
*
* Array.isReadonlyArrayNonEmpty([]) // => false
* Array.isReadonlyArrayNonEmpty([1, 2, 3]) // => true
* ```
*
* @see {@link isArrayNonEmpty} — mutable variant
* @see {@link isReadonlyArrayEmpty} — opposite check
*
* @stability stable
* @category guards
* @since 4.0.0
*/
var isReadonlyArrayNonEmpty = isArrayNonEmpty$1;
/**
* Creates an empty array.
*
* **When to use**
*
* Use to create a typed empty array without allocating placeholder elements.
*
* **Example** (Creating an empty array)
*
* ```ts import.meta.vitest
* import { Array } from "effect"
*
* Array.empty<number>() // => []
* ```
*
* @see {@link of} — create a single-element array
* @see {@link make} — create from multiple values
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var empty$1 = () => [];
/**
* Transforms each element using a function, returning a new array.
*
* **When to use**
*
* Use to transform each element independently while preserving the array shape.
*
* **Details**
*
* The function receives `(element, index)`. The return type preserves
* `NonEmptyArray`.
*
* **Example** (Doubling values)
*
* ```ts import.meta.vitest
* import { Array } from "effect"
*
* Array.map([1, 2, 3], (x) => x * 2) // => [2, 4, 6]
* ```
*
* @see {@link flatMap} — map and flatten
*
* @stability stable
* @category mapping
* @since 2.0.0
*/
var map$4 = /*#__PURE__*/ dual(2, (self, f) => self.map(f));
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/BigDecimal.js
/**
* Decimal numbers and arithmetic for cases where JavaScript `number` rounding
* is not precise enough. A `BigDecimal` stores digits as a `bigint` plus a
* decimal scale, which lets the module parse, compare, add, subtract, multiply,
* divide, round, and format decimal values such as money, quantities, and
* measurements.
*
* Parsed scales are limited to ±10,000, and operations that align scales throw
* a `RangeError` when the scales differ by more than 20,000.
*
* @stability stable
* @since 2.0.0
*/
var TypeId$23 = "~effect/BigDecimal";
var BigDecimalProto = {
	[TypeId$23]: TypeId$23,
	[symbol$1]() {
		const normalized = normalize$1(this);
		return combine(string$1(String(normalized.value)), number$1(normalized.scale));
	},
	[symbol](that) {
		return isBigDecimal(that) && compare(this, that) === 0;
	},
	toString() {
		return `BigDecimal(${format(this)})`;
	},
	toJSON() {
		return {
			_id: "BigDecimal",
			value: String(this.value),
			scale: this.scale
		};
	},
	[NodeInspectSymbol]() {
		return this.toJSON();
	},
	pipe() {
		return pipeArguments(this, arguments);
	}
};
/**
* Checks whether a given value is a `BigDecimal`.
*
* **When to use**
*
* Use to validate unknown input and narrow it to `BigDecimal`.
*
* **Example** (Checking BigDecimal values)
*
* ```ts import.meta.vitest
* import { BigDecimal } from "effect"
*
* const decimal = BigDecimal.fromNumber(123.45)
* BigDecimal.isBigDecimal(decimal) // => false
* BigDecimal.isBigDecimal(BigDecimal.fromStringUnsafe("123.45")) // => true
* BigDecimal.isBigDecimal(123.45) // => false
* BigDecimal.isBigDecimal("123.45") // => false
* ```
*
* @stability stable
* @category guards
* @since 2.0.0
*/
var isBigDecimal = (u) => hasProperty(u, TypeId$23);
/**
* Creates a `BigDecimal` from a `bigint` value and a safe integer scale.
*
* **When to use**
*
* Use to construct a decimal directly from its unscaled integer value and
* decimal scale.
*
* **Gotchas**
*
* Throws a `RangeError` if `scale` is not a safe integer.
*
* **Example** (Creating decimals from bigint and scale)
*
* ```ts import.meta.vitest
* import { BigDecimal } from "effect"
*
* // Create 123.45 (12345 with scale 2)
* const decimal = BigDecimal.make(12345n, 2)
* decimal // => BigDecimal.fromStringUnsafe("123.45")
*
* // Create 42 (42 with scale 0)
* const integer = BigDecimal.make(42n, 0)
* integer // => BigDecimal.fromBigInt(42n)
* ```
*
* @see {@link fromBigInt} for constructing an integer decimal from a `bigint`
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var make$12 = (value, scale) => {
	if (!Number.isSafeInteger(scale)) throw new RangeError(`Scale must be a safe integer, got ${scale}`);
	const o = Object.create(BigDecimalProto);
	o.value = value;
	o.scale = scale;
	return o;
};
var makeNormalized = (value, scale) => {
	const o = make$12(value, scale);
	o.normalized = o;
	return o;
};
var bigint0$1 = /*#__PURE__*/ BigInt(0);
var bigint1$1 = /*#__PURE__*/ BigInt(1);
var bigint10$1 = /*#__PURE__*/ BigInt(10);
var zero$1 = /*#__PURE__*/ makeNormalized(bigint0$1, 0);
/**
* Normalizes a given `BigDecimal` by removing trailing zeros.
*
* **When to use**
*
* Use to canonicalize decimals that have equivalent values but different
* internal scales.
*
* **Example** (Normalizing trailing zeros)
*
* ```ts import.meta.vitest
* import { BigDecimal } from "effect"
*
* const decimal = BigDecimal.normalize(BigDecimal.fromStringUnsafe("123.00000"))
* const decimalStorage = [decimal.value, decimal.scale] // => [123n, 0]
*
* const largeDecimal = BigDecimal.normalize(BigDecimal.fromStringUnsafe("12300000"))
* const largeDecimalStorage = [largeDecimal.value, largeDecimal.scale] // => [123n, -5]
* ```
*
* @see {@link format} for rendering normalized decimals as strings
*
* @stability stable
* @category scaling
* @since 2.0.0
*/
var normalize$1 = (self) => {
	if (self.normalized === void 0) {
		if (self.value === bigint0$1) self.normalized = zero$1;
		else {
			const digits = `${self.value}`;
			const zeros = trailingZeros(digits);
			self.normalized = makeNormalized(BigInt(digits.slice(0, digits.length - zeros)), self.scale - zeros);
		}
	}
	return self.normalized;
};
var trailingZeros = (digits) => {
	let end = digits.length;
	while (digits[end - 1] === "0") end--;
	return digits.length - end;
};
var MAX_COMPARISON_SCALE_ALIGNMENT = 100;
var comparisonPowersOfTen = [bigint1$1];
var compareBigInt = (self, that) => self === that ? 0 : self < that ? -1 : 1;
var compareMagnitude = (self, that) => {
	const selfDigits = `${self.value < bigint0$1 ? -self.value : self.value}`;
	const thatDigits = `${that.value < bigint0$1 ? -that.value : that.value}`;
	const exponentDifference = BigInt(selfDigits.length - thatDigits.length) - BigInt(self.scale) + BigInt(that.scale);
	if (exponentDifference !== bigint0$1) return exponentDifference < bigint0$1 ? -1 : 1;
	const length = Math.max(selfDigits.length, thatDigits.length);
	return String$4(selfDigits.padEnd(length, "0"), thatDigits.padEnd(length, "0"));
};
var compare = (self, that) => {
	if (self.scale === that.scale) return compareBigInt(self.value, that.value);
	const selfSign = sign(self);
	const thatSign = sign(that);
	if (selfSign !== thatSign) return selfSign < thatSign ? -1 : 1;
	if (selfSign === 0) return 0;
	const scaleDifference = self.scale - that.scale;
	const absoluteScaleDifference = Math.abs(scaleDifference);
	if (absoluteScaleDifference > MAX_COMPARISON_SCALE_ALIGNMENT) return selfSign === -1 ? compareMagnitude(that, self) : compareMagnitude(self, that);
	const powerOfTen = comparisonPowersOfTen[absoluteScaleDifference] ??= bigint10$1 ** BigInt(absoluteScaleDifference);
	return scaleDifference > 0 ? compareBigInt(self.value, that.value * powerOfTen) : compareBigInt(self.value * powerOfTen, that.value);
};
/**
* Determines the sign of a given `BigDecimal`.
*
* **When to use**
*
* Use to classify a `BigDecimal` as negative, zero, or positive.
*
* **Example** (Reading decimal signs)
*
* ```ts import.meta.vitest
* import { BigDecimal } from "effect"
*
* BigDecimal.sign(BigDecimal.fromStringUnsafe("-5")) // => -1
* BigDecimal.sign(BigDecimal.fromStringUnsafe("0")) // => 0
* BigDecimal.sign(BigDecimal.fromStringUnsafe("5")) // => 1
* ```
*
* @stability stable
* @category math
* @since 2.0.0
*/
var sign = (n) => n.value === bigint0$1 ? 0 : n.value < bigint0$1 ? -1 : 1;
/**
* Formats a `BigDecimal` as a string.
*
* **When to use**
*
* Use to render a `BigDecimal` as plain decimal text when possible.
*
* **Details**
*
* The value is normalized before formatting. Scientific notation is used when
* the absolute value of the normalized scale is at least `16`; otherwise plain
* decimal notation is used.
*
* **Example** (Formatting decimals)
*
* ```ts import.meta.vitest
* import { BigDecimal } from "effect"
*
* BigDecimal.format(BigDecimal.fromStringUnsafe("-5")) // => "-5"
* BigDecimal.format(BigDecimal.fromStringUnsafe("123.456")) // => "123.456"
* BigDecimal.format(BigDecimal.fromStringUnsafe("-0.00000123")) // => "-0.00000123"
* ```
*
* @see {@link toExponential} for always rendering scientific notation
*
* @stability stable
* @category converting
* @since 2.0.0
*/
var format = (n) => {
	const normalized = normalize$1(n);
	if (Math.abs(normalized.scale) >= 16) return toExponential(normalized);
	const negative = normalized.value < bigint0$1;
	const absolute = `${negative ? -normalized.value : normalized.value}`;
	const digits = normalized.scale > 0 ? absolute.padStart(normalized.scale + 1, "0") : absolute.padEnd(absolute.length - normalized.scale, "0");
	const point = digits.length - normalized.scale;
	const complete = normalized.scale > 0 ? `${digits.slice(0, point)}.${digits.slice(point)}` : digits;
	return negative ? `-${complete}` : complete;
};
/**
* Formats a given `BigDecimal` as a `string` in scientific notation.
*
* **When to use**
*
* Use to render a `BigDecimal` in scientific notation.
*
* **Example** (Formatting decimals exponentially)
*
* ```ts import.meta.vitest
* import { BigDecimal } from "effect"
*
* BigDecimal.toExponential(BigDecimal.make(123456n, -5)) // => "1.23456e+10"
* ```
*
* @see {@link format} for plain decimal formatting when possible
*
* @stability stable
* @category converting
* @since 3.11.0
*/
var toExponential = (n) => {
	if (isZero(n)) return "0e+0";
	const normalized = normalize$1(n);
	const digits = `${normalized.value}`;
	const point = normalized.value < bigint0$1 ? 2 : 1;
	const head = digits.slice(0, point);
	const tail = digits.slice(point);
	const exp = tail.length - normalized.scale;
	return `${head}${tail === "" ? "" : `.${tail}`}e${exp >= 0 ? "+" : ""}${exp}`;
};
/**
* Checks whether a given `BigDecimal` is `0`.
*
* **When to use**
*
* Use to test whether a `BigDecimal` is exactly zero.
*
* **Example** (Checking zero decimals)
*
* ```ts import.meta.vitest
* import { BigDecimal } from "effect"
*
* BigDecimal.isZero(BigDecimal.fromStringUnsafe("0")) // => true
* BigDecimal.isZero(BigDecimal.fromStringUnsafe("1")) // => false
* ```
*
* @stability stable
* @category predicates
* @since 2.0.0
*/
var isZero = (n) => n.value === bigint0$1;
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Effectable.js
/**
* Create a low-level `Effect` prototype.
*
* **When to use**
*
* Use when you need to create a custom Effect-like value without extending a
* class, by providing a label and an evaluate function that receives the
* current fiber.
*
* **Details**
*
* When the effect is evaluated, it calls `evaluate` with the current fiber.
*
* @see {@link Class} for a class-based approach to defining custom Effect values
* @see {@link Mixin} for wrapping an existing class constructor
*
* @stability stable
* @category prototypes
* @since 4.0.0
*/
var Prototype = (options) => makePrimitiveProto({
	op: options.label,
	[evaluate]: options.evaluate
});
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Context.js
/**
* Runtime type identifier attached to `Context` service keys and used by
* `isKey` to recognize them.
*
* @stability stable
* @category type IDs
* @since 4.0.0
*/
var ServiceTypeId = "~effect/Context/Service";
/**
* Creates a `Context` service key.
*
* **When to use**
*
* Use when you need to define a context service key for a dependency that must
* be provided by the surrounding context.
*
* **Details**
*
* Call `Context.Service("Key")` for a function-style key, or use the two-stage
* form `Context.Service<Self, Shape>()("Key")` for class-style service
* declarations. The returned key can be yielded as an Effect and passed to
* `Context.make`, `Context.add`, and the Context getter functions.
*
* **Gotchas**
*
* The string key is the runtime identity of the service. Reusing the same key
* string for unrelated services makes them occupy the same slot in a
* `Context`.
*
* **Example** (Creating service keys)
*
* ```ts import.meta.vitest
* import { Context } from "effect"
*
* // Create a simple service
* const Database = Context.Service<{
*   query: (sql: string) => string
* }>("Database")
*
* // Create a service class
* class Config extends Context.Service<Config, {
*   port: number
* }>()("Config") {}
*
* // Use the services to create contexts
* const db = Context.make(Database, {
*   query: (sql) => `Result: ${sql}`
* })
* const config = Context.make(Config, { port: 8080 })
* Context.get(db, Database).query("SELECT 1") // => "Result: SELECT 1"
* Context.get(config, Config).port // => 8080
* ```
*
* @see {@link Reference} for service keys with default values
*
* @stability stable
* @category services
* @since 4.0.0
*/
var Service$1 = function() {
	function KeyClass() {}
	const self = KeyClass;
	Object.setPrototypeOf(self, ServiceProto);
	const init = (key, options) => {
		self.key = key;
		if (options?.defaultValue) {
			self[ReferenceTypeId] = ReferenceTypeId;
			self.defaultValue = options.defaultValue;
		}
		if (options?.make) self.make = options.make;
		if (options?.fiberCached) cacheKeys.add(key);
		return self;
	};
	return arguments.length > 0 ? init(arguments[0], arguments[1]) : init;
};
var ServiceProto = {
	[ServiceTypeId]: ServiceTypeId,
	.../*#__PURE__*/ Prototype({
		label: "Service",
		evaluate(fiber) {
			return exitSucceed(get$1(fiber.context, this));
		}
	}),
	toJSON() {
		return {
			_id: "Service",
			key: this.key
		};
	},
	of(self) {
		return self;
	},
	context(self) {
		return make$11(this, self);
	},
	use(f) {
		return withFiber$1((fiber) => f(get$1(fiber.context, this)));
	},
	useSync(f) {
		return withFiber$1((fiber) => exitSucceed(f(get$1(fiber.context, this))));
	}
};
var cacheKeys = /*#__PURE__*/ new Set();
var ReferenceTypeId = "~effect/Context/Reference";
var TypeId$22 = "~effect/Context";
var FlattenAfterBaseHits = 8;
var makeImpl = (cacheRoot, base, overlay, depth, maxDepth) => {
	const self = Object.create(Proto$9);
	self.cacheRoot = cacheRoot ?? self;
	self.base = base;
	self.overlay = overlay;
	self.depth = depth;
	self._flat = void 0;
	self.baseHits = 0;
	self.maxDepth = maxDepth;
	return self;
};
var applyOverlays = (map, overlay) => {
	if (!overlay) return;
	applyOverlays(map, overlay.parent);
	map.set(overlay.key, overlay.value);
};
var flatten = (self) => {
	if (self._flat) return self._flat;
	if (!self.overlay) return self._flat = self.base;
	const map = new Map(self.base);
	applyOverlays(map, self.overlay);
	return self._flat = map;
};
var withFlat = (self, f) => {
	const map = new Map(self.mapUnsafe);
	f(map);
	return makeImpl(void 0, map, void 0, 0, self.maxDepth);
};
var notFound = /*#__PURE__*/ Symbol();
var lookup = (self, key) => {
	const impl = self;
	for (let overlay = impl.overlay; overlay; overlay = overlay.parent) if (overlay.key === key) return overlay.value;
	const value = impl.base.get(key);
	if (value === void 0 && !impl.base.has(key)) return notFound;
	if (impl.overlay && ++impl.baseHits >= impl.base.size && impl.baseHits >= FlattenAfterBaseHits) {
		impl.base = flatten(impl);
		impl.overlay = void 0;
		impl.depth = 0;
	}
	return value;
};
/**
* Creates a `Context` from an existing service map.
*
* **When to use**
*
* Use when constructing a low-level `Context` from a trusted map whose lifecycle
* you control.
*
* **Details**
*
* `options.maxDepth` sets how many `add` calls are kept as overlays before the
* context is rebased into a flat map (default `8`). Lower values make lookups
* cheaper, higher values make additions to a large base cheaper. Invalid
* values fall back to the default.
*
* Contexts derived with `add`, `pick`, `omit`, and `merge` keep the setting
* (`merge` from its first non-empty argument). `make`, `empty`, and `mergeAll`
* use the default. Layers are combined with `mergeAll`, so apply it to the
* final context rather than inside a layer.
*
* **Gotchas**
*
* Excessively large `maxDepth` values can cause stack overflow when overlays
* are materialized or rebased. Choose a modest value.
*
* The provided map is retained without copying and must not be mutated after
* construction. Prefer `empty`, `make`, `add`, or `merge` for normal Context
* construction.
*
* **Example** (Creating a context from a map)
*
* ```ts import.meta.vitest
* import { Context } from "effect"
*
* // Create a context from a Map (unsafe)
* const map = new Map([
*   ["Logger", { log: (_msg: string) => {} }]
* ])
*
* const context = Context.makeUnsafe(map)
* context.mapUnsafe.size // => 1
* ```
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var makeUnsafe$4 = (mapUnsafe, options) => {
	const maxDepth = options?.maxDepth;
	return makeImpl(void 0, mapUnsafe, void 0, 0, Number.isInteger(maxDepth) && maxDepth >= 0 ? maxDepth : 8);
};
var Proto$9 = {
	get mapUnsafe() {
		return flatten(this);
	},
	...PipeInspectableProto,
	[TypeId$22]: { _Services: (_) => _ },
	toJSON() {
		return {
			_id: "Context",
			services: Array.from(this.mapUnsafe).map(([key, value]) => ({
				key,
				value
			}))
		};
	},
	[symbol](that) {
		if (!isContext(that)) return false;
		const self = this.mapUnsafe;
		const other = that.mapUnsafe;
		if (self.size !== other.size) return false;
		for (const [key, value] of self) if (!other.has(key) || !equals$1(value, other.get(key))) return false;
		return true;
	},
	[symbol$1]() {
		return number$1(this.mapUnsafe.size);
	}
};
/** @internal */
var hasSameCache = (self, that) => self.cacheRoot === that.cacheRoot;
/**
* Checks whether the provided argument is a `Context`.
*
* **When to use**
*
* Use to narrow an unknown value before passing it to APIs that require a
* `Context`.
*
* **Details**
*
* This checks the runtime `Context` marker and does not inspect which services
* the context contains.
*
* **Gotchas**
*
* This guard only proves that the value is a `Context`; it does not prove that
* any specific service is present.
*
* **Example** (Checking for contexts)
*
* ```ts import.meta.vitest
* import { Context } from "effect"
* Context.isContext(Context.empty()) // => true
* ```
*
* @see {@link isKey} for checking service keys
* @see {@link isReference} for checking references with defaults
*
* @stability stable
* @category guards
* @since 2.0.0
*/
var isContext = (u) => hasProperty(u, TypeId$22);
/**
* Checks whether the provided argument is a `Reference`.
*
* **Example** (Checking for references)
*
* ```ts import.meta.vitest
* import { Context } from "effect"
*
* const LoggerRef = Context.Reference("Logger", {
*   defaultValue: () => ({ log: (_msg: string) => {} })
* })
*
* Context.isReference(LoggerRef) // => true
* Context.isReference(Context.Service("Key")) // => false
* ```
*
* @stability stable
* @category guards
* @since 3.11.0
*/
var isReference = (u) => !!u[ReferenceTypeId];
/**
* Returns an empty `Context`.
*
* **Example** (Creating an empty context)
*
* ```ts import.meta.vitest
* import { Context } from "effect"
* Context.empty().mapUnsafe.size // => 0
* ```
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var empty = () => emptyContext;
var emptyContext = /*#__PURE__*/ makeUnsafe$4(/*#__PURE__*/ new Map());
/**
* Creates a new `Context` with a single service associated to the key.
*
* **Example** (Creating a context with one service)
*
* ```ts import.meta.vitest
* import { Context } from "effect"
*
* const Port = Context.Service<{ PORT: number }>("Port")
*
* const context = Context.make(Port, { PORT: 8080 })
*
* Context.get(context, Port).PORT // => 8080
* ```
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var make$11 = (key, service) => makeUnsafe$4(/* @__PURE__ */ new Map([[key.key, service]]));
/**
* Adds a service to a given `Context`.
*
* **When to use**
*
* Use when you need to store a known service value in a `Context`.
*
* **Details**
*
* If the context already contains the same service key, the new service
* replaces the previous one.
*
* **Example** (Adding a service to a context)
*
* ```ts import.meta.vitest
* import { Context, pipe } from "effect"
*
* const Port = Context.Service<{ PORT: number }>("Port")
* const Timeout = Context.Service<{ TIMEOUT: number }>("Timeout")
*
* const someContext = Context.make(Port, { PORT: 8080 })
*
* const context = pipe(
*   someContext,
*   Context.add(Timeout, { TIMEOUT: 5000 })
* )
*
* const values = [Context.get(context, Port).PORT, Context.get(context, Timeout).TIMEOUT]
* values // => [8080, 5000]
* ```
*
* @see {@link addOrOmit} for adding or removing a service from an `Option`
*
* @stability stable
* @category combining
* @since 2.0.0
*/
var add = /*#__PURE__*/ dual(3, (self, key, service) => addUnsafe(self, key.key, service));
/**
* Adds a service by key to a given `Context` using a string key.
*
* @stability stable
* @category combining
* @since 4.0.0
*/
var addUnsafe = (self, key, service) => {
	const impl = self;
	const cacheRoot = cacheKeys.has(key) ? void 0 : impl.cacheRoot;
	if (impl.depth >= impl.maxDepth) {
		const map = new Map(impl._flat ?? impl.base);
		if (!impl._flat) applyOverlays(map, impl.overlay);
		map.set(key, service);
		return makeImpl(cacheRoot, map, void 0, 0, impl.maxDepth);
	}
	return makeImpl(cacheRoot, impl.base, {
		key,
		value: service,
		parent: impl.overlay
	}, impl.depth + 1, impl.maxDepth);
};
/**
* Returns the service currently stored for a key, or `undefined` when the key
* is absent.
*
* **When to use**
*
* Use when you need to read the service stored for a key without resolving
* `Context.Reference` defaults.
*
* **Gotchas**
*
* This is a raw lookup and does not resolve default values for
* `Context.Reference` keys.
*
* @see {@link getOption} for a reference-aware optional lookup
*
* @stability stable
* @category getters
* @since 4.0.0
*/
var getOrUndefined = /*#__PURE__*/ dual(2, (self, key) => getOrUndefinedUnsafe(self, key.key));
/** @internal */
var getOrUndefinedUnsafe = (self, key) => {
	const value = lookup(self, key);
	return value === notFound ? void 0 : value;
};
/**
* Gets a service from the context that corresponds to the given key.
*
* **When to use**
*
* Use when you need type-checked access to a service already included in the
* context type.
*
* **Example** (Getting a service from a context)
*
* ```ts import.meta.vitest
* import { Context, pipe } from "effect"
*
* const Port = Context.Service<{ PORT: number }>("Port")
* const Timeout = Context.Service<{ TIMEOUT: number }>("Timeout")
*
* const context = pipe(
*   Context.make(Port, { PORT: 8080 }),
*   Context.add(Timeout, { TIMEOUT: 5000 })
* )
*
* Context.get(context, Timeout).TIMEOUT // => 5000
* ```
*
* @see {@link getOption} for optional service access
* @see {@link getOrElse} for fallback values
*
* @stability stable
* @category getters
* @since 2.0.0
*/
var get$1 = /* @__PURE__ */ dual(2, (self, service) => {
	const value = lookup(self, service.key);
	if (value === notFound) {
		if (isReference(service)) return getDefaultValue(service);
		throw serviceNotFoundError(service);
	}
	return value;
});
var defaultValueCacheKey = "~effect/Context/defaultValue";
var getDefaultValue = (ref) => {
	if (defaultValueCacheKey in ref) return ref[defaultValueCacheKey];
	return ref[defaultValueCacheKey] = ref.defaultValue();
};
var serviceNotFoundError = (service) => {
	const error = /* @__PURE__ */ new Error(`Service not found${service.key ? `: ${String(service.key)}` : ""}`);
	if (error.stack) {
		const lines = error.stack.split("\n");
		lines.splice(1, 3);
		error.stack = lines.join("\n");
	}
	return error;
};
/**
* Merges two `Context`s into one.
*
* **When to use**
*
* Use when you need to combine two contexts.
*
* **Details**
*
* When both contexts contain the same service key, the service from `that`
* overrides the service from `self`.
*
* **Example** (Merging two contexts)
*
* ```ts import.meta.vitest
* import { Context } from "effect"
*
* const Port = Context.Service<{ PORT: number }>("Port")
* const Timeout = Context.Service<{ TIMEOUT: number }>("Timeout")
*
* const firstContext = Context.make(Port, { PORT: 8080 })
* const secondContext = Context.make(Timeout, { TIMEOUT: 5000 })
*
* const context = Context.merge(firstContext, secondContext)
*
* const values = [Context.get(context, Port).PORT, Context.get(context, Timeout).TIMEOUT]
* values // => [8080, 5000]
* ```
*
* @see {@link mergeAll} for merging more than two contexts at once
*
* @stability stable
* @category combining
* @since 2.0.0
*/
var merge = /*#__PURE__*/ dual(2, (self, that) => {
	if (self.mapUnsafe.size === 0) return that;
	if (that.mapUnsafe.size === 0) return self;
	return withFlat(self, (map) => that.mapUnsafe.forEach((value, key) => map.set(key, value)));
});
/**
* Merges any number of `Context`s into one.
*
* **When to use**
*
* Use when you need to combine a variadic list of contexts.
*
* **Details**
*
* When multiple contexts contain the same service key, the service from the
* last context with that key is kept.
*
* **Example** (Merging multiple contexts)
*
* ```ts import.meta.vitest
* import { Context } from "effect"
*
* const Port = Context.Service<{ PORT: number }>("Port")
* const Timeout = Context.Service<{ TIMEOUT: number }>("Timeout")
* const Host = Context.Service<{ HOST: string }>("Host")
*
* const firstContext = Context.make(Port, { PORT: 8080 })
* const secondContext = Context.make(Timeout, { TIMEOUT: 5000 })
* const thirdContext = Context.make(Host, { HOST: "localhost" })
*
* const context = Context.mergeAll(
*   firstContext,
*   secondContext,
*   thirdContext
* )
*
* context.mapUnsafe.size // => 3
* ```
*
* @see {@link merge} for merging two contexts
*
* @stability stable
* @category combining
* @since 3.12.0
*/
var mergeAll = (...ctxs) => {
	const map = /* @__PURE__ */ new Map();
	for (let i = 0; i < ctxs.length; i++) ctxs[i].mapUnsafe.forEach((value, key) => {
		map.set(key, value);
	});
	return makeUnsafe$4(map);
};
/**
* Creates a context key with a default value.
*
* **When to use**
*
* Use when you need to define a context key with a lazily computed default
* value.
*
* **Details**
*
* `Context.Reference` allows you to create a key that can hold a value. You
* can provide a default value for the service, which will automatically be used
* when the context is accessed, or override it with a custom implementation
* when needed. The default value is computed lazily and cached on the
* reference.
*
* **Example** (Creating references with default values)
*
* ```ts import.meta.vitest
* import { Context } from "effect"
*
* // Create a reference with a default value
* const messages: Array<string> = []
* const LoggerRef = Context.Reference("Logger", {
*   defaultValue: () => ({ log: (msg: string) => messages.push(`Default: ${msg}`) })
* })
*
* // The reference provides the default value when accessed from an empty context
* const context = Context.empty()
* const logger = Context.get(context, LoggerRef)
*
* // You can also override the default value
* const customContext = Context.make(LoggerRef, {
*   log: (msg: string) => messages.push(`Custom: ${msg}`)
* })
* const customLogger = Context.get(customContext, LoggerRef)
* logger.log("default")
* customLogger.log("message")
* messages // => ["Default: default", "Custom: message"]
* ```
*
* @see {@link Service} for required services without default values
*
* @stability stable
* @category services
* @since 3.11.0
*/
var Reference = Service$1;
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Duration.js
var TypeId$21 = "~effect/Duration";
var bigint0 = /*#__PURE__*/ BigInt(0);
var bigint1 = /*#__PURE__*/ BigInt(1);
var bigint2 = /*#__PURE__*/ BigInt(2);
var bigint10 = /*#__PURE__*/ BigInt(10);
var bigint1e3 = /*#__PURE__*/ BigInt(1e3);
var bigint1e6 = /*#__PURE__*/ BigInt(1e6);
var bigint1e9 = /*#__PURE__*/ BigInt(1e9);
var bigintNanosPerMinute = /*#__PURE__*/ BigInt(6e10);
var bigintNanosPerHour = /*#__PURE__*/ BigInt(36e11);
var bigintNanosPerDay = /*#__PURE__*/ BigInt(864e11);
var bigintNanosPerWeek = /*#__PURE__*/ BigInt(6048e11);
var roundTiesAwayFromZero = (input) => BigInt(Math.sign(input) * Math.round(Math.abs(input)));
var roundMillisToNanos = (millis) => Number.isInteger(millis) ? BigInt(millis) * bigint1e6 : roundTiesAwayFromZero(millis * 1e6);
var fromNanosNumber = (nanos) => make$10(Number.isFinite(nanos) ? roundTiesAwayFromZero(nanos) : nanos);
var parseNanos = (input, scale) => {
	const decimalIndex = input.indexOf(".");
	if (decimalIndex === -1) return BigInt(input) * scale;
	const isNegative = input[0] === "-";
	const fractional = input.slice(decimalIndex + 1);
	const fractionalScale = bigint10 ** BigInt(fractional.length);
	const scaled = (BigInt(input.slice(isNegative ? 1 : 0, decimalIndex)) * fractionalScale + BigInt(fractional)) * scale;
	return divideTiesAwayFromZero(isNegative ? -scaled : scaled, fractionalScale);
};
var divideTiesAwayFromZero = (numerator, denominator) => {
	const absolute = numerator < bigint0 ? -numerator : numerator;
	const rounded = absolute / denominator + (absolute % denominator * bigint2 >= denominator ? bigint1 : bigint0);
	return numerator < bigint0 ? -rounded : rounded;
};
var fromMillisString = (input, scale) => {
	const millis = Number(input) * scale;
	if (!Number.isFinite(millis)) return make$10(millis);
	const nanos = parseNanos(input, BigInt(scale) * bigint1e6);
	return make$10(Number.isInteger(millis) && BigInt(millis) * bigint1e6 === nanos ? millis : nanos);
};
var DURATION_REGEXP = /^(-?\d+(?:\.\d+)?)\s+(nanos?|micros?|millis?|seconds?|minutes?|hours?|days?|weeks?)$/;
/**
* Decodes a `Duration.Input` into a `Duration`.
*
* **When to use**
*
* Use when the input has already been validated or comes from a trusted source
* and throwing is acceptable for invalid duration syntax.
*
* **Gotchas**
*
* If the input is not a valid `Duration.Input`, it throws an error.
*
* **Example** (Decoding duration inputs)
*
* ```ts import.meta.vitest
* import { Duration } from "effect"
*
* Duration.fromInputUnsafe(1000) // => Duration.millis(1000)
* Duration.fromInputUnsafe("5 seconds") // => Duration.seconds(5)
* Duration.fromInputUnsafe("Infinity") // => Duration.infinity
* Duration.fromInputUnsafe([2, 500_000_000]) // => Duration.nanos(2_500_000_000n)
* ```
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var fromInputUnsafe = (input) => {
	switch (typeof input) {
		case "number": return millis(input);
		case "bigint": return nanos(input);
		case "string": {
			if (input === "Infinity") return infinity;
			if (input === "-Infinity") return negativeInfinity;
			const match = DURATION_REGEXP.exec(input);
			if (!match) break;
			const [_, valueStr, unit] = match;
			if (unit === "nano" || unit === "nanos") return nanos(parseNanos(valueStr, bigint1));
			if (unit === "micro" || unit === "micros") return nanos(parseNanos(valueStr, bigint1e3));
			switch (unit) {
				case "milli":
				case "millis": return fromMillisString(valueStr, 1);
				case "second":
				case "seconds": return fromMillisString(valueStr, 1e3);
				case "minute":
				case "minutes": return fromMillisString(valueStr, 6e4);
				case "hour":
				case "hours": return fromMillisString(valueStr, 36e5);
				case "day":
				case "days": return fromMillisString(valueStr, 864e5);
				case "week":
				case "weeks": return fromMillisString(valueStr, 6048e5);
			}
			break;
		}
		case "object": {
			if (input === null) break;
			if (TypeId$21 in input) return input;
			if (Array.isArray(input)) {
				if (input.length !== 2 || !input.every(isNumber)) return invalid$1(input);
				if (Number.isNaN(input[0]) || Number.isNaN(input[1])) return zero;
				if (input[0] === -Infinity || input[1] === -Infinity) return negativeInfinity;
				if (input[0] === Infinity || input[1] === Infinity) return infinity;
				const nanos = input[0] * 1e9 + input[1];
				return Number.isFinite(nanos) && Number.isInteger(input[0]) && Number.isInteger(input[1]) ? make$10(BigInt(input[0]) * bigint1e9 + BigInt(input[1])) : fromNanosNumber(nanos);
			}
			const obj = input;
			let millis = 0;
			if (obj.weeks) millis += obj.weeks * 6048e5;
			if (obj.days) millis += obj.days * 864e5;
			if (obj.hours) millis += obj.hours * 36e5;
			if (obj.minutes) millis += obj.minutes * 6e4;
			if (obj.seconds) millis += obj.seconds * 1e3;
			if (obj.milliseconds) millis += obj.milliseconds;
			if (!obj.microseconds && !obj.nanoseconds) {
				if (!Number.isFinite(millis)) return make$10(millis);
				const exact = sumObjectNanos(obj);
				return exact === void 0 || BigInt(millis) * bigint1e6 === exact ? make$10(millis) : make$10(exact);
			}
			const nanos = millis * 1e6 + (obj.microseconds ?? 0) * 1e3 + (obj.nanoseconds ?? 0);
			const exact = Number.isFinite(nanos) ? sumObjectNanos(obj) : void 0;
			return exact === void 0 ? fromNanosNumber(nanos) : make$10(exact);
		}
	}
	return invalid$1(input);
};
var isIntegerOrUnset = (n) => !n || Number.isInteger(n);
var sumObjectNanos = (obj) => {
	if (!isIntegerOrUnset(obj.weeks) || !isIntegerOrUnset(obj.days) || !isIntegerOrUnset(obj.hours) || !isIntegerOrUnset(obj.minutes) || !isIntegerOrUnset(obj.seconds) || !isIntegerOrUnset(obj.milliseconds) || !isIntegerOrUnset(obj.microseconds) || !isIntegerOrUnset(obj.nanoseconds)) return void 0;
	let nanos = bigint0;
	if (obj.weeks) nanos += BigInt(obj.weeks) * bigintNanosPerWeek;
	if (obj.days) nanos += BigInt(obj.days) * bigintNanosPerDay;
	if (obj.hours) nanos += BigInt(obj.hours) * bigintNanosPerHour;
	if (obj.minutes) nanos += BigInt(obj.minutes) * bigintNanosPerMinute;
	if (obj.seconds) nanos += BigInt(obj.seconds) * bigint1e9;
	if (obj.milliseconds) nanos += BigInt(obj.milliseconds) * bigint1e6;
	if (obj.microseconds) nanos += BigInt(obj.microseconds) * bigint1e3;
	if (obj.nanoseconds) nanos += BigInt(obj.nanoseconds);
	return nanos;
};
var invalid$1 = (input) => {
	throw new Error(`Invalid Input: ${input}`);
};
var zeroDurationValue = {
	_tag: "Millis",
	millis: 0
};
var infinityDurationValue = { _tag: "Infinity" };
var negativeInfinityDurationValue = { _tag: "NegativeInfinity" };
var DurationProto = {
	[TypeId$21]: TypeId$21,
	[symbol$1]() {
		switch (this.value._tag) {
			case "Millis": return hash(roundMillisToNanos(this.value.millis));
			case "Nanos": return hash(this.value.nanos);
			default: return structure(this.value);
		}
	},
	[symbol](that) {
		return isDuration(that) && equals(this, that);
	},
	toString() {
		switch (this.value._tag) {
			case "Infinity": return "Infinity";
			case "NegativeInfinity": return "-Infinity";
			case "Nanos": return `${this.value.nanos} nanos`;
			case "Millis": return `${this.value.millis} millis`;
		}
	},
	toJSON() {
		switch (this.value._tag) {
			case "Millis": return {
				_id: "Duration",
				_tag: "Millis",
				millis: this.value.millis
			};
			case "Nanos": return {
				_id: "Duration",
				_tag: "Nanos",
				nanos: String(this.value.nanos)
			};
			case "Infinity": return {
				_id: "Duration",
				_tag: "Infinity"
			};
			case "NegativeInfinity": return {
				_id: "Duration",
				_tag: "NegativeInfinity"
			};
		}
	},
	[NodeInspectSymbol]() {
		return this.toJSON();
	},
	pipe() {
		return pipeArguments(this, arguments);
	}
};
var make$10 = (input) => {
	const duration = Object.create(DurationProto);
	if (typeof input === "number") {
		if (isNaN(input) || input === 0 || Object.is(input, -0)) duration.value = zeroDurationValue;
		else if (!Number.isFinite(input)) duration.value = input > 0 ? infinityDurationValue : negativeInfinityDurationValue;
		else if (!Number.isInteger(input)) duration.value = {
			_tag: "Nanos",
			nanos: roundMillisToNanos(input)
		};
		else duration.value = {
			_tag: "Millis",
			millis: input
		};
	} else if (input === bigint0) duration.value = zeroDurationValue;
	else duration.value = {
		_tag: "Nanos",
		nanos: input
	};
	return duration;
};
/**
* Checks whether a value is a Duration.
*
* **Example** (Checking for durations)
*
* ```ts import.meta.vitest
* import { Duration } from "effect"
*
* Duration.isDuration(Duration.seconds(1)) // => true
* Duration.isDuration(1000) // => false
* ```
*
* @stability stable
* @category guards
* @since 2.0.0
*/
var isDuration = (u) => hasProperty(u, TypeId$21);
/**
* A Duration representing zero time.
*
* **Example** (Referencing the zero duration)
*
* ```ts import.meta.vitest
* import { Duration } from "effect"
*
* Duration.toMillis(Duration.zero) // => 0
* ```
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var zero = /*#__PURE__*/ make$10(0);
/**
* A Duration representing infinite time.
*
* **Example** (Referencing infinite duration)
*
* ```ts import.meta.vitest
* import { Duration } from "effect"
*
* Duration.toMillis(Duration.infinity) // => Infinity
* ```
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var infinity = /*#__PURE__*/ make$10(Infinity);
/**
* A Duration representing negative infinite time.
*
* **Example** (Referencing negative infinite duration)
*
* ```ts import.meta.vitest
* import { Duration } from "effect"
*
* Duration.toMillis(Duration.negativeInfinity) // => -Infinity
* ```
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var negativeInfinity = /*#__PURE__*/ make$10(-Infinity);
/**
* Creates a Duration from nanoseconds.
*
* **Example** (Creating durations from nanoseconds)
*
* ```ts import.meta.vitest
* import { Duration } from "effect"
*
* Duration.nanos(500_000_000n) // => Duration.nanos(500_000_000n)
* ```
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var nanos = (nanos) => make$10(nanos);
/**
* Creates a Duration from milliseconds.
*
* **Example** (Creating durations from milliseconds)
*
* ```ts import.meta.vitest
* import { Duration } from "effect"
*
* Duration.toMillis(Duration.millis(1000)) // => 1000
* ```
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var millis = (millis) => make$10(millis);
/**
* Gets the duration in nanoseconds as a bigint.
*
* **When to use**
*
* Use when the duration is known to be finite and you need the nanosecond value
* as a `bigint`.
*
* **Details**
*
* Millisecond-backed fractional durations are rounded to the nearest
* nanosecond, with ties away from zero.
*
* **Gotchas**
*
* If the duration is infinite, it throws an error.
*
* **Example** (Reading nanoseconds unsafely)
*
* ```ts import.meta.vitest
* import { Duration } from "effect"
*
* Duration.toNanosUnsafe(Duration.seconds(2)) // => 2_000_000_000n
*
* // Duration.toNanosUnsafe(Duration.infinity)
* // throws Error: "Cannot convert infinite duration to nanos"
* ```
*
* @stability stable
* @category getters
* @since 4.0.0
*/
var toNanosUnsafe = (input) => {
	const self = fromInputUnsafe(input);
	switch (self.value._tag) {
		case "Infinity":
		case "NegativeInfinity": throw new Error("Cannot convert infinite duration to nanos");
		case "Nanos": return self.value.nanos;
		case "Millis": return roundMillisToNanos(self.value.millis);
	}
};
/**
* Pattern matches on two `Duration`s, providing handlers that receive both values.
*
* **Example** (Pattern matching on duration pairs)
*
* ```ts import.meta.vitest
* import { Duration } from "effect"
*
* Duration.matchPair(Duration.seconds(3), Duration.seconds(2), {
*   onMillis: (a, b) => a + b,
*   onNanos: (a, b) => Number(a + b),
*   onInfinity: () => Infinity
* }) // => 5000
* ```
*
* @stability stable
* @category pattern matching
* @since 4.0.0
*/
var matchPair = /*#__PURE__*/ dual(3, (self, that, options) => {
	if (self.value._tag === "Infinity" || self.value._tag === "NegativeInfinity" || that.value._tag === "Infinity" || that.value._tag === "NegativeInfinity") return options.onInfinity(self, that);
	if (self.value._tag === "Millis") return that.value._tag === "Millis" ? options.onMillis(self.value.millis, that.value.millis) : options.onNanos(toNanosUnsafe(self), that.value.nanos);
	else return options.onNanos(self.value.nanos, toNanosUnsafe(that));
});
/**
* Provides an `Equivalence` instance for comparing `Duration` values.
*
* **Example** (Comparing durations for equivalence)
*
* ```ts import.meta.vitest
* import { Duration } from "effect"
*
* Duration.Equivalence(Duration.seconds(5), Duration.millis(5000)) // => true
* ```
*
* @stability stable
* @category instances
* @since 2.0.0
*/
var Equivalence$3 = (self, that) => matchPair(self, that, {
	onMillis: (self, that) => self === that,
	onNanos: (self, that) => self === that,
	onInfinity: (self, that) => self.value._tag === that.value._tag
});
/**
* Checks whether two Durations are equal.
*
* **Example** (Checking duration equality)
*
* ```ts import.meta.vitest
* import { Duration } from "effect"
*
* Duration.equals(Duration.seconds(5), Duration.millis(5000)) // => true
* ```
*
* @stability stable
* @category predicates
* @since 2.0.0
*/
var equals = /*#__PURE__*/ dual(2, (self, that) => Equivalence$3(self, that));
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Scheduler.js
/**
* Controls how runnable Effect fiber tasks are dispatched.
*
* A scheduler decides how tasks are queued, when queued tasks run, and when a
* fiber should pause so other work can continue. This module includes the
* scheduler service reference, the default `MixedScheduler`, dispatcher types
* for queued tasks, and references for tuning or disabling automatic scheduler
* yields.
*
* @stability stable
* @since 2.0.0
*/
/**
* Context reference for the scheduler used by the Effect runtime.
*
* **When to use**
*
* Use when you need to replace scheduling behavior globally in tests or runtime
* setup, such as forcing deterministic task dispatch.
*
* **Details**
*
* The default value creates a `MixedScheduler`. Provide this service to
* customize execution mode, task dispatching, or yield behavior.
*
* @stability stable
* @category services
* @since 2.0.0
*/
var Scheduler = /*#__PURE__*/ Reference("effect/Scheduler", {
	fiberCached: true,
	defaultValue: () => new MixedScheduler()
});
var setMicrotask = (f) => {
	let cancelled = false;
	Promise.resolve().then(() => {
		if (!cancelled) f();
	});
	return () => {
		cancelled = true;
	};
};
var setTimer = "setImmediate" in globalThis ? (f) => {
	const timer = globalThis.setImmediate(f);
	return () => globalThis.clearImmediate(timer);
} : (f) => {
	const timer = setTimeout(f, 0);
	return () => clearTimeout(timer);
};
var setImmediate = (f) => {
	try {
		return setTimer(f);
	} catch {
		return setMicrotask(f);
	}
};
var PriorityBuckets = class {
	buckets = [];
	scheduleTask(task, priority) {
		const buckets = this.buckets;
		const len = buckets.length;
		let bucket;
		let index = 0;
		for (; index < len; index++) {
			if (buckets[index][0] > priority) break;
			bucket = buckets[index];
		}
		if (bucket && bucket[0] === priority) bucket[1].push(task);
		else if (index === len) buckets.push([priority, [task]]);
		else buckets.splice(index, 0, [priority, [task]]);
	}
	drain() {
		const buckets = this.buckets;
		this.buckets = [];
		return buckets;
	}
};
/**
* Provides a scheduler implementation that batches queued tasks and dispatches them by
* priority.
*
* **When to use**
*
* Use when you need the default runtime scheduler directly, including a
* scheduler that batches queued work by priority and preserves FIFO order within
* each priority.
*
* **Details**
*
* `MixedScheduler` supports synchronous and asynchronous execution modes, uses
* operation counts to decide when fibers should yield, and is the default
* scheduler implementation.
*
* **Gotchas**
*
* On Cloudflare Workers, request-owned scheduler timers can be discarded,
* leaving shared fibers suspended. Use `new MixedScheduler("sync")` for the
* whole application; see `HttpRouter.toWebHandler` for a recipe.
* Sync mode does not yield to the event loop: CPU-heavy work delays other
* requests, and I/O-polling loops can exhaust the CPU limit. It does not fix
* request-owned timers (such as `Effect.sleep`) or request-bound async contexts.
*
* @stability stable
* @category models
* @since 2.0.0
*/
var MixedScheduler = class {
	executionMode;
	setImmediate;
	constructor(executionMode = "async", setImmediateFn) {
		this.executionMode = executionMode;
		this.setImmediate = setImmediateFn ?? (executionMode === "sync" ? setMicrotask : setImmediate);
	}
	/**
	* Returns whether the fiber has reached its operation budget and should yield.
	*
	* **When to use**
	*
	* Use to decide whether a fiber should yield after consuming its current
	* operation budget.
	*
	* @since 2.0.0
	*/
	shouldYield(fiber) {
		return fiber.currentOpCount >= fiber.cache.maxOpsBeforeYield;
	}
	/**
	* Creates a dispatcher that schedules work through this scheduler.
	*
	* **When to use**
	*
	* Use when you need a standalone dispatcher from a scheduler instance, for
	* example in tests that enqueue tasks and then flush them deterministically.
	*
	* @since 4.0.0
	*/
	makeDispatcher() {
		return new MixedSchedulerDispatcher(this.setImmediate);
	}
};
var MixedSchedulerDispatcher = class {
	tasks = /*#__PURE__*/ new PriorityBuckets();
	running = void 0;
	setImmediate;
	constructor(setImmediateFn = setImmediate) {
		this.setImmediate = setImmediateFn;
	}
	/**
	* @since 2.0.0
	*/
	scheduleTask(task, priority) {
		this.tasks.scheduleTask(task, priority);
		if (this.running === void 0) this.running = this.setImmediate(this.afterScheduled);
	}
	/**
	* @since 2.0.0
	*/
	afterScheduled = () => {
		this.running = void 0;
		this.runTasks();
	};
	/**
	* @since 2.0.0
	*/
	runTasks() {
		const buckets = this.tasks.drain();
		for (let i = 0; i < buckets.length; i++) {
			const toRun = buckets[i][1];
			for (let j = 0; j < toRun.length; j++) toRun[j]();
		}
	}
	/**
	* @since 2.0.0
	*/
	flush() {
		while (this.tasks.buckets.length > 0) {
			if (this.running !== void 0) {
				this.running();
				this.running = void 0;
			}
			this.runTasks();
		}
	}
};
/**
* Context reference that controls the maximum number of operations a fiber
* can perform before yielding control back to the scheduler.
*
* **When to use**
*
* Use to tune scheduler fairness for CPU-bound fibers by changing the scheduler
* operation budget that triggers a yield.
*
* **Details**
*
* The default value is `2048` operations, which balances performance and
* fairness by helping prevent long-running fibers from monopolizing the
* execution thread.
*
* @see {@link PreventSchedulerYield} for bypassing scheduler yield checks entirely rather than tuning the operation budget
*
* @stability stable
* @category services
* @since 4.0.0
*/
var MaxOpsBeforeYield = /*#__PURE__*/ Reference("effect/Scheduler/MaxOpsBeforeYield", {
	fiberCached: true,
	defaultValue: () => 2048
});
/**
* Context reference that controls whether the runtime should bypass scheduler
* yield checks. When set to `true`, the fiber run loop won't call
* `Scheduler.shouldYield`.
*
* **When to use**
*
* Use to bypass scheduler yield checks for controlled runtime workloads where
* cooperative yielding should be disabled.
*
* **Gotchas**
*
* Setting this reference to `true` can let long-running fibers monopolize the
* JavaScript thread.
*
* @see {@link MaxOpsBeforeYield} for tuning yield frequency without disabling yield checks
* @see {@link Scheduler} for providing custom scheduler yield behavior
*
* @stability stable
* @category services
* @since 4.0.0
*/
var PreventSchedulerYield = /*#__PURE__*/ Reference("effect/Scheduler/PreventSchedulerYield", {
	fiberCached: true,
	defaultValue: () => false
});
/**
* Creates constructors and matchers for a `TaggedEnum` type.
*
* **When to use**
*
* Use when you model a closed union with plain data objects and want
* construction, tag checks, and exhaustive matching from the same definition.
*
* **Details**
*
* Returns an object with:
* - One constructor per variant (keyed by tag name)
* - `$is(tag)` — returns a type-guard function that checks only the `_tag` field
* - `$match` — exhaustive pattern matching (data-first or data-last)
*
* **Gotchas**
*
* - Constructors produce **plain objects**, not class instances.
* - `$is(tag)` only checks the `_tag` field, not the full structure. It relies
*   on the tag being globally unique and the value being produced by your
*   constructors. For untrusted input, validate with the `Schema` module first.
*
* **Example** (Creating and matching tagged enum values)
*
* ```ts import.meta.vitest
* import { Data } from "effect"
*
* type HttpError = Data.TaggedEnum<{
*   BadRequest: { readonly message: string }
*   NotFound: { readonly url: string }
* }>
*
* const { BadRequest, NotFound, $is, $match } = Data.taggedEnum<HttpError>()
*
* const err = NotFound({ url: "/missing" })
*
* $is("NotFound")(err) // => true
*
* $match(err, {
*   BadRequest: (e) => e.message,
*   NotFound: (e) => `${e.url} not found`
* }) // => "/missing not found"
* ```
*
* **Example** (Defining a generic tagged enum)
*
* ```ts import.meta.vitest
* import { Data } from "effect"
*
* type MyResult<E, A> = Data.TaggedEnum<{
*   Failure: { readonly error: E }
*   Success: { readonly value: A }
* }>
* interface MyResultDef extends Data.TaggedEnum.WithGenerics<2> {
*   readonly taggedEnum: MyResult<this["A"], this["B"]>
* }
* const { Failure, Success } = Data.taggedEnum<MyResultDef>()
*
* const ok = Success({ value: 42 })
* // ok: { readonly _tag: "Success"; readonly value: number }
* ok // => { value: 42, _tag: "Success" }
* ```
*
* @see {@link TaggedEnum} — the type-level companion
* @see {@link TaggedEnum.Constructor} — the returned object type
* @see {@link TaggedEnum.WithGenerics} — generic enum support
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var taggedEnum = () => new Proxy({}, { get(_target, tag, _receiver) {
	if (tag === "$is") return isTagged;
	else if (tag === "$match") return taggedMatch;
	return (props) => ({
		...props,
		_tag: tag
	});
} });
function taggedMatch() {
	if (arguments.length === 1) {
		const cases = arguments[0];
		return function(value) {
			return cases[value._tag](value);
		};
	}
	const value = arguments[0];
	return arguments[1][value._tag](value);
}
/**
* Creates a tagged error class with a `_tag` discriminator.
*
* **When to use**
*
* Use when you need domain errors with discriminated-union handling.
*
* **Details**
*
* Like {@link Error}, but instances also carry a `readonly _tag` property,
* enabling `Effect.catchTag` and `Effect.catchTags` for tag-based recovery.
* The `_tag` is excluded from the constructor argument. Yielding an instance
* inside `Effect.gen` fails the effect with this error.
*
* **Example** (Recovering by tag)
*
* ```ts import.meta.vitest
* import { Data, Effect } from "effect"
*
* class NotFound extends Data.TaggedError("NotFound")<{
*   readonly resource: string
* }> {}
*
* class Forbidden extends Data.TaggedError("Forbidden")<{
*   readonly reason: string
* }> {}
*
* const program = Effect.gen(function*() {
*   return yield* new NotFound({ resource: "/users/42" })
* })
*
* const recovered = program.pipe(
*   Effect.catchTag("NotFound", (e) =>
*     Effect.succeed(`missing: ${e.resource}`))
* )
*
* await Effect.runPromise(recovered) // => "missing: /users/42"
* ```
*
* @see {@link Error} — without a `_tag`
* @see {@link TaggedClass} — tagged class that is not an error
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var TaggedError$1 = TaggedError$2;
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/encoding/EncodingError.js
/**
* Shared error type for encoding and decoding operations.
*
* @stability stable
* @since 4.0.0
*/
/**
* Type identifier stored on `EncodingError` values and used by
* `isEncodingError`.
*
* **When to use**
*
* Use when implementing low-level `EncodingError`-compatible values that need
* to carry the runtime marker.
*
* **Details**
*
* This marker is part of the runtime representation of `EncodingError`. Prefer
* `isEncodingError` when narrowing unknown values.
*
* @see {@link isEncodingError} for the public guard that checks this marker
*
* @stability stable
* @category type IDs
* @since 4.0.0
*/
var EncodingErrorTypeId = "~effect/encoding/EncodingError";
/**
* Error returned when an encoding or decoding operation cannot process its input.
*
* **When to use**
*
* Use when you need to handle or inspect failures from encoding or decoding
* operations.
*
* **Details**
*
* The error records whether the failure happened during encoding or decoding,
* which encoding module reported it, the original input, and a human-readable
* message.
*
* @see {@link isEncodingError} for checking whether a value is an EncodingError
*
* @stability stable
* @category errors
* @since 4.0.0
*/
var EncodingError = class extends (/*#__PURE__*/ TaggedError$1("EncodingError")) {
	/**
	* Marks this value as an encoding or decoding error for runtime guards.
	*
	* **When to use**
	*
	* Use to identify `EncodingError` instances through `isEncodingError`.
	*
	* @since 4.0.0
	*/
	[EncodingErrorTypeId] = EncodingErrorTypeId;
};
var hexCodes = /*#__PURE__*/ (/* @__PURE__ */ new Uint8Array(256)).fill(255);
for (let i = 0; i < 16; i++) {
	hexCodes[/*#__PURE__*/ "0123456789abcdef".charCodeAt(i)] = i;
	hexCodes[/*#__PURE__*/ "0123456789ABCDEF".charCodeAt(i)] = i;
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Tracer.js
/**
* Defines the string key for the parent-span context service.
*
* **When to use**
*
* Use when you need the raw context key for parent span lookup in lower-level
* tracing code.
*
* **Example** (Reading the parent span key)
*
* ```ts import.meta.vitest
* import { Tracer } from "effect"
*
* // The key used to identify parent spans in the context
* Tracer.ParentSpanKey // => "effect/Tracer/ParentSpan"
* ```
*
* @stability stable
* @category constants
* @since 4.0.0
*/
var ParentSpanKey = "effect/Tracer/ParentSpan";
/**
* Defines the string key for the active tracer context reference.
*
* **When to use**
*
* Use when you need the raw context key for active tracer lookup in lower-level
* tracing code.
*
* @stability stable
* @category constants
* @since 4.0.0
*/
var TracerKey = "effect/Tracer";
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/metric.js
/** @internal */
var FiberRuntimeMetricsKey = "effect/Metric/FiberRuntimeMetrics";
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/references.js
/** @internal */
var CurrentStackFrame = /*#__PURE__*/ Reference("effect/References/CurrentStackFrame", {
	fiberCached: true,
	defaultValue: constUndefined
});
/** @internal */
var TracerEnabled = /*#__PURE__*/ Reference("effect/References/TracerEnabled", {
	fiberCached: true,
	defaultValue: constTrue
});
/** @internal */
var CurrentLogLevel = /*#__PURE__*/ Reference("effect/References/CurrentLogLevel", {
	fiberCached: true,
	defaultValue: () => "Info"
});
/** @internal */
var MinimumLogLevel = /*#__PURE__*/ Reference("effect/References/MinimumLogLevel", {
	fiberCached: true,
	defaultValue: () => "Info"
});
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/effect.js
/** @internal */
var Interrupt = class extends ReasonBase {
	constructor(fiberId, annotations = constEmptyAnnotations) {
		super("Interrupt", annotations, "Interrupted");
		this.fiberId = fiberId;
	}
	toString() {
		return `Interrupt(${this.fiberId})`;
	}
	toJSON() {
		return {
			_tag: "Interrupt",
			fiberId: this.fiberId
		};
	}
	[symbol](that) {
		return isInterruptReason(that) && this.fiberId === that.fiberId && this.annotations === that.annotations;
	}
	[symbol$1]() {
		return string$1(`${this._tag}:${this.fiberId}`);
	}
};
/** @internal */
var causeInterrupt = (fiberId) => new CauseImpl([new Interrupt(fiberId)]);
/** @internal */
var hasFails = (self) => self.reasons.some(isFailReason$1);
/** @internal */
var hasDies = (self) => self.reasons.some(isDieReason);
/**
* Defects take precedence over typed failures when causes are combined: if
* the cause contains a `Die`, every `Fail` becomes a `Die`. `Done` signals
* stay typed so pulls still complete.
*
* @internal
*/
var causeElectDefects = (self) => hasDies(self) && hasFails(self) ? causeFromReasons(self.reasons.map((reason) => reason._tag === "Fail" && !isDone(reason.error) ? new Die(reason.error, reason.annotations) : reason)) : self;
/** @internal */
var hasInterrupts = (self) => self.reasons.some(isInterruptReason);
/** @internal */
var causeMap = /*#__PURE__*/ dual(2, (self, f) => {
	let hasFail = false;
	const failures = self.reasons.map((failure) => {
		if (isFailReason$1(failure)) {
			hasFail = true;
			return new Fail(f(failure.error), failure.annotations);
		}
		return failure;
	});
	return hasFail ? causeFromReasons(failures) : self;
});
/** @internal */
var FiberTypeId = "~effect/Fiber";
var fiberVariance = {
	_A: identity,
	_E: identity
};
var fiberIdStore = { id: 0 };
var AsyncResource = /*#__PURE__*/ (() => {
	try {
		return globalThis.process?.getBuiltinModule?.("node:async_hooks")?.AsyncResource;
	} catch {
		return;
	}
})();
var captureAsyncContext = () => AsyncResource === void 0 ? void 0 : new AsyncResource("effect/Fiber");
/** @internal */
var getCurrentFiber = () => globalThis[currentFiberTypeId];
/** @internal */
var FiberImpl = class {
	constructor(context, interruptible = true) {
		this.setContext(context);
		this.id = ++fiberIdStore.id;
		this.currentOpCount = 0;
		this.interruptible = interruptible;
		this._stack = [];
		this._observers = void 0;
		this._exit = void 0;
		this._children = void 0;
		this._interruptedCause = void 0;
		this._yielded = void 0;
		this._autoYielded = false;
		this._running = false;
		this._deferredInterrupt = false;
		this._parent = void 0;
		this._asyncContext = void 0;
		this.cache.runtimeMetrics?.recordFiberStart(this.context);
	}
	get [FiberTypeId]() {
		return fiberVariance;
	}
	get currentDispatcher() {
		return this._dispatcher ??= this.cache.scheduler.makeDispatcher();
	}
	getRef(ref) {
		return get$1(this.context, ref);
	}
	addObserver(cb) {
		if (this._exit) {
			cb(this._exit);
			return constVoid;
		}
		if (this._observers === void 0) this._observers = [cb];
		else this._observers.push(cb);
		return () => this.removeObserver(cb);
	}
	removeObserver(cb) {
		if (this._exit || this._observers === void 0) return;
		const index = this._observers.indexOf(cb);
		if (index >= 0) this._observers.splice(index, 1);
	}
	interruptUnsafe(fiberId, annotations) {
		if (this._exit) return;
		let cause = causeInterrupt(fiberId);
		if (this.cache.stackFrame) cause = causeAnnotate(cause, make$11(StackTraceKey, this.cache.stackFrame));
		if (annotations) cause = causeAnnotate(cause, annotations);
		this._interruptedCause = this._interruptedCause ? causeAddInterrupts(this._interruptedCause, cause) : cause;
		if (this.interruptible) {
			if (this._running) this._deferredInterrupt = true;
			else this.evaluate(failCause$1(this._interruptedCause));
		}
	}
	pollUnsafe() {
		return this._exit;
	}
	evaluate(effect) {
		if (this._exit) return;
		else if (this._asyncContext !== void 0) {
			const asyncContext = this._asyncContext;
			this._asyncContext = void 0;
			try {
				return asyncContext.runInAsyncScope(this.evaluate, this, effect);
			} finally {
				asyncContext.emitDestroy();
			}
		} else if (this._yielded !== void 0) {
			const yielded = this._yielded;
			this._yielded = void 0;
			yielded();
		}
		const exit = this.runLoop(effect);
		if (exit === Yield) {
			this._asyncContext = captureAsyncContext();
			return;
		}
		const interruptChildren = fiberMiddleware.interruptChildren && fiberMiddleware.interruptChildren(this);
		if (interruptChildren !== void 0) return this.evaluate(flatMap$1(interruptChildren, () => exit));
		this._exit = exit;
		this.cache.runtimeMetrics?.recordFiberEnd(this.context, this._exit);
		if (this._parent) {
			this._parent._children?.delete(this);
			this._parent = void 0;
		}
		if (this._observers !== void 0) {
			const observers = this._observers;
			this._observers = void 0;
			for (let i = 0; i < observers.length; i++) observers[i](exit);
		}
		this._stack.length = 0;
		this._children = void 0;
		this.context = empty();
		const cache = this.cache;
		if (cache.span !== void 0 || cache.stackFrame !== void 0) this.cache = {
			...cache,
			span: void 0,
			stackFrame: void 0
		};
	}
	runLoop(effect) {
		const prevFiber = globalThis[currentFiberTypeId];
		globalThis[currentFiberTypeId] = this;
		const prevRunning = this._running;
		this._running = true;
		let yielding = false;
		let resuming = this._autoYielded;
		this._autoYielded = false;
		let current = effect;
		this.currentOpCount = resuming ? 1 : 0;
		try {
			while (true) try {
				if (this._deferredInterrupt) {
					this._deferredInterrupt = false;
					current = failCause$1(this._interruptedCause);
				}
				this.currentOpCount++;
				const cache = this.cache;
				if (!resuming && !yielding && !cache.preventYield && cache.scheduler.shouldYield(this)) {
					yielding = true;
					current = this.yieldNow(current, 0, true);
				} else {
					resuming = false;
					current = cache.tracerContext ? cache.tracerContext(current, this) : current[evaluate](this);
				}
				if (current === Yield) {
					const yielded = this._yielded;
					if ("~effect/Exit" in yielded) {
						this._deferredInterrupt = false;
						this._yielded = void 0;
						return yielded;
					} else if (this._deferredInterrupt) {
						this._yielded = void 0;
						yielded();
						continue;
					}
					return Yield;
				}
			} catch (error) {
				if (!hasProperty(current, "~effect/Effect/evaluate")) return exitDie(`Fiber.runLoop: Not a valid effect: ${String(current)}`);
				current = exitDie(error);
			}
		} finally {
			this._running = prevRunning;
			globalThis[currentFiberTypeId] = prevFiber;
		}
	}
	getCont(symbol) {
		if (this._deferredInterrupt) {
			this._deferredInterrupt = false;
			return deferredInterruptCont;
		}
		while (true) {
			const op = this._stack.pop();
			if (!op) return void 0;
			const all = op[contAll];
			if (all !== void 0) {
				const cont = all.call(op, this);
				if (cont) {
					cont[symbol] = cont;
					return cont;
				}
			}
			if (op[symbol]) return op;
		}
	}
	succeedWith(value) {
		if ((++this.currentOpCount & maxInlineSteps - 1) === 0) return exitSucceed(value);
		const cont = this.getCont(contA);
		return cont ? cont[contA](value, this) : this.yieldWith(exitSucceed(value));
	}
	yieldWith(value) {
		this._yielded = value;
		return Yield;
	}
	yieldNow(effect, priority = 0, automatic = false) {
		let resumed = false;
		this.currentDispatcher.scheduleTask(() => {
			if (resumed) return;
			this._autoYielded = automatic;
			this.evaluate(effect);
		}, priority);
		return this.yieldWith(() => {
			resumed = true;
		});
	}
	children() {
		return this._children ??= /* @__PURE__ */ new Set();
	}
	pipe() {
		return pipeArguments(this, arguments);
	}
	setContext(context) {
		const previous = this.context;
		this.context = context;
		if (previous !== void 0 && hasSameCache(previous, context)) return;
		const root = context.cacheRoot;
		const cache = root._fiberCache ??= makeFiberContextCache(context);
		if (this.cache?.scheduler !== cache.scheduler) this._dispatcher = void 0;
		this.cache = cache;
	}
	get currentSpanLocal() {
		const span = this.cache.span;
		return span?._tag === "Span" ? span : void 0;
	}
};
var makeFiberContextCache = (context) => {
	const currentTracer = getOrUndefinedUnsafe(context, TracerKey);
	return {
		scheduler: get$1(context, Scheduler),
		tracer: currentTracer,
		tracerContext: currentTracer ? currentTracer["context"] : void 0,
		tracerEnabled: get$1(context, TracerEnabled),
		span: getOrUndefinedUnsafe(context, ParentSpanKey),
		logLevel: get$1(context, CurrentLogLevel),
		minimumLogLevel: get$1(context, MinimumLogLevel),
		stackFrame: get$1(context, CurrentStackFrame),
		runtimeMetrics: getOrUndefinedUnsafe(context, FiberRuntimeMetricsKey),
		maxOpsBeforeYield: get$1(context, MaxOpsBeforeYield),
		preventYield: get$1(context, PreventSchedulerYield)
	};
};
var deferredInterruptCont = {
	[contA](_value, fiber) {
		return failCause$1(fiber._interruptedCause);
	},
	[contE](_cause, fiber) {
		return failCause$1(fiber._interruptedCause);
	}
};
var maxInlineSteps = 32;
var fiberMiddleware = { interruptChildren: void 0 };
var fiberStackAnnotations = (fiber) => {
	if (!fiber.cache.stackFrame) return void 0;
	const annotations = /* @__PURE__ */ new Map();
	annotations.set(InterruptorStackTrace.key, fiber.cache.stackFrame);
	return makeUnsafe$4(annotations);
};
/** @internal */
var fiberAwaitAll = (self) => callback((resume) => {
	const iter = self[Symbol.iterator]();
	const exits = [];
	let cancel = void 0;
	function loop() {
		let result = iter.next();
		while (!result.done) {
			if (result.value._exit) {
				exits.push(result.value._exit);
				result = iter.next();
				continue;
			}
			cancel = result.value.addObserver((exit) => {
				exits.push(exit);
				loop();
			});
			return;
		}
		resume(succeed$3(exits));
	}
	loop();
	return sync(() => cancel?.());
});
/** @internal */
var fiberInterruptAll = (fibers) => withFiber$1((parent) => {
	const annotations = fiberStackAnnotations(parent);
	let fiberArr = empty$1();
	for (const fiber of fibers) {
		fiber.interruptUnsafe(parent.id, annotations);
		fiberArr.push(fiber);
	}
	return asVoid(fiberAwaitAll(fiberArr));
});
/** @internal */
var succeed$3 = exitSucceed;
/** @internal */
var failCause$1 = exitFailCause;
/** @internal */
var fail$3 = exitFail;
/** @internal */
var sync = /*#__PURE__*/ makePrimitive({
	op: "Sync",
	[evaluate](fiber) {
		const thunk = this[args];
		const value = thunk();
		const cont = fiber.getCont(contA);
		return cont ? cont[contA](value, fiber) : fiber.yieldWith(exitSucceed(value));
	}
});
/** @internal */
var suspend$1 = /*#__PURE__*/ makePrimitive({
	op: "Suspend",
	[evaluate](_fiber) {
		const thunk = this[args];
		return thunk();
	}
});
/** @internal */
var fromResult$1 = /*#__PURE__*/ match$1({
	onFailure: fail$3,
	onSuccess: succeed$3
});
/** @internal */
var failCauseSync$1 = (evaluate) => suspend$1(() => failCause$1(evaluate()));
/** @internal */
var die$2 = (defect) => exitDie(defect);
/** @internal */
var void_$2 = /*#__PURE__*/ succeed$3(void 0);
/** @internal */
var try_$1 = (options) => {
	const evaluate = typeof options === "function" ? options : options.try;
	const catcher = typeof options === "function" ? (cause) => new UnknownError(cause, "An error occurred in Effect.try") : options.catch;
	return suspend$1(() => {
		try {
			return succeed$3(evaluate());
		} catch (err) {
			return fail$3(catcher(err));
		}
	});
};
var callbackOptions = /*#__PURE__*/ function() {
	const Proto = /*#__PURE__*/ makePrimitiveProto({
		op: "Async",
		[evaluate](fiber) {
			let resumed = false;
			let yielded = false;
			const controller = this.withSignal ? new AbortController() : void 0;
			const onCancel = this.register.call(fiber.cache.scheduler, (effect) => {
				if (resumed) return;
				resumed = true;
				if (yielded) fiber.evaluate(effect);
				else yielded = effect;
			}, controller?.signal);
			if (yielded !== false) return yielded;
			yielded = true;
			fiber.yieldWith(() => {
				resumed = true;
			});
			if (controller === void 0 && onCancel === void 0) return Yield;
			fiber._stack.push(asyncFinalizer(() => {
				resumed = true;
				controller?.abort();
				return onCancel ?? exitVoid;
			}));
			return Yield;
		}
	});
	const AsyncImpl = function(register, withSignal) {
		this.register = register;
		this.withSignal = withSignal;
	};
	AsyncImpl.prototype = Proto;
	return function(register, withSignal) {
		return new AsyncImpl(register, withSignal);
	};
}();
var asyncFinalizer = /*#__PURE__*/ makePrimitive({
	op: "AsyncFinalizer",
	[contAll](fiber) {
		if (fiber.interruptible) {
			fiber.interruptible = false;
			fiber._stack.push(setInterruptibleTrue);
		}
	},
	[contE](cause, _fiber) {
		return hasInterrupts(cause) ? flatMap$1(combineFinalizerCause(exitFailCause(cause), this[args]()), () => failCause$1(cause)) : failCause$1(cause);
	}
});
/** @internal */
var callback = (register) => callbackOptions(register, register.length >= 2);
/** @internal */
var gen$1 = (...args) => {
	if (args.length === 1) {
		const body = args[0];
		return suspend$1(() => fromIteratorUnsafe(body()));
	}
	const [options, body] = args;
	return suspend$1(() => fromIteratorUnsafe(body.call(options.self)));
};
var fnBody = (bodyOrOptions, pipeables) => typeof bodyOrOptions === "function" ? bodyOrOptions : pipeables.shift().bind(bodyOrOptions.self);
/** @internal */
var fnUntraced = (bodyOrOptions, ...pipeables) => {
	const body = fnBody(bodyOrOptions, pipeables);
	const fn = pipeables.length === 0 ? function() {
		return suspend$1(() => fromIteratorUnsafe(body.apply(this, arguments)));
	} : function() {
		let effect = suspend$1(() => fromIteratorUnsafe(body.apply(this, arguments)));
		for (let i = 0; i < pipeables.length; i++) effect = pipeables[i](effect, ...arguments);
		return effect;
	};
	return defineFunctionLength(body.length, fn);
};
var defineFunctionLength = (length, fn) => Object.defineProperty(fn, "length", {
	value: length,
	configurable: true
});
/** @internal */
var fnUntracedEager$1 = (bodyOrOptions, ...pipeables) => {
	const body = fnBody(bodyOrOptions, pipeables);
	return defineFunctionLength(body.length, pipeables.length === 0 ? function() {
		return fromIteratorEagerUnsafe(() => body.apply(this, arguments));
	} : function() {
		let effect = fromIteratorEagerUnsafe(() => body.apply(this, arguments));
		for (const pipeable of pipeables) effect = pipeable(effect, ...arguments);
		return effect;
	});
};
var fromIteratorEagerUnsafe = (evaluate) => {
	try {
		const iterator = evaluate();
		let value = void 0;
		while (true) {
			const state = iterator.next(value);
			if (state.done) return succeed$3(state.value);
			const primitive = state.value;
			if (primitive && primitive._tag === "Success") {
				value = primitive.value;
				continue;
			} else if (primitive && primitive._tag === "Failure") return state.value;
			else {
				let isFirstExecution = true;
				return suspend$1(() => {
					if (isFirstExecution) {
						isFirstExecution = false;
						return flatMap$1(state.value, (value) => fromIteratorUnsafe(iterator, value));
					} else return suspend$1(() => fromIteratorUnsafe(evaluate()));
				});
			}
		}
	} catch (error) {
		return die$2(error);
	}
};
var fromIteratorUnsafe = /*#__PURE__*/ function() {
	const Proto = /*#__PURE__*/ makePrimitiveProto({
		op: "Iterator",
		[contA](value, fiber) {
			const iter = this.iterator;
			while (true) {
				const state = iter.next(value);
				if (state.done) return succeed$3(state.value);
				if (!effectIsExit(state.value)) {
					fiber._stack.push(this);
					return state.value;
				} else if (state.value._tag === "Failure") return state.value;
				value = state.value.value;
			}
		},
		[evaluate](fiber) {
			return this[contA](this.initial, fiber);
		}
	});
	const IteratorImpl = function(iterator, initial) {
		this.iterator = iterator;
		this.initial = initial;
	};
	IteratorImpl.prototype = Proto;
	return function(iterator, initial) {
		return new IteratorImpl(iterator, initial);
	};
}();
/** @internal */
var as = /*#__PURE__*/ dual(2, (self, value) => new ContImpl(self, returnPayload, succeed$3(value)));
var evaluateCont = function(fiber) {
	fiber._stack.push(this);
	return this[args];
};
var OnSuccessProto = /*#__PURE__*/ makePrimitiveProto({
	op: "OnSuccess",
	[evaluate]: evaluateCont
});
var ContImpl = function(self, cont, payload) {
	this[args] = self;
	this[contA] = cont;
	this.payload = payload;
};
ContImpl.prototype = OnSuccessProto;
var returnPayload = function() {
	return this.payload;
};
var continuationMarksStack = /*#__PURE__*/ (() => {
	const limit = /*#__PURE__*/ getStackTraceLimit();
	if (limit === 0) return false;
	const marker = "~effect/Effect/stackProbe";
	const probe = { [marker]: function stackProbe() {
		return /* @__PURE__ */ new Error();
	} };
	setStackTraceLimit(1);
	const error = /*#__PURE__*/ probe[marker]();
	setStackTraceLimit(limit);
	return error.stack?.includes("[as " + marker + "]") === true;
})();
var mapCont = function(value, fiber) {
	const f = this.payload;
	return fiber.succeedWith(continuationMarksStack ? f(value) : internalCall(() => f(value)));
};
var andThenCont = function(value) {
	const f = this.payload;
	return f(value);
};
/** @internal */
var asVoid = (self) => new ContImpl(self, returnPayload, exitVoid);
/** @internal */
var flatMap$1 = /*#__PURE__*/ dual(2, (self, f) => new ContImpl(self, andThenCont, f));
/** @internal */
var effectIsExit = (effect) => effect[ExitTypeId] !== void 0;
/** @internal */
var flatMapEager$1 = /*#__PURE__*/ dual(2, (self, f) => {
	if (effectIsExit(self)) return self._tag === "Success" ? f(self.value) : self;
	return flatMap$1(self, f);
});
/** @internal */
var map$3 = /*#__PURE__*/ dual(2, (self, f) => new ContImpl(self, mapCont, f));
/** @internal */
var mapEager$1 = /*#__PURE__*/ dual(2, (self, f) => effectIsExit(self) ? exitMap(self, f) : map$3(self, f));
/** @internal */
var mapErrorEager$1 = /*#__PURE__*/ dual(2, (self, f) => effectIsExit(self) ? exitMapError(self, f) : mapError(self, f));
/** @internal */
var exitIsSuccess = (self) => self._tag === "Success";
/** @internal */
var exitVoid = /*#__PURE__*/ exitSucceed(void 0);
/** @internal */
var exitMap = /*#__PURE__*/ dual(2, (self, f) => self._tag === "Success" ? exitSucceed(f(self.value)) : self);
/** @internal */
var exitMapError = /*#__PURE__*/ dual(2, (self, f) => {
	if (self._tag === "Success") return self;
	return exitFailCause(causeMap(self.cause, f));
});
/** @internal */
var exitAsVoidAll = (exits) => {
	const failures = [];
	for (const exit of exits) if (exit._tag === "Failure") failures.push(...exit.cause.reasons);
	return failures.length === 0 ? exitVoid : exitFailCause(causeFromReasons(failures));
};
/** @internal */
var updateContext = /*#__PURE__*/ dual(2, (self, f) => withFiber$1((fiber) => {
	const prevContext = fiber.context;
	const nextContext = f(prevContext);
	if (prevContext === nextContext) return self;
	fiber.setContext(nextContext);
	onExitUnsafe(fiber, () => {
		fiber.setContext(prevContext);
	});
	return self;
}));
/** @internal */
var context$1 = () => getContext;
var getContext = /*#__PURE__*/ withFiber$1((fiber) => succeed$3(fiber.context));
/** @internal */
var provideContext = /*#__PURE__*/ dual(2, (self, context) => {
	if (effectIsExit(self)) return self;
	return updateContext(self, merge(context));
});
/** @internal */
var provideService = function() {
	if (arguments.length === 1) return dual(2, (self, impl) => provideServiceImpl(self, arguments[0], impl));
	return dual(3, (self, service, impl) => provideServiceImpl(self, service, impl)).apply(this, arguments);
};
var provideServiceImpl = (self, service, implementation) => updateContext(self, add(service, implementation));
/** @internal */
var catchCause$1 = /*#__PURE__*/ dual(2, (self, f) => new OnFailureImpl(self, f.length !== 1 ? (cause) => f(cause) : f));
var OnFailureProto = /*#__PURE__*/ makePrimitiveProto({
	op: "OnFailure",
	[evaluate]: evaluateCont
});
var OnFailureImpl = function(self, f) {
	this[args] = self;
	this[contE] = f;
};
OnFailureImpl.prototype = OnFailureProto;
/** @internal */
var mapError = /*#__PURE__*/ dual(2, (self, f) => catchCause$1(self, (cause) => failCause$1(causeMap(cause, f))));
var OnSuccessAndFailureProto = /*#__PURE__*/ makePrimitiveProto({
	op: "OnSuccessAndFailure",
	[evaluate]: evaluateCont
});
var OnSuccessAndFailureImpl = function(self, onSuccess, onFailure) {
	this[args] = self;
	this[contA] = onSuccess;
	this[contE] = onFailure;
};
OnSuccessAndFailureImpl.prototype = OnSuccessAndFailureProto;
/** @internal */
var exit$1 = (self) => effectIsExit(self) ? exitSucceed(self) : exitPrimitive(self);
var exitPrimitive = /*#__PURE__*/ makePrimitive({
	op: "Exit",
	[evaluate](fiber) {
		fiber._stack.push(this);
		return this[args];
	},
	[contA](value, fiber, exit) {
		return fiber.succeedWith(exit ?? exitSucceed(value));
	},
	[contE](cause, fiber, exit) {
		return fiber.succeedWith(exit ?? exitFailCause(cause));
	}
});
/** @internal */
var ScopeTypeId = "~effect/Scope";
/** @internal */
var ScopeCloseableTypeId = "~effect/Scope/Closeable";
/** @internal */
var scopeTag = /*#__PURE__*/ Service$1("effect/Scope");
/** @internal */
var scopeClose = (self, exit_) => withFiber$1((fiber) => {
	fiberEnterUninterruptibleUnsafe(fiber);
	return scopeCloseUnsafe(self, exit_) ?? void_$2;
});
/** @internal */
var scopeCloseUnsafe = (self, exit_) => {
	const state = self.state;
	if (state._tag === "Closed") return;
	self.state = {
		_tag: "Closed",
		exit: exit_
	};
	if (self.parent !== void 0) scopeRemoveFinalizerUnsafe(self.parent, self);
	if (state._tag === "Empty") return;
	if (state.finalizer !== void 0) return runFinalizer(state.finalizer, exit_);
	const finalizers = state.finalizers;
	if (finalizers.size === 1) return runFinalizer(finalizers.values().next().value, exit_);
	return scopeCloseFinalizers(self, finalizers, exit_);
};
var runFinalizer = (finalizer, exit_) => {
	try {
		return finalizer(exit_);
	} catch (defect) {
		return exitDie(defect);
	}
};
var combineFinalizerCause = (exit_, finalizer) => exitIsSuccess(exit_) ? finalizer : catchCause$1(finalizer, (cause) => failCause$1(causeElectDefects(causeCombine(exit_.cause, cause))));
var scopeCloseFinalizers = /*#__PURE__*/ fnUntraced(function* (self, finalizers, exit_) {
	let exits = [];
	const fibers = [];
	const arr = Array.from(finalizers);
	const parent = getCurrentFiber();
	for (let i = arr.length - 1; i >= 0; i--) {
		const [key, finalizer] = arr[i];
		if (self.strategy === "sequential") exits.push(yield* exit$1(runFinalizer(finalizer, exit_)));
		else if (key !== parent) fibers.push(forkUnsafe$1(parent, runFinalizer(finalizer, exit_), true, true, "inherit"));
	}
	if (fibers.length > 0) exits = yield* fiberAwaitAll(fibers);
	return yield* exitAsVoidAll(exits);
});
/** @internal */
var scopeForkUnsafe = (scope, finalizerStrategy) => {
	const child = makeScope(finalizerStrategy, scope);
	if (scope.state._tag === "Closed") {
		child.state = scope.state;
		return child;
	}
	scopeAddFinalizerUnsafe(scope, child, (exit) => scopeClose(child, exit));
	return child;
};
/** @internal */
var scopeAddFinalizerUnsafe = (scope, key, finalizer) => {
	if (scope.state._tag === "Empty") scope.state = {
		_tag: "Open",
		finalizerKey: key,
		finalizer,
		finalizers: void 0
	};
	else if (scope.state._tag === "Open") {
		const state = scope.state;
		if (state.finalizer !== void 0) {
			state.finalizers = /* @__PURE__ */ new Map([[state.finalizerKey, state.finalizer]]);
			state.finalizerKey = void 0;
			state.finalizer = void 0;
			state.finalizers.set(key, finalizer);
		} else state.finalizers.set(key, finalizer);
	}
};
/** @internal */
var scopeRemoveFinalizerUnsafe = (scope, key) => {
	if (scope.state._tag !== "Open") return;
	const state = scope.state;
	if (state.finalizerKey === key) scope.state = constScopeEmpty;
	else if (state.finalizers !== void 0) {
		state.finalizers.delete(key);
		if (state.finalizers.size === 0) scope.state = constScopeEmpty;
	}
};
/** @internal */
var scopeMakeUnsafe = (finalizerStrategy) => makeScope(finalizerStrategy, void 0);
var makeScope = (finalizerStrategy = "sequential", parent) => ({
	[ScopeCloseableTypeId]: ScopeCloseableTypeId,
	[ScopeTypeId]: ScopeTypeId,
	strategy: finalizerStrategy,
	parent,
	state: constScopeEmpty
});
var constScopeEmpty = { _tag: "Empty" };
/** @internal */
var provideScope = /*#__PURE__*/ provideService(scopeTag);
var OnExitImpl = /*#__PURE__*/ function() {
	const Proto = /*#__PURE__*/ makePrimitiveProto({
		op: "OnExit",
		[evaluate](fiber) {
			fiber._stack.push(this);
			return this.effect;
		},
		[contAll](fiber) {
			if (fiber.interruptible && this.interruptible !== true) {
				fiber._stack.push(setInterruptibleTrue);
				fiber.interruptible = false;
			}
		},
		[contA](value, _, exit) {
			exit ??= exitSucceed(value);
			let eff;
			try {
				eff = this.onExit(exit);
			} catch (defect) {
				eff = exitDie(defect);
			}
			return eff ? flatMap$1(eff, (_) => exit) : exit;
		},
		[contE](cause, _, exit) {
			exit ??= exitFailCause(cause);
			let eff;
			try {
				eff = this.onExit(exit);
			} catch (defect) {
				eff = exitDie(defect);
			}
			return eff ? flatMap$1(combineFinalizerCause(exit, eff), (_) => exit) : exit;
		}
	});
	const OnExitImpl = function(effect, onExit, interruptible) {
		this.effect = effect;
		this.onExit = onExit;
		this.interruptible = interruptible;
	};
	OnExitImpl.prototype = Proto;
	return OnExitImpl;
}();
/** @internal */
var onExitPrimitive = (effect, onExit, interruptible) => new OnExitImpl(effect, onExit, interruptible);
/**
* Pushes an exit finalizer for the current `withFiber` evaluation. Only call inside `withFiber`.
* @internal
*/
var onExitUnsafe = (fiber, f) => {
	fiber._stack.push(new OnExitImpl(void 0, f, void 0));
};
/** @internal */
var onExit = /*#__PURE__*/ dual(2, onExitPrimitive);
/** @internal */
var uninterruptible = (self) => withFiber$1((fiber) => {
	if (!fiber.interruptible) return self;
	fiber.interruptible = false;
	fiber._stack.push(setInterruptibleTrue);
	return self;
});
var setInterruptibleTrue = /*#__PURE__*/ (/* @__PURE__ */ makePrimitive({
	op: "SetInterruptible",
	[contAll](fiber) {
		fiber.interruptible = this[args];
		if (fiber._interruptedCause && fiber.interruptible) return () => failCause$1(fiber._interruptedCause);
	}
}))(true);
/**
* Makes the current fiber uninterruptible for the returned effect without an
* extra primitive. Call only within `withFiber`.
*
* @internal
*/
var fiberEnterUninterruptibleUnsafe = (fiber) => {
	const impl = fiber;
	if (!impl.interruptible) return;
	impl.interruptible = false;
	impl._stack.push(setInterruptibleTrue);
};
/** @internal */
var whileLoop = /*#__PURE__*/ makePrimitive({
	op: "While",
	[contA](value, fiber) {
		this[args].step(value);
		if (this["~effect/Effect/args"].while()) {
			fiber._stack.push(this);
			return this[args].body();
		}
		return exitVoid;
	},
	[evaluate](fiber) {
		if (this["~effect/Effect/args"].while()) {
			fiber._stack.push(this);
			return this[args].body();
		}
		return exitVoid;
	}
});
/** @internal */
var forEach = /*#__PURE__*/ dual((args) => typeof args[1] === "function", (iterable, f, options) => suspend$1(() => {
	const concurrency = resolveConcurrency(options?.concurrency);
	if (concurrency === 1) return forEachSequential(iterable, f, options);
	const items = fromIterable$1(iterable);
	let length = items.length;
	if (length === 0) return options?.discard ? void_$2 : succeed$3([]);
	const out = options?.discard ? void 0 : new Array(length);
	const eff = forEachConcurrent({
		f,
		out
	}, items, { concurrency });
	return eff ? as(eff, out) : succeed$3(out);
}));
var forEachSequential = (iterable, f, options) => suspend$1(() => {
	const out = options?.discard ? void 0 : [];
	const iterator = iterable[Symbol.iterator]();
	let state = iterator.next();
	let index = 0;
	return as(whileLoop({
		while: () => !state.done,
		body: () => f(state.value, index++),
		step: (b) => {
			if (out) out.push(b);
			state = iterator.next();
		}
	}), out);
});
/** @internal */
var resolveConcurrency = (concurrency) => concurrency === "unbounded" ? Number.POSITIVE_INFINITY : Math.max(1, concurrency ?? 1);
/** @internal */
var iterateEager = () => (options) => {
	const onItem = options.onItem;
	const step = options.step;
	const resumeSequential = (state, items, index, end, effect) => flatMap$1(exit$1(effect), (itemExit) => step(state, items[index], itemExit, index) ?? runSequential(state, items, index + 1, end) ?? void_$2);
	const runSequential = (state, items, index = 0, end = items.length) => {
		for (; index < end; index++) {
			const item = items[index];
			const effect = onItem(state, item, index);
			if (!effectIsExit(effect)) return resumeSequential(state, items, index, end, effect);
			const terminal = step(state, item, effect, index);
			if (terminal) return terminal._tag === "Failure" ? terminal : void 0;
		}
	};
	return runSequential;
};
var iterateConcurrentImpl = (options) => {
	const onItem = options.onItem;
	const step = options.step;
	return (state, items, opts) => {
		let index = 0;
		const end = opts.end ?? items.length;
		const concurrency = opts.concurrency;
		let done = false;
		let parentFiber;
		let fibers;
		let resume;
		let terminal;
		let effect;
		const failDefect = (error) => {
			const defect = exitDie(error);
			terminal = defect;
			done = true;
			return fibers && fibers.size > 0 ? flatMap$1(uninterruptible(fiberInterruptAll(Array.from(fibers))), () => terminal ?? defect) : defect;
		};
		const go = () => {
			let paused = false;
			for (; !terminal && index < end; index++) {
				const item = items[index];
				const eff = effect ?? onItem(state, item, index);
				if (effectIsExit(eff)) {
					terminal = step(state, item, eff, index);
					if (terminal) break;
				} else if (!parentFiber) return callback((cb) => {
					parentFiber = getCurrentFiber();
					fibers = /* @__PURE__ */ new Set();
					effect = eff;
					resume = cb;
					let result;
					try {
						result = go();
					} catch (error) {
						return cb(failDefect(error));
					}
					if (result) return cb(result);
					return suspend$1(() => {
						terminal ??= exitVoid;
						return flatMap$1(fibers ? fiberInterruptAll(fibers) : void_$2, () => terminal?._tag === "Failure" ? terminal : void_$2);
					});
				});
				else {
					effect = void 0;
					const fiber = forkUnsafe$1(parentFiber, eff, true, true, "inherit");
					if (fiber._exit) {
						terminal = step(state, item, fiber._exit, index);
						if (terminal) break;
						continue;
					}
					fibers.add(fiber);
					const currentIndex = index;
					fiber.addObserver((exit) => {
						fibers.delete(fiber);
						try {
							if (terminal) {
								if (exit._tag === "Failure") {
									const reasons = exit.cause.reasons.filter((reason) => reason._tag !== "Interrupt");
									if (reasons.length > 0) {
										const cause = causeFromReasons(reasons);
										terminal = exitFailCause(terminal._tag === "Failure" ? causeElectDefects(causeCombine(terminal.cause, cause)) : cause);
									}
								}
							} else {
								const result = step(state, item, exit, currentIndex);
								if (result) {
									terminal = result;
									go();
								}
							}
							if (paused) {
								const eff = go();
								if (eff) resume(eff);
							} else if (done && fibers.size === 0) resume(terminal ?? void_$2);
						} catch (error) {
							resume(failDefect(error));
						}
					});
					if (fibers.size < concurrency) continue;
					paused = true;
					index++;
					return;
				}
			}
			done = true;
			if (terminal) {
				if (fibers && fibers.size > 0) {
					const annotations = fiberStackAnnotations(parentFiber);
					fibers.forEach((f) => f.interruptUnsafe(parentFiber.id, annotations));
					return;
				}
				if (resume || terminal._tag === "Failure") return terminal;
			} else if (resume) {
				if (!fibers) return exitVoid;
				else if (fibers.size === 0) resume(void_$2);
			}
		};
		return go();
	};
};
/** @internal */
var iterateConcurrent = () => (options) => iterateConcurrentImpl(options);
var forEachConcurrent = /*#__PURE__*/ iterateConcurrentImpl({
	onItem(state, item, index) {
		return state.f(item, index);
	},
	step(state, _, exit, index) {
		if (exit._tag === "Failure") return exit;
		else if (state.out) state.out[index] = exit.value;
	}
});
/** @internal */
var forkUnsafe$1 = (parent, effect, immediate = false, daemon = false, uninterruptible = false) => {
	const parentRuntime = parent;
	const interruptible = uninterruptible === "inherit" ? parentRuntime.interruptible : !uninterruptible;
	const child = new FiberImpl(parentRuntime.context, interruptible);
	if (!daemon) {
		parentRuntime.children().add(child);
		child._parent = parentRuntime;
	}
	if (immediate) child.evaluate(effect);
	else {
		child._asyncContext = captureAsyncContext();
		parentRuntime.currentDispatcher.scheduleTask(() => child.evaluate(effect), 0);
	}
	return child;
};
/** @internal */
var runForkWith = (context) => (effect, options) => {
	const fiber = new FiberImpl(options?.scheduler ? add(context, Scheduler, options.scheduler) : context, options?.uninterruptible !== true);
	fiber.evaluate(effect);
	if (fiber._exit) return fiber;
	if (options?.signal) {
		if (options.signal.aborted) fiber.interruptUnsafe();
		else {
			const abort = () => fiber.interruptUnsafe();
			options.signal.addEventListener("abort", abort, { once: true });
			fiber.addObserver(() => options.signal.removeEventListener("abort", abort));
		}
	}
	if (options?.onFiberStart) options.onFiberStart(fiber);
	return fiber;
};
/** @internal */
var runSyncExitWith = (context) => {
	const runFork = runForkWith(context);
	return (effect) => {
		if (effectIsExit(effect)) return effect;
		const scheduler = new MixedScheduler("sync");
		const fiber = runFork(effect, { scheduler });
		fiber._dispatcher?.flush();
		return fiber._exit ?? exitDie(new AsyncFiberError(fiber));
	};
};
/** @internal */
var runSyncExit$1 = /*#__PURE__*/ runSyncExitWith(/*#__PURE__*/ empty());
/** @internal */
var AsyncFiberErrorTypeId = "~effect/Cause/AsyncFiberError";
/** @internal */
var AsyncFiberError = class extends (/*#__PURE__*/ TaggedError$2("AsyncFiberError")) {
	[AsyncFiberErrorTypeId] = AsyncFiberErrorTypeId;
	constructor(fiber) {
		super({
			message: "An asynchronous Effect was executed with Effect.runSync",
			fiber
		});
	}
};
/** @internal */
var UnknownErrorTypeId = "~effect/Cause/UnknownError";
/** @internal */
var UnknownError = class extends (/*#__PURE__*/ TaggedError$2("UnknownError")) {
	[UnknownErrorTypeId] = UnknownErrorTypeId;
	constructor(cause, message) {
		super({
			message,
			cause
		});
	}
};
var colors = {
	bold: "1",
	red: "31",
	green: "32",
	yellow: "33",
	blue: "34",
	cyan: "36",
	white: "37",
	gray: "90",
	black: "30",
	bgBrightRed: "101"
};
colors.gray, colors.blue, colors.green, colors.yellow, colors.red, colors.bgBrightRed, colors.black;
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Cause.js
/**
* Narrows a `Reason` to `Fail`.
*
* **When to use**
*
* Use as a predicate for `Array.filter` to pick out typed `Fail` reasons when
* iterating over `cause.reasons`.
*
* **Example** (Filtering fail reasons)
*
* ```ts import.meta.vitest
* import { Cause } from "effect"
*
* const cause = Cause.fail("error")
* const fails = cause.reasons.filter(Cause.isFailReason)
* fails[0].error // => "error"
* ```
*
* @see {@link isDieReason} — narrow to `Die`
* @see {@link isInterruptReason} — narrow to `Interrupt`
*
* @stability stable
* @category guards
* @since 4.0.0
*/
var isFailReason = isFailReason$1;
/**
* Creates a `Cause` containing a single `Die` reason with the
* given defect.
*
* **When to use**
*
* Use to construct a cause from an untyped defect or unexpected thrown value.
*
* **Example** (Creating a die cause)
*
* ```ts import.meta.vitest
* import { Cause } from "effect"
*
* Cause.die("Unexpected") // => Cause.fromReasons([Cause.makeDieReason("Unexpected")])
* ```
*
* @see {@link fail} — for typed errors
* @see {@link interrupt} — for fiber interruptions
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var die$1 = causeDie;
/**
* Transforms the typed error values inside a `Cause` using the
* provided function. Only `Fail` reasons are affected; `Die` and `Interrupt`
* reasons pass through unchanged.
*
* **When to use**
*
* Use to transform expected typed failures while preserving defects and
* interruptions unchanged.
*
* **Details**
*
* If at least one `Fail` reason exists, this returns a new `Cause`
* containing the mapped failures. If the cause has no `Fail` reasons, the
* original cause is returned unchanged.
*
* **Example** (Mapping errors to uppercase)
*
* ```ts import.meta.vitest
* import { Cause } from "effect"
*
* const cause = Cause.fail("error")
* const mapped = Cause.map(cause, (e) => e.toUpperCase())
* const reason = mapped.reasons[0]
* if (Cause.isFailReason(reason)) {
*   reason.error // => "ERROR"
* }
* ```
*
* @stability stable
* @category mapping
* @since 2.0.0
*/
var map$2 = causeMap;
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Exit.js
/**
* Creates a successful Exit containing the given value.
*
* **When to use**
*
* Use when you need an Exit that contains a known success value.
*
* **Details**
*
* Returns a `Success<A>` with the provided value. Does not perform any
* computation.
*
* **Example** (Creating a successful Exit)
*
* ```ts import.meta.vitest
* import { Exit } from "effect"
*
* Exit.succeed(42) // => Exit.succeed(42)
* ```
*
* @see {@link fail} to create a failed Exit
* @see {@link void_ void} for a pre-allocated success with no value
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var succeed$2 = exitSucceed;
/**
* Creates a failed Exit from a Cause.
*
* **When to use**
*
* Use when you already have a `Cause<E>` and want to wrap it in an Exit
* for advanced error handling where you need full control over the Cause
* structure.
*
* **Details**
*
* Returns a `Failure<never, E>`. If you only have an error value, use
* {@link fail} instead.
*
* **Example** (Creating a failed Exit from a Cause)
*
* ```ts import.meta.vitest
* import { Cause, Exit } from "effect"
*
* Exit.failCause(Cause.fail("Something went wrong")) // => Exit.fail("Something went wrong")
* ```
*
* @see {@link fail} to create a Failure from a plain error value
* @see {@link die} to create a Failure from a defect
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var failCause = exitFailCause;
/**
* Creates a failed Exit from a typed error value.
*
* **When to use**
*
* Use when you need to represent an expected typed failure as an `Exit`.
*
* **Details**
*
* The error is wrapped in a `Cause.Fail` internally.
*
* Returns a `Failure<never, E>`.
*
* **Example** (Creating a failed Exit)
*
* ```ts import.meta.vitest
* import { Exit } from "effect"
*
* Exit.fail("Something went wrong") // => Exit.fail("Something went wrong")
* ```
*
* @see {@link succeed} to create a successful Exit
* @see {@link die} to create a Failure from an unexpected defect
* @see {@link failCause} to create a Failure from a full Cause
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var fail$2 = exitFail;
var void_$1 = exitVoid;
/**
* Checks whether an Exit is a Success.
*
* **When to use**
*
* Use as a type guard to narrow `Exit<A, E>` to `Success<A, E>` and access the
* `value` property.
*
* **Example** (Narrowing to success)
*
* ```ts import.meta.vitest
* import { Exit } from "effect"
*
* const exit = Exit.succeed(42)
*
* if (Exit.isSuccess(exit)) {
*   exit.value // => 42
* }
* ```
*
* @see {@link isFailure} for the opposite check
* @see {@link match} for exhaustive pattern matching
*
* @stability stable
* @category guards
* @since 2.0.0
*/
var isSuccess = exitIsSuccess;
var DeferredProto = {
	["~effect/Deferred"]: {
		_A: identity,
		_E: identity
	},
	pipe() {
		return pipeArguments(this, arguments);
	}
};
var DeferredImpl = function() {
	this.resumes = void 0;
	this.effect = void 0;
};
DeferredImpl.prototype = DeferredProto;
/**
* Creates an empty `Deferred` synchronously outside the `Effect` runtime.
*
* **When to use**
*
* Use to allocate a `Deferred` synchronously when direct allocation outside
* `Effect` is required.
*
* **Example** (Creating a Deferred unsafely)
*
* ```ts import.meta.vitest
* import { Deferred } from "effect"
*
* const deferred = Deferred.makeUnsafe<number>()
* Deferred.isDoneUnsafe(deferred) // => false
* ```
*
* @stability stable
* @category unsafe
* @since 4.0.0
*/
var makeUnsafe$3 = () => new DeferredImpl();
var _await = (self) => callback((resume) => {
	if (self.effect) return resume(self.effect);
	self.resumes ??= [];
	self.resumes.push(resume);
	return sync(() => {
		const resumes = self.resumes;
		if (resumes === void 0) return;
		const index = resumes.indexOf(resume);
		if (index >= 0) resumes.splice(index, 1);
	});
});
/**
* Attempts to complete the `Deferred` synchronously with the specified
* completion effect.
*
* **When to use**
*
* Use to complete a `Deferred` synchronously in low-level code that already has
* the completion effect.
*
* **Details**
*
* This mutates the `Deferred` directly and should be reserved for low-level
* code; prefer the effectful completion APIs when possible. Returns `true` if
* this call completed the `Deferred`, or `false` if it was already completed.
*
* **Example** (Completing a Deferred unsafely)
*
* ```ts import.meta.vitest
* import { Deferred, Effect } from "effect"
*
* const deferred = Deferred.makeUnsafe<number>()
* Deferred.doneUnsafe(deferred, Effect.succeed(42)) // => true
* ```
*
* @stability stable
* @category unsafe
* @since 4.0.0
*/
var doneUnsafe = (self, effect) => {
	if (self.effect) return false;
	self.effect = effect;
	if (self.resumes) {
		const resumes = self.resumes;
		self.resumes = void 0;
		for (let i = 0; i < resumes.length; i++) resumes[i](effect);
	}
	return true;
};
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Scope.js
/**
* Controls how long resources stay open.
*
* A scope is a lifetime boundary. Code can register cleanup effects on it, and
* closing the scope runs those cleanups with the `Exit` value that ended the
* work. Most application code uses higher-level APIs such as `Effect.scoped`
* and `Layer`, while this module is useful when code needs to create, provide,
* fork, close, or inspect scopes directly.
*
* @stability stable
* @since 2.0.0
*/
/**
* Service tag for the active resource lifetime.
*
* **When to use**
*
* Use to access the active lifetime when registering finalizers or sharing
* resources with the surrounding scope.
*
* **Example** (Accessing the scope service)
*
* ```ts import.meta.vitest
* import { Effect, Scope } from "effect"
*
* const cleanups: Array<string> = []
* const program = Effect.gen(function*() {
*   const scope = yield* Scope.Scope
*   yield* Scope.addFinalizer(scope, Effect.sync(() => cleanups.push("Cleanup")))
* })
*
* Effect.runSync(Effect.scoped(program))
* cleanups // => ["Cleanup"]
* ```
*
* @stability stable
* @category services
* @since 2.0.0
*/
var Scope = scopeTag;
/**
* Creates a new `Scope` synchronously without wrapping it in an `Effect`.
* This is useful when you need a scope immediately but should be used with caution
* as it doesn't provide the same safety guarantees as the `Effect`-wrapped version.
*
* **When to use**
*
* Use when a scope must be allocated synchronously and the caller will close it
* manually.
*
* **Example** (Creating a scope synchronously)
*
* ```ts import.meta.vitest
* import { Effect, Exit, Scope } from "effect"
*
* const scope = Scope.makeUnsafe("sequential")
* const cleanups: Array<string> = []
* const program = Effect.gen(function*() {
*   yield* Scope.addFinalizer(scope, Effect.sync(() => cleanups.push("Cleanup")))
*   yield* Scope.close(scope, Exit.void)
* })
*
* Effect.runSync(program)
* cleanups // => ["Cleanup"]
* ```
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var makeUnsafe$2 = scopeMakeUnsafe;
/**
* Provides a concrete `Scope` to an effect.
*
* **When to use**
*
* Use to run an effect that requires `Scope` with a scope managed by the
* caller.
*
* **Details**
*
* Providing the scope removes the `Scope` requirement from the effect context.
*
* **Example** (Providing a scope)
*
* ```ts import.meta.vitest
* import { Effect, Exit, Scope } from "effect"
*
* const events: Array<string> = []
* const program = Effect.gen(function*() {
*   const scope = yield* Scope.Scope
*   yield* Scope.addFinalizer(scope, Effect.sync(() => events.push("cleanup")))
*   events.push("working")
* })
*
* const withScope = Effect.gen(function*() {
*   const scope = yield* Scope.make()
*   yield* Scope.provide(scope)(program)
*   yield* Scope.close(scope, Exit.void)
* })
*
* Effect.runSync(withScope)
* events // => ["working", "cleanup"]
* ```
*
* @stability stable
* @category combinators
* @since 4.0.0
*/
var provide$1 = provideScope;
/**
* Creates a closeable child scope synchronously and registers it with a parent scope.
*
* **When to use**
*
* Use when a child scope must be created synchronously and the caller controls
* both parent and child scope lifetimes.
*
* **Details**
*
* Closing the parent closes the child with the same exit value, and closing the
* child detaches it from the parent. The optional finalizer strategy configures
* the child scope and defaults to `"sequential"` when omitted.
*
* **Example** (Creating a child scope synchronously)
*
* ```ts import.meta.vitest
* import { Effect, Exit, Scope } from "effect"
*
* const cleanups: Array<string> = []
* const program = Effect.gen(function*() {
*   const parentScope = Scope.makeUnsafe("sequential")
*   const childScope = Scope.forkUnsafe(parentScope, "parallel")
*   yield* Scope.addFinalizer(parentScope, Effect.sync(() => cleanups.push("parent")))
*   yield* Scope.addFinalizer(childScope, Effect.sync(() => cleanups.push("child")))
*   yield* Scope.close(childScope, Exit.void)
*   yield* Scope.close(parentScope, Exit.void)
* })
*
* Effect.runSync(program)
* cleanups // => ["child", "parent"]
* ```
*
* @stability stable
* @category combinators
* @since 4.0.0
*/
var forkUnsafe = scopeForkUnsafe;
/**
* Closes a scope and runs its registered finalizers.
*
* **When to use**
*
* Use to close a scope manually with a specific exit value.
*
* **Details**
*
* Finalizers run in the scope's configured order and receive the supplied
* `Exit`.
* By default, finalizers run uninterruptibly, so interrupting the closing fiber
* waits for them to finish; a finalizer can explicitly restore interruptibility.
*
* **Gotchas**
*
* Closing a scope that is already closed returns immediately, even when the
* finalizers of an earlier close are still running.
*
* **Example** (Running scope finalizers)
*
* ```ts import.meta.vitest
* import { Effect, Exit, Scope } from "effect"
*
* const events: Array<string> = []
* const resourceManagement = Effect.gen(function*() {
*   const scope = yield* Scope.make("sequential")
*   yield* Scope.addFinalizer(scope, Effect.sync(() => events.push("database")))
*   yield* Scope.addFinalizer(scope, Effect.sync(() => events.push("file")))
*   yield* Scope.addFinalizer(scope, Effect.sync(() => events.push("memory")))
*   events.push("work")
*   yield* Scope.close(scope, Exit.succeed("Success!"))
* })
*
* Effect.runSync(resourceManagement)
* events // => ["work", "memory", "file", "database"]
* ```
*
* @stability stable
* @category combinators
* @since 2.0.0
*/
var close = scopeClose;
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Layer.js
var TypeId$19 = "~effect/Layer";
var MemoMapTypeId = "~effect/Layer/MemoMap";
var makeMemoMapEntry = (memoMap, layer) => {
	const entry = {
		observers: 0,
		deferred: makeUnsafe$3(),
		scope: makeUnsafe$2(),
		finalizer: (exit) => suspend$1(() => {
			if (--entry.observers > 0) return void_$2;
			memoMap.map.delete(layer);
			return close(entry.scope, exit);
		})
	};
	return entry;
};
var memoMapObserve = (entry, scope) => {
	if (scope.state._tag === "Closed") return false;
	entry.observers++;
	scopeAddFinalizerUnsafe(scope, {}, entry.finalizer);
	return true;
};
var LayerProto = {
	[TypeId$19]: {
		_ROut: identity,
		_E: identity,
		_RIn: identity
	},
	pipe() {
		return pipeArguments(this, arguments);
	}
};
var fromBuildUnsafe = (build) => {
	const self = Object.create(LayerProto);
	self.build = build;
	return self;
};
/**
* Constructs a `Layer` from a function that uses a `MemoMap` and `Scope` to
* build the layer.
*
* **Details**
*
* The function receives a `MemoMap` for memoization and a `Scope` for resource management.
* A child scope is created, and if the build fails, the child scope is closed.
*
* **Example** (Constructing a layer from a build function)
*
* ```ts import.meta.vitest
* import { Context, Effect, Layer } from "effect"
*
* class Database extends Context.Service<Database, {
*   readonly query: (sql: string) => Effect.Effect<string>
* }>()("Database") {}
*
* const databaseLayer = Layer.fromBuild(() =>
*   Effect.sync(() =>
*     Context.make(Database, {
*       query: (sql: string) => Effect.succeed("result")
*     })
*   )
* )
*
* const program = Database.use((database) => database.query("SELECT 1"))
* Effect.runSync(Effect.provide(program, databaseLayer)) // => "result"
* ```
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var fromBuild = (build) => fromBuildUnsafe((memoMap, scope) => {
	const layerScope = forkUnsafe(scope);
	return onExit(build(memoMap, layerScope), (exit) => exit._tag === "Failure" ? close(layerScope, exit) : void_$2);
});
/**
* Constructs a `Layer` from a function that uses a `MemoMap` and `Scope` to
* build the layer, with automatic memoization.
*
* **Details**
*
* This is similar to `fromBuild` but provides automatic memoization of the layer construction.
* The layer will be memoized based on the provided `MemoMap`.
*
* **Example** (Memoizing layer construction)
*
* ```ts import.meta.vitest
* import { Context, Effect, Layer } from "effect"
*
* class Database extends Context.Service<Database, {
*   readonly query: (sql: string) => Effect.Effect<string>
* }>()("Database") {}
*
* const databaseLayer = Layer.fromBuildMemo(() =>
*   Effect.sync(() =>
*     Context.make(Database, {
*       query: (sql: string) => Effect.succeed("result")
*     })
*   )
* )
*
* const program = Database.use((database) => database.query("SELECT 1"))
* Effect.runSync(Effect.provide(program, databaseLayer)) // => "result"
* ```
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var fromBuildMemo = (build) => {
	const self = fromBuild((memoMap, scope) => memoMap.getOrElseMemoize(self, scope, build));
	return self;
};
var MemoMapImpl = class {
	get [MemoMapTypeId]() {
		return MemoMapTypeId;
	}
	parent;
	constructor(parent) {
		this.parent = parent;
	}
	map = /*#__PURE__*/ new Map();
	get(layer, scope) {
		const local = this.map.get(layer);
		if (local) {
			memoMapObserve(local, scope);
			return local.deferred.effect ?? _await(local.deferred);
		}
		return this.parent?.get(layer, scope);
	}
	getOrElseMemoize(layer, scope, build) {
		return suspend$1(() => {
			let deferred;
			return onExitPrimitive(suspend$1(() => {
				const existing = this.get(layer, scope);
				if (existing) return existing;
				const entry = makeMemoMapEntry(this, layer);
				if (!memoMapObserve(entry, scope)) return build(this, scope);
				deferred = entry.deferred;
				this.map.set(layer, entry);
				return build(this, entry.scope);
			}), (exit) => {
				if (deferred) doneUnsafe(deferred, exit);
			});
		});
	}
};
/**
* Constructs a `MemoMap` synchronously so it can be used to build additional layers.
*
* **Example** (Creating a memo map unsafely)
*
* ```ts import.meta.vitest
* import { Context, Effect, Layer } from "effect"
*
* class Database extends Context.Service<Database, {
*   readonly query: (sql: string) => Effect.Effect<string>
* }>()("Database") {}
*
* // Create a memo map for manual layer building
* const program = Effect.gen(function*() {
*   const memoMap = Layer.makeMemoMapUnsafe()
*   const scope = yield* Effect.scope
*
*   const dbLayer = Layer.succeed(Database, {
*     query: Effect.fn("Database.query")((sql: string) => Effect.succeed("result"))
*   })
*   const context = yield* Layer.buildWithMemoMap(dbLayer, memoMap, scope)
*
*   return Context.get(context, Database)
* })
*
* const database = Effect.runSync(Effect.scoped(program))
* Effect.runSync(database.query("SELECT 1")) // => "result"
* ```
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var makeMemoMapUnsafe = () => new MemoMapImpl();
/**
* Constructs a child `MemoMap` synchronously, allowing it to reuse layers
* already memoized in the parent while isolating any new layer allocations to
* the child map.
*
* **When to use**
*
* Use to synchronously fork a memo map for manual layer building when child
* builds should see parent memoized layers without writing newly built layers
* back to the parent.
*
* @see {@link forkMemoMap} for allocating the child memo map inside `Effect`
* @see {@link makeMemoMapUnsafe} for creating a root memo map without a parent
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var forkMemoMapUnsafe = (parent) => new MemoMapImpl(parent);
/**
* Context service for the current `MemoMap` used in layer construction.
*
* **When to use**
*
* Use when building custom layer operations that need to access the current
* memoization map from the fiber context.
*
* **Details**
*
* This service wraps a `MemoMap` as a `Context.Service`, making it available
* for dependency injection during layer construction.
*
* @see {@link MemoMap} the memoization map type wrapped by this service
*
* @stability stable
* @category services
* @since 3.13.0
*/
var CurrentMemoMap = class CurrentMemoMap extends (/*#__PURE__*/ Service$1()("effect/Layer/CurrentMemoMap")) {
	static forkOrCreate(self) {
		const current = getOrUndefined(self, CurrentMemoMap);
		return current ? forkMemoMapUnsafe(current) : makeMemoMapUnsafe();
	}
};
/**
* Builds a layer into an `Effect` value, using the specified `MemoMap` to memoize
* the layer construction.
*
* **Example** (Building layers with an explicit memo map)
*
* ```ts import.meta.vitest
* import { Context, Effect, Layer } from "effect"
*
* class Database extends Context.Service<Database, {
*   readonly query: (sql: string) => Effect.Effect<string>
* }>()("Database") {}
*
* class Logger extends Context.Service<Logger, {
*   readonly log: (msg: string) => Effect.Effect<void>
* }>()("Logger") {}
*
* const logs: Array<string> = []
*
* // Build layers with explicit memoization control
* const program = Effect.gen(function*() {
*   const memoMap = yield* Layer.makeMemoMap
*   const scope = yield* Effect.scope
*
*   // Build database layer with memoization
*   const dbLayer = Layer.succeed(Database, {
*     query: Effect.fn("Database.query")((sql: string) => Effect.succeed("result"))
*   })
*   const dbContext = yield* Layer.buildWithMemoMap(dbLayer, memoMap, scope)
*
*   // Build logger layer with same memoization (reuses memo if same layer)
*   const loggerLayer = Layer.succeed(Logger, {
*     log: Effect.fn("Logger.log")((msg: string) => Effect.sync(() => logs.push(msg)))
*   })
*   const loggerContext = yield* Layer.buildWithMemoMap(
*     loggerLayer,
*     memoMap,
*     scope
*   )
*
*   return {
*     database: Context.get(dbContext, Database),
*     logger: Context.get(loggerContext, Logger)
*   }
* })
*
* const services = Effect.runSync(Effect.scoped(program))
* Effect.runSync(services.logger.log("ready"))
* logs // => ["ready"]
* ```
*
* @stability stable
* @category destructors
* @since 2.0.0
*/
var buildWithMemoMap = /*#__PURE__*/ dual(3, (self, memoMap, scope) => provideService(map$3(suspend$1(() => self.build(memoMap, scope)), add(CurrentMemoMap, memoMap)), CurrentMemoMap, memoMap));
/**
* Constructs a layer that provides all services in an already available
* `Context`.
*
* **When to use**
*
* Use when you need a `Layer` built from an existing `Context`, including when
* you need to provide multiple services at once.
*
* **Details**
*
* This is a more general version of `succeed` that allows you to provide
* multiple services at once through a `Context`.
*
* **Example** (Providing multiple services from a context)
*
* ```ts import.meta.vitest
* import { Context, Effect, Layer } from "effect"
*
* class Database extends Context.Service<Database, {
*   readonly query: (sql: string) => Effect.Effect<string>
* }>()("Database") {}
*
* class Logger extends Context.Service<Logger, {
*   readonly log: (msg: string) => Effect.Effect<void>
* }>()("Logger") {}
*
* const logs: Array<string> = []
* const context = Context.make(Database, {
*   query: Effect.fn("Database.query")((sql: string) => Effect.succeed("result"))
* }).pipe(
*   Context.add(Logger, {
*     log: (msg: string) => Effect.sync(() => logs.push(msg))
*   })
* )
*
* const layer = Layer.succeedContext(context)
* const program = Logger.use((logger) => logger.log("ready"))
* Effect.runSync(Effect.provide(program, layer))
* logs // => ["ready"]
* ```
*
* @see {@link succeed} for providing a single service from a value
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var succeedContext = (context) => fromBuildUnsafe(constant(succeed$3(context)));
/**
* Constructs a layer from an effect that produces all services in a `Context`.
*
* **When to use**
*
* Use when you need a `Layer` that effectfully constructs a `Context` with
* multiple services.
*
* **Details**
*
* This allows you to create a `Layer` from an effectful computation that
* returns multiple services. The `Effect` is executed in the scope of the
* layer.
*
* **Example** (Creating a layer from an effectful context)
*
* ```ts import.meta.vitest
* import { Context, Effect, Layer } from "effect"
*
* class Database extends Context.Service<
*   Database,
*   { readonly query: (sql: string) => Effect.Effect<string> }
* >()("Database") {}
*
* const layer = Layer.effectContext(
*   Effect.succeed(Context.make(Database, {
*     query: (sql: string) => Effect.succeed(`Query: ${sql}`)
*   }))
* )
* const program = Database.use((database) => database.query("SELECT 1"))
* Effect.runSync(Effect.provide(program, layer)) // => "Query: SELECT 1"
* ```
*
* @see {@link effect} for effectfully providing a single service
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var effectContext = (effect) => fromBuildMemo((_, scope) => provide$1(effect, scope));
/**
* Constructs a layer from an effect, discarding its value and providing no
* services.
*
* **When to use**
*
* Use when layer construction should run an Effect for its side effects while providing no
* services.
*
* **Example** (Running an effect during layer construction)
*
* ```ts import.meta.vitest
* import { Effect, Layer } from "effect"
*
* const logs: Array<string> = []
* const initLayer = Layer.effectDiscard(
*   Effect.sync(() => {
*     logs.push("Initializing application...")
*   })
* )
* Effect.runSync(Effect.scoped(Layer.build(initLayer)))
* logs // => ["Initializing application..."]
* ```
*
* @see {@link empty} for a no-op layer that performs no construction work
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var effectDiscard = (effect) => effectContext(as(effect, empty()));
var mergeAllEffect = (layers, memoMap, scope) => {
	const parentScope = forkUnsafe(scope, "parallel");
	return forEach(layers, (layer) => layer.build(memoMap, forkUnsafe(parentScope, "sequential")), { concurrency: layers.length }).pipe(map$3((context) => mergeAll(...context)));
};
var provideWith = (self, that, f) => fromBuildMemo((memoMap, scope) => flatMap$1(Array.isArray(that) ? mergeAllEffect(that, memoMap, scope) : that.build(memoMap, scope), (context) => self.build(memoMap, scope).pipe(provideContext(context), map$3((merged) => f(merged, context)))));
/**
* Feeds the output services of the dependency layer into the requirements of
* this layer, returning a layer that only provides the services from this layer.
*
* **When to use**
*
* Use when you need to hide an implementation dependency layer from callers.
*
* **Details**
*
* In `serviceLayer.pipe(Layer.provide(dependencyLayer))`, the dependency layer is
* built first and is used to satisfy the requirements of `serviceLayer`.
*
* **Example** (Providing layer dependencies)
*
* ```ts import.meta.vitest
* import { Context, Effect, Layer } from "effect"
*
* class Database extends Context.Service<Database, {
*   readonly query: (sql: string) => Effect.Effect<string>
* }>()("Database") {}
*
* class UserService extends Context.Service<UserService, {
*   readonly getUser: (id: string) => Effect.Effect<{
*     id: string
*     name: string
*   }>
* }>()("UserService") {}
*
* class Logger extends Context.Service<Logger, {
*   readonly log: (msg: string) => Effect.Effect<void>
* }>()("Logger") {}
*
* // Create dependency layers
* const databaseLayer = Layer.succeed(Database, {
*   query: Effect.fn("Database.query")((sql: string) => Effect.succeed(`DB: ${sql}`))
* })
*
* const logs: Array<string> = []
* const loggerLayer = Layer.succeed(Logger, {
*   log: Effect.fn("Logger.log")((msg: string) => Effect.sync(() => logs.push(`[LOG] ${msg}`)))
* })
*
* // UserService depends on Database and Logger
* const userServiceLayer = Layer.effect(UserService, Effect.gen(function*() {
*   const database = yield* Database
*   const logger = yield* Logger
*
*   return {
*     getUser: Effect.fn("UserService.getUser")(function*(id: string) {
*         yield* logger.log(`Looking up user ${id}`)
*         const result = yield* database.query(
*           `SELECT * FROM users WHERE id = ${id}`
*         )
*         return { id, name: result }
*       })
*   }
* }))
*
* // Provide dependencies to UserService layer
* const userServiceWithDependencies = userServiceLayer.pipe(
*   Layer.provide(Layer.mergeAll(databaseLayer, loggerLayer))
* )
*
* // Now UserService layer has no dependencies
* const program = Effect.gen(function*() {
*   const userService = yield* UserService
*   return yield* userService.getUser("123")
* }).pipe(
*   Effect.provide(userServiceWithDependencies)
* )
* Effect.runSync(program) // => { id: "123", name: "DB: SELECT * FROM users WHERE id = 123" }
* logs // => ["[LOG] Looking up user 123"]
* ```
*
* @see {@link provideMerge} for retaining the dependency services
*
* @stability stable
* @category providing services
* @since 2.0.0
*/
var provide = /*#__PURE__*/ dual(2, (self, that) => provideWith(self, that, identity));
/**
* Feeds the output services of the dependency layer into the requirements of
* this layer, returning a layer that provides both sets of services.
*
* **When to use**
*
* Use when you need to compose `Layer`s while keeping both the constructed
* service and the dependency used to build it available.
*
* **Details**
*
* Prefer {@link provide} when the dependency should stay private.
*
* **Example** (Providing dependencies while retaining services)
*
* ```ts import.meta.vitest
* import { Context, Effect, Layer } from "effect"
*
* class Database extends Context.Service<Database, {
*   readonly query: (sql: string) => Effect.Effect<string>
* }>()("Database") {}
*
* class Logger extends Context.Service<Logger, {
*   readonly log: (msg: string) => Effect.Effect<void>
* }>()("Logger") {}
*
* class UserService extends Context.Service<UserService, {
*   readonly getUser: (id: string) => Effect.Effect<{
*     id: string
*     name: string
*   }>
* }>()("UserService") {}
*
* // Create dependency layers
* const databaseLayer = Layer.succeed(Database, {
*   query: Effect.fn("Database.query")((sql: string) => Effect.succeed(`DB: ${sql}`))
* })
*
* const logs: Array<string> = []
* const loggerLayer = Layer.succeed(Logger, {
*   log: Effect.fn("Logger.log")((msg: string) => Effect.sync(() => logs.push(`[LOG] ${msg}`)))
* })
*
* // UserService depends on Database and Logger
* const userServiceLayer = Layer.effect(UserService, Effect.gen(function*() {
*   const database = yield* Database
*   const logger = yield* Logger
*
*   return {
*     getUser: Effect.fn("UserService.getUser")(function*(id: string) {
*         yield* logger.log(`Looking up user ${id}`)
*         const result = yield* database.query(
*           `SELECT * FROM users WHERE id = ${id}`
*         )
*         return { id, name: result }
*       })
*   }
* }))
*
* // Provide dependencies and merge all services together
* const allServicesLayer = userServiceLayer.pipe(
*   Layer.provideMerge(Layer.mergeAll(databaseLayer, loggerLayer))
* )
*
* // Now the resulting layer provides UserService, Database, AND Logger
* const program = Effect.gen(function*() {
*   const userService = yield* UserService
*   const logger = yield* Logger // Still available!
*   const database = yield* Database // Still available!
*
*   const user = yield* userService.getUser("123")
*   yield* logger.log(`Found user: ${user.name}`)
*
*   return user
* }).pipe(
*   Effect.provide(allServicesLayer)
* )
* Effect.runSync(program) // => { id: "123", name: "DB: SELECT * FROM users WHERE id = 123" }
* logs // => ["[LOG] Looking up user 123", "[LOG] Found user: DB: SELECT * FROM users WHERE id = 123"]
* ```
*
* @see {@link provide} for keeping dependency services private
*
* @stability stable
* @category providing services
* @since 2.0.0
*/
var provideMerge = /*#__PURE__*/ dual(2, (self, that) => provideWith(self, that, (self, that) => merge(that, self)));
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/dateTime.js
/** @internal */
var TypeId$18 = "~effect/DateTime";
/** @internal */
var TimeZoneTypeId = "~effect/DateTime/TimeZone";
var Proto$8 = {
	[TypeId$18]: TypeId$18,
	pipe() {
		return pipeArguments(this, arguments);
	},
	[NodeInspectSymbol]() {
		return this.toString();
	},
	toJSON() {
		return toDateUtc$1(this).toJSON();
	}
};
var ProtoUtc = {
	...Proto$8,
	_tag: "Utc",
	[symbol$1]() {
		return number$1(this.epochMilliseconds);
	},
	[symbol](that) {
		return isDateTime$1(that) && that._tag === "Utc" && this.epochMilliseconds === that.epochMilliseconds;
	},
	toString() {
		return `DateTime.Utc(${toDateUtc$1(this).toJSON()})`;
	}
};
var ProtoZoned = {
	...Proto$8,
	_tag: "Zoned",
	[symbol$1]() {
		return combine(number$1(this.epochMilliseconds))(hash(this.zone));
	},
	[symbol](that) {
		return isDateTime$1(that) && that._tag === "Zoned" && this.epochMilliseconds === that.epochMilliseconds && equals$1(this.zone, that.zone);
	},
	toString() {
		return `DateTime.Zoned(${formatIsoZoned(this)})`;
	}
};
var ProtoTimeZone = {
	[TimeZoneTypeId]: TimeZoneTypeId,
	[NodeInspectSymbol]() {
		return this.toString();
	}
};
({ ...ProtoTimeZone });
({ ...ProtoTimeZone });
var cacheSlot = {
	value: void 0,
	enumerable: false,
	writable: true
};
var sealedCaches = /*#__PURE__*/ new WeakMap();
var cacheAccessor = (key, slots) => ({
	get() {
		return Object.isExtensible(this) ? void 0 : sealedCaches.get(this)?.[key];
	},
	set(value) {
		if (Object.isExtensible(this)) {
			for (const slot of slots) Object.defineProperty(this, slot, cacheSlot);
			this[key] = value;
		} else {
			let caches = sealedCaches.get(this);
			if (caches === void 0) {
				caches = {};
				sealedCaches.set(this, caches);
			}
			caches[key] = value;
		}
	}
});
var zonedSlots = [
	"partsUtc",
	"adjustedEpochMilliseconds",
	"partsAdjusted"
];
Object.defineProperty(ProtoUtc, "partsUtc", cacheAccessor("partsUtc", ["partsUtc"]));
Object.defineProperties(ProtoZoned, {
	partsUtc: cacheAccessor("partsUtc", zonedSlots),
	adjustedEpochMilliseconds: cacheAccessor("adjustedEpochMilliseconds", zonedSlots),
	partsAdjusted: cacheAccessor("partsAdjusted", zonedSlots)
});
/** @internal */
var isDateTime$1 = (u) => hasProperty(u, TypeId$18);
/** @internal */
var toDateUtc$1 = (self) => new Date(self.epochMilliseconds);
/** @internal */
var toDate = (self) => {
	if (self._tag === "Utc") return new Date(self.epochMilliseconds);
	else if (self.zone._tag === "Offset") return new Date(self.epochMilliseconds + self.zone.offset);
	else if (self.adjustedEpochMilliseconds !== void 0) return new Date(self.adjustedEpochMilliseconds);
	let bc = false;
	const parts = self.zone.format.formatToParts(self.epochMilliseconds).filter((_) => {
		if (_.type === "era") {
			bc = _.value === "BC";
			return false;
		}
		return _.type !== "literal";
	});
	const year = Number(parts[2].value);
	const date = /* @__PURE__ */ new Date(0);
	date.setUTCFullYear(bc ? 1 - year : year, Number(parts[0].value) - 1, Number(parts[1].value));
	date.setUTCHours(Number(parts[3].value), Number(parts[4].value), Number(parts[5].value), parts[6]?.type === "fractionalSecond" ? Number(parts[6].value) : (self.epochMilliseconds % 1e3 + 1e3) % 1e3);
	self.adjustedEpochMilliseconds = date.getTime();
	return date;
};
/** @internal */
var zonedOffset = (self) => {
	return toDate(self).getTime() - toEpochMillis$1(self);
};
var offsetToString = (offset) => {
	const abs = Math.abs(offset);
	let hours = Math.floor(abs / 36e5);
	let minutes = Math.round(abs % 36e5 / 6e4);
	if (minutes === 60) {
		hours += 1;
		minutes = 0;
	}
	return `${offset < 0 ? "-" : "+"}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};
/** @internal */
var zonedOffsetIso = (self) => offsetToString(zonedOffset(self));
/** @internal */
var toEpochMillis$1 = (self) => self.epochMilliseconds;
/** @internal */
var formatIsoOffset = (self) => {
	const date = toDate(self);
	return self._tag === "Utc" ? date.toISOString() : `${date.toISOString().slice(0, -1)}${zonedOffsetIso(self)}`;
};
/** @internal */
var formatIsoZoned = (self) => self.zone._tag === "Offset" ? formatIsoOffset(self) : `${formatIsoOffset(self)}[${self.zone.id}]`;
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Effect.js
/**
* Checks whether a value is an `Effect`.
*
* **Example** (Checking whether a value is an Effect)
*
* ```ts import.meta.vitest
* import { Effect } from "effect"
*
* Effect.isEffect(Effect.succeed(1)) // => true
* Effect.isEffect("hello") // => false
* ```
*
* @stability stable
* @category guards
* @since 2.0.0
*/
var isEffect = isEffect$1;
/**
* Creates an `Effect` that always succeeds with a given value.
*
* **When to use**
*
* Use when an effect should complete successfully with a specific value without any errors
* or external dependencies.
*
* **Example** (Creating a successful effect)
*
* ```ts import.meta.vitest
* import { Effect } from "effect"
*
* // Creating an effect that represents a successful scenario
* //
* //      ┌─── Effect<number, never, never>
* //      ▼
* const success = Effect.succeed(42)
* Effect.runSync(success) // => 42
* ```
*
* @see {@link fail} to create an effect that represents a failure.
* @stability stable
* @category constructors
* @since 2.0.0
*/
var succeed$1 = succeed$3;
/**
* Creates an `Effect` lazily, delaying construction until it is needed.
*
* **When to use**
*
* Use when you need to defer the evaluation of an effect until it is required.
*
* **Details**
*
* `suspend` takes a thunk that represents an effect and delays creating it
* until the suspended effect is evaluated. This is useful for optimizing
* expensive computations, managing circular dependencies such as recursive
* functions, and helping TypeScript unify return types when branches construct
* different effects. Any side effects or scoped captures inside the thunk are
* re-executed on each invocation.
*
* **Example** (Lazily evaluating side effects)
*
* ```ts import.meta.vitest
* import { Effect } from "effect"
*
* let i = 0
*
* const bad = Effect.succeed(i++)
*
* const good = Effect.suspend(() => Effect.succeed(i++))
*
* Effect.runSync(bad) // => 0
* Effect.runSync(bad) // => 0
*
* Effect.runSync(good) // => 1
* Effect.runSync(good) // => 2
* ```
*
* **Example** (Suspending recursive Fibonacci evaluation)
*
* ```ts import.meta.vitest
* import { Effect } from "effect"
*
* const blowsUp = (n: number): Effect.Effect<number> =>
*   n < 2
*     ? Effect.succeed(1)
*     : Effect.zipWith(blowsUp(n - 1), blowsUp(n - 2), (a, b) => a + b)
*
* // console.log(Effect.runSync(blowsUp(32)))
* // crash: JavaScript heap out of memory
*
* const allGood = (n: number): Effect.Effect<number> =>
*   n < 2
*     ? Effect.succeed(1)
*     : Effect.zipWith(
*         Effect.suspend(() => allGood(n - 1)),
*         Effect.suspend(() => allGood(n - 2)),
*         (a, b) => a + b
*       )
*
* Effect.runSync(allGood(16)) // => 1597
* ```
*
* **Example** (Helping TypeScript infer recursive effect types)
*
* ```ts import.meta.vitest
* import { Effect } from "effect"
*
* //   Without suspend, TypeScript may struggle with type inference.
* //   Inferred type:
* //     (a: number, b: number) =>
* //       Effect<never, Error, never> | Effect<number, never, never>
* const withoutSuspend = (a: number, b: number) =>
*   b === 0
*     ? Effect.fail(new Error("Cannot divide by zero"))
*     : Effect.succeed(a / b)
*
* //   Using suspend to unify return types.
* //   Inferred type:
* //     (a: number, b: number) => Effect<number, Error, never>
* const withSuspend = (a: number, b: number) =>
*   Effect.suspend(() =>
*     b === 0
*       ? Effect.fail(new Error("Cannot divide by zero"))
*       : Effect.succeed(a / b)
*   )
*
* Effect.runSync(withSuspend(6, 2)) // => 3
* ```
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var suspend = suspend$1;
/**
* Provides a way to write effectful code using generator functions, simplifying
* control flow and error handling.
*
* **When to use**
*
* Use when you want to write effectful code that looks and behaves like
* synchronous code, while still handling asynchronous tasks, errors, and complex
* control flow such as loops and conditions.
*
* Generator functions work similarly to `async/await` but keep errors,
* requirements, and interruption in the Effect type. You can `yield*` values
* from effects and return the final result at the end.
*
* **Example** (Sequencing effects with generators)
*
* ```ts import.meta.vitest
* import { Data, Effect } from "effect"
*
* class DiscountRateError extends Data.TaggedError("DiscountRateError")<{}> {}
*
* const addServiceCharge = (amount: number) => amount + 1
*
* const applyDiscount = (
*   total: number,
*   discountRate: number
* ): Effect.Effect<number, DiscountRateError> =>
*   discountRate === 0
*     ? Effect.fail(new DiscountRateError())
*     : Effect.succeed(total - (total * discountRate) / 100)
*
* const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))
*
* const fetchDiscountRate = Effect.promise(() => Promise.resolve(5))
*
* export const program = Effect.gen(function*() {
*   const transactionAmount = yield* fetchTransactionAmount
*   const discountRate = yield* fetchDiscountRate
*   const discountedAmount = yield* applyDiscount(
*     transactionAmount,
*     discountRate
*   )
*   const finalAmount = addServiceCharge(discountedAmount)
*   return `Final amount to charge: ${finalAmount}`
* })
*
* await Effect.runPromise(program) // => "Final amount to charge: 96"
* ```
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var gen = gen$1;
/**
* Creates an `Effect` that represents a recoverable error.
*
* **When to use**
*
* Use to explicitly signal a recoverable error in an `Effect`.
*
* **Details**
*
* The error keeps propagating unless it is handled. You can handle tagged
* errors with functions like {@link catchTag} or {@link catchTags}.
*
* **Example** (Creating a failed effect)
*
* ```ts import.meta.vitest
* import { Data, Effect } from "effect"
*
* class OperationFailedError extends Data.TaggedError("OperationFailedError")<{}> {}
*
* //      ┌─── Effect<never, OperationFailedError, never>
* //      ▼
* const failure = Effect.fail(
*   new OperationFailedError()
* )
* Effect.runSync(Effect.flip(failure))._tag // => "OperationFailedError"
* ```
*
* @see {@link succeed} to create an effect that represents a successful value.
* @stability stable
* @category constructors
* @since 2.0.0
*/
var fail$1 = fail$3;
/**
* Creates an `Effect` that represents a failure with a `Cause` computed lazily.
*
* **When to use**
*
* Use to defer computing a full `Cause` until the effect is run.
*
* **Details**
*
* The cause-producing function is evaluated each time the effect is executed.
*
* **Example** (Lazily creating a Cause)
*
* ```ts import.meta.vitest
* import { Cause, Effect } from "effect"
*
* const program = Effect.failCauseSync(() =>
*   Cause.fail("Error computed at runtime")
* )
*
* Effect.runSync(Effect.flip(program)) // => "Error computed at runtime"
* ```
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var failCauseSync = failCauseSync$1;
/**
* Creates an effect that terminates a fiber with a specified error.
*
* **When to use**
*
* Use when you need an `Effect` to report an unrecoverable defect instead of a
* typed error.
*
* **Details**
*
* The `die` function is used to signal a defect, which represents a critical
* and unexpected error in the code. When invoked, it produces an effect that
* does not handle the error and instead terminates the fiber.
*
* The error channel of the resulting effect is of type `never`, indicating that
* it cannot recover from this failure.
*
* **Example** (Failing on division by zero)
*
* ```ts import.meta.vitest
* import { Effect, Exit } from "effect"
*
* const defect = new Error("Cannot divide by zero")
* const divide = (a: number, b: number) =>
*   b === 0
*     ? Effect.die(defect)
*     : Effect.succeed(a / b)
*
* //      ┌─── Effect<number, never, never>
* //      ▼
* const program = divide(1, 0)
*
* Effect.runSyncExit(program) // => Exit.die(defect)
* ```
*
* @stability stable
* @category constructors
* @since 2.0.0
*/
var die = die$2;
var try_ = try_$1;
/**
* Provides access to the current fiber within an effect computation.
*
* **Example** (Reading the current fiber)
*
* ```ts import.meta.vitest
* import { Effect } from "effect"
*
* const program = Effect.withFiber((fiber) => Effect.succeed(typeof fiber.id))
*
* Effect.runSync(program) // => "number"
* ```
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var withFiber = withFiber$1;
/**
* Converts a `Result` to an `Effect`.
*
* **Example** (Converting a Result into an Effect)
*
* ```ts import.meta.vitest
* import { Effect, Result } from "effect"
* const output: Array<unknown> = []
*
* const success = Result.succeed(42)
* const failure = Result.fail("Something went wrong")
*
* const effect1 = Effect.fromResult(success)
* const effect2 = Effect.fromResult(failure)
*
* void output.push(Effect.runSync(effect1))
* void output.push(Effect.runSync(Effect.flip(effect2)))
* output // => [42, "Something went wrong"]
* ```
*
* @stability stable
* @category converting
* @since 4.0.0
*/
var fromResult = fromResult$1;
/**
* Chains effects to produce new `Effect` instances, useful for combining
* operations that depend on previous results.
*
* **When to use**
*
* Use when you need to chain multiple effects, ensuring that each
* step produces a new `Effect` while flattening any nested effects that may
* occur.
*
* **Details**
*
* `flatMap` lets you sequence effects so that the result of one effect can be
* used in the next step. It is similar to `flatMap` used with arrays but works
* specifically with `Effect` instances, allowing you to avoid deeply nested
* effect structures.
*
* Since effects are immutable, `flatMap` always returns a new effect instead of
* changing the original one.
*
* **Example** (Choosing flatMap syntax variants)
*
* ```ts import.meta.vitest
* import { Effect, pipe } from "effect"
* const output: Array<unknown> = []
*
* const myEffect = Effect.succeed(1)
* const transformation = (n: number) => Effect.succeed(n + 1)
*
* const flatMappedWithPipe = pipe(myEffect, Effect.flatMap(transformation))
* const flatMappedWithDataFirst = Effect.flatMap(myEffect, transformation)
* const flatMappedWithMethod = myEffect.pipe(Effect.flatMap(transformation))
*
* void output.push(Effect.runSync(Effect.all([
*   flatMappedWithPipe,
*   flatMappedWithDataFirst,
*   flatMappedWithMethod
* ])))
* output // => [[2, 2, 2]]
* ```
*
* **Example** (Sequencing dependent effects)
*
* ```ts import.meta.vitest
* import { Data, Effect, pipe } from "effect"
*
* class DiscountRateError extends Data.TaggedError("DiscountRateError")<{}> {}
*
* // Function to apply a discount safely to a transaction amount
* const applyDiscount = (
*   total: number,
*   discountRate: number
* ): Effect.Effect<number, DiscountRateError> =>
*   discountRate === 0
*     ? Effect.fail(new DiscountRateError())
*     : Effect.succeed(total - (total * discountRate) / 100)
*
* // Simulated asynchronous task to fetch a transaction amount from database
* const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))
*
* // Chaining the fetch and discount application using `flatMap`
* const finalAmount = pipe(
*   fetchTransactionAmount,
*   Effect.flatMap((amount) => applyDiscount(amount, 5))
* )
*
* await Effect.runPromise(finalAmount) // => 95
* ```
*
* @see {@link tap} for a version that ignores the result of the effect.
* @stability stable
* @category sequencing
* @since 2.0.0
*/
var flatMap = flatMap$1;
/**
* Transforms an effect to encapsulate both failure and success using the `Exit`
* data type.
*
* **When to use**
*
* Use when you need to inspect the full outcome, including typed failures, defects,
* and interruptions.
*
* **Details**
*
* `exit` wraps an effect's success or failure inside an `Exit` type, allowing
* you to handle both cases explicitly.
*
* The resulting effect cannot fail because the failure is encapsulated within
* the `Exit.Failure` type. The error type is set to `never`, indicating that
* the effect is structured to never fail directly.
*
* **Example** (Capturing completion as Exit)
*
* ```ts import.meta.vitest
* import { Effect, Exit } from "effect"
*
* const success = Effect.succeed(42)
* const failure = Effect.fail("Something went wrong")
*
* const program1 = Effect.exit(success)
* const program2 = Effect.exit(failure)
*
* Effect.runSync(program1) // => Exit.succeed(42)
*
* Effect.runSync(program2) // => Exit.fail("Something went wrong")
* ```
*
* @see {@link option} for a version that uses `Option` instead.
* @see {@link result} for a version that uses `Result` instead.
*
* @stability stable
* @category error handling
* @since 2.0.0
*/
var exit = exit$1;
/**
* Transforms the value inside an effect by applying a function to it.
*
* **When to use**
*
* Use to transform an effect's success value with a function that returns a
* plain value, producing a new effect without changing the original effect's
* typed error or context requirements.
*
* **Details**
*
* `map` takes a function and applies it to the value contained within an
* effect, creating a new effect with the transformed value.
*
* It's important to note that effects are immutable, meaning that the original
* effect is not modified. Instead, a new effect is returned with the updated
* value.
*
* **Example** (Choosing map syntax variants)
*
* ```ts import.meta.vitest
* import { Effect, pipe } from "effect"
* const output: Array<unknown> = []
*
* const myEffect = Effect.succeed(1)
* const transformation = (n: number) => n + 1
*
* const mappedWithPipe = pipe(myEffect, Effect.map(transformation))
* const mappedWithDataFirst = Effect.map(myEffect, transformation)
* const mappedWithMethod = myEffect.pipe(Effect.map(transformation))
*
* void output.push(Effect.runSync(Effect.all([
*   mappedWithPipe,
*   mappedWithDataFirst,
*   mappedWithMethod
* ])))
* output // => [[2, 2, 2]]
* ```
*
* **Example** (Adding a service charge)
*
* ```ts import.meta.vitest
* import { Effect, pipe } from "effect"
*
* const addServiceCharge = (amount: number) => amount + 1
*
* const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100))
*
* const finalAmount = pipe(
*   fetchTransactionAmount,
*   Effect.map(addServiceCharge)
* )
*
* await Effect.runPromise(finalAmount) // => 101
* ```
*
* @see {@link mapError} for a version that operates on the error channel.
* @see {@link mapBoth} for a version that operates on both channels.
* @see {@link flatMap} or {@link andThen} for a version that can return a new effect.
* @stability stable
* @category mapping
* @since 2.0.0
*/
var map$1 = map$3;
/**
* Handles both recoverable and unrecoverable errors by providing a recovery
* effect.
*
* **When to use**
*
* Use when you need to recover from an `Effect` by inspecting the full `Cause`,
* including recoverable failures, defects, and interruptions, instead of only
* the typed error value.
*
* **Details**
*
* When to Recover from Defects:
*
* Defects are unexpected errors that typically shouldn't be recovered from, as
* they often indicate serious issues. However, in some cases, such as
* dynamically loaded plugins, controlled recovery might be needed.
*
* **Example** (Recovering from full failure causes)
*
* ```ts import.meta.vitest
* import { Cause, Effect } from "effect"
* const output: Array<unknown> = []
*
* // An effect that might fail in different ways
* const program = Effect.die("Something went wrong")
*
* // Recover from any cause (including defects)
* const recovered = Effect.catchCause(program, (cause) => {
*   if (Cause.hasDies(cause)) {
*     return Effect.sync(() => { output.push("Caught defect") }).pipe(
*       Effect.as("Recovered from defect")
*     )
*   }
*   return Effect.succeed("Unknown error")
* })
*
* void output.push(Effect.runSync(recovered))
* output // => ["Caught defect", "Recovered from defect"]
* ```
*
* @stability stable
* @category error handling
* @since 4.0.0
*/
var catchCause = catchCause$1;
/**
* Returns the complete context.
*
* **When to use**
*
* Use to read the complete `Context` available to the current effect.
*
* **Details**
*
* This function allows you to access all services that are currently available
* in the effect's environment. This can be useful for debugging, introspection,
* or when you need to pass the entire context to another function.
*
* **Example** (Reading the full context)
*
* ```ts import.meta.vitest
* import { Context, Effect, Option } from "effect"
* const output: Array<unknown> = []
*
* const Logger = Context.Service<{
*   log: (msg: string) => void
* }>("Logger")
* const Database = Context.Service<{
*   query: (sql: string) => string
* }>("Database")
*
* const program = Effect.gen(function*() {
*   const allServices = yield* Effect.context()
*
*   // Check if specific services are available
*   const loggerOption = Context.getOption(allServices, Logger)
*   const databaseOption = Context.getOption(allServices, Database)
*
*   yield* Effect.sync(() => { output.push(`Logger available: ${Option.isSome(loggerOption)}`) })
*   yield* Effect.sync(() => { output.push(`Database available: ${Option.isSome(databaseOption)}`) })
* })
*
* const context = Context.make(Logger, { log: () => {} })
*   .pipe(Context.add(Database, { query: () => "result" }))
*
* const provided = Effect.provideContext(program, context)
* Effect.runSync(provided)
* output // => ["Logger available: true", "Database available: true"]
* ```
*
* @see {@link contextWith} for deriving an effect from the complete context
* @see {@link service} for reading one service from the context
*
* @stability stable
* @category accessors
* @since 2.0.0
*/
var context = context$1;
/**
* Runs an effect synchronously and captures the outcome safely as an `Exit` type, which
* represents the outcome (success or failure) of the effect.
*
* **When to use**
*
* Use to find out whether an effect succeeded or failed,
* including any defects, without dealing with asynchronous operations.
*
* **Details**
*
* The `Exit` type represents the result of the effect. Successful effects are
* wrapped in `Success`, and failed effects are wrapped in `Failure` with a
* `Cause`.
*
* If the effect contains asynchronous operations, `runSyncExit` will
* return an `Failure` with a `Die` cause, indicating that the effect cannot be
* resolved synchronously.
*
* **Example** (Observing synchronous results as Exit)
*
* ```ts import.meta.vitest
* import { Effect, Exit } from "effect"
*
* Effect.runSyncExit(Effect.succeed(1)) // => Exit.succeed(1)
*
* Effect.runSyncExit(Effect.fail("my error")) // => Exit.fail("my error")
* ```
*
* **Example** (Capturing async work as a Die cause)
*
* ```ts import.meta.vitest
* import { Cause, Effect, Exit } from "effect"
*
* const exit = Effect.runSyncExit(Effect.promise(() => Promise.resolve(1)))
* const isAsyncDie = Exit.isFailure(exit) && Exit.hasDies(exit) && exit.cause.reasons.some(
*   (reason) => Cause.isDieReason(reason) && Cause.isAsyncFiberError(reason.defect)
* )
*
* isAsyncDie // => true
* ```
*
* @see {@link runSync} for a version that throws on failure.
*
* @stability stable
* @category running
* @since 2.0.0
*/
var runSyncExit = runSyncExit$1;
/**
* Applies `map` eagerly when an effect is already resolved.
*
* **When to use**
*
* Use when an already-resolved effect should apply a success transformation
* immediately while pending effects still use regular mapping.
*
* **Details**
*
* Success effects apply the mapping function immediately. Failure effects pass
* through unchanged, and pending effects fall back to regular `map` behavior.
*
* **Example** (Mapping already completed effects)
*
* ```ts import.meta.vitest
* import { Effect } from "effect"
*
* // For resolved effects, the mapping is applied immediately
* const resolved = Effect.succeed(5)
* const mapped = Effect.mapEager(resolved, (n) => n * 2) // Applied eagerly
*
* // For pending effects, behaves like regular map
* const pending = Effect.delay(Effect.succeed(5), 0)
* const mappedPending = Effect.mapEager(pending, (n) => n * 2) // Uses regular map
*
* await Effect.runPromise(Effect.all([mapped, mappedPending])) // => [10, 10]
* ```
*
* @stability stable
* @category mapping
* @since 4.0.0
*/
var mapEager = mapEager$1;
/**
* Applies `mapError` eagerly when an effect is already resolved.
*
* **When to use**
*
* Use when an already-resolved failed effect should apply an error
* transformation immediately while pending effects still use regular error
* mapping.
*
* **Details**
*
* Success effects pass through unchanged because there is no error to
* transform. Failure effects apply the mapping function immediately, and
* pending effects fall back to regular `mapError` behavior.
*
* Maps every typed error in the cause, preserving defects, interrupts and
* reason order. Unlike typed recovery, mapping does not convert errors to defects.
*
* **Example** (Mapping errors eagerly when possible)
*
* ```ts import.meta.vitest
* import { Effect } from "effect"
* const output: Array<unknown> = []
*
* // For resolved failure effects, the error mapping is applied immediately
* const failed = Effect.fail("original error")
* const mapped = Effect.mapErrorEager(failed, (err: string) => `mapped: ${err}`) // Applied eagerly
*
* // For pending effects, behaves like regular mapError
* const pending = Effect.delay(Effect.fail("error"), 0)
* const mappedPending = Effect.mapErrorEager(
*   pending,
*   (err: string) => `mapped: ${err}`
* ) // Uses regular mapError
*
* void output.push(await Effect.runPromise(Effect.all([
*   Effect.flip(mapped),
*   Effect.flip(mappedPending)
* ])))
* output // => [['mapped: original error', 'mapped: error']]
* ```
*
* @stability stable
* @category error handling
* @since 4.0.0
*/
var mapErrorEager = mapErrorEager$1;
/**
* Applies `flatMap` eagerly when an effect is already resolved.
*
* **When to use**
*
* Use when an already-resolved successful effect should bind immediately to the
* next effect while pending effects still use regular flat mapping.
*
* **Details**
*
* Success effects apply the flatMap function immediately. Failure effects pass
* through unchanged, and pending effects fall back to regular `flatMap`
* behavior.
*
* **Example** (Flat mapping eagerly when possible)
*
* ```ts import.meta.vitest
* import { Effect } from "effect"
*
* // For resolved effects, the flatMap is applied immediately
* const resolved = Effect.succeed(5)
* const flatMapped = Effect.flatMapEager(resolved, (n) => Effect.succeed(n * 2)) // Applied eagerly
*
* // For pending effects, behaves like regular flatMap
* const pending = Effect.delay(Effect.succeed(5), 0)
* const flatMappedPending = Effect.flatMapEager(
*   pending,
*   (n) => Effect.succeed(n * 2)
* ) // Uses regular flatMap
*
* await Effect.runPromise(Effect.all([flatMapped, flatMappedPending])) // => [10, 10]
* ```
*
* @stability stable
* @category sequencing
* @since 4.0.0
*/
var flatMapEager = flatMapEager$1;
/**
* Creates untraced function effects with eager evaluation optimization.
*
* **Details**
*
* Executes generator functions eagerly when all yielded effects are synchronous,
* stopping at the first async effect and deferring to normal execution.
* Additional arguments after the generator body act like `pipe` transforms, and
* `{ self }` before the body binds `this`, as with {@link fnUntraced}.
*
* **Example** (Defining eager untraced effect functions)
*
* ```ts import.meta.vitest
* import { Effect } from "effect"
*
* const computation = Effect.fnUntracedEager(function*() {
*   yield* Effect.succeed(1)
*   yield* Effect.succeed(2)
*   return "computed eagerly"
* })
*
* const effect = computation() // Executed immediately if all effects are sync
* Effect.runSync(effect) // => "computed eagerly"
* ```
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var fnUntracedEager = fnUntracedEager$1;
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/base64.js
/**
* Decodes `str` with native `Uint8Array.fromBase64`.
*
* Returns `undefined` when native decoding is unavailable or skipped for a
* short input, and `null` when native decoding rejected the input. In both
* cases the caller's JS path produces the module's own result or error.
*
* Native decoding also skips ASCII whitespace and accepts missing padding, so
* callers validate the length and padding first and pass the byte length a
* valid input decodes to. Skipped whitespace always yields fewer bytes, so a
* result of any other length counts as rejected.
*
* @internal
*/
var decodeNative = (str, decodedLength, options) => {
	if (str.length < 128) return void 0;
	const NativeUint8Array = Uint8Array;
	if (typeof NativeUint8Array.fromBase64 !== "function") return void 0;
	try {
		const bytes = NativeUint8Array.fromBase64(str, options);
		return bytes.length === decodedLength ? bytes : null;
	} catch {
		return null;
	}
};
/** @internal */
var stripCrlf = (str) => str.indexOf("\n") === -1 && str.indexOf("\r") === -1 ? str : str.replace(/[\n\r]/g, "");
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/encoding/Base64.js
/**
* Base64 encoding and decoding helpers.
*
* @stability stable
* @since 4.0.0
*/
/**
* Encodes the given value into a Base64 (RFC 4648) string.
*
* **When to use**
*
* Use to encode text or bytes as a standard padded Base64 string for storage or
* transport.
*
* **Details**
*
* String inputs are encoded as UTF-8 bytes before Base64 encoding.
* `Uint8Array` inputs are encoded directly. The output uses the standard
* RFC 4648 alphabet with `=` padding.
*
* **Example** (Encoding Base64 strings and bytes)
*
* ```ts import.meta.vitest
* import { Base64 } from "effect/encoding"
*
* Base64.encode("hello") // => "aGVsbG8="
*
* const bytes = new Uint8Array([72, 101, 108, 108, 111])
* Base64.encode(bytes) // => "SGVsbG8="
* ```
*
* @see {@link decode} for decoding standard Base64 to bytes
* @see {@link decodeString} for decoding standard Base64 to UTF-8 text
*
* @stability stable
* @category encoding
* @since 4.0.0
*/
var encode = (input) => encodeBytes(typeof input === "string" ? encoder$1.encode(input) : input);
/**
* Decodes a Base64 (RFC 4648) string into bytes safely.
*
* **When to use**
*
* Use to decode a standard padded Base64 string into bytes without throwing on
* invalid input.
*
* **Details**
*
* Returns `Result.succeed` with a `Uint8Array` when decoding succeeds, or
* `Result.fail` with an `EncodingError` when the input is not valid Base64.
*
* **Example** (Decoding Base64 bytes)
*
* ```ts import.meta.vitest
* import { Result } from "effect"
* import { Base64 } from "effect/encoding"
*
* Base64.decode("SGVsbG8=") // => Result.succeed(new Uint8Array([72, 101, 108, 108, 111]))
* ```
*
* @stability stable
* @category decoding
* @since 4.0.0
*/
var decode = (str) => {
	const stripped = stripCrlf(str);
	const length = stripped.length;
	if (length % 4 !== 0) return fail$4(new EncodingError({
		kind: "Decode",
		module: "Base64",
		input: stripped,
		message: `Length must be a multiple of 4, but is ${length}`
	}));
	const index = stripped.indexOf("=");
	if (index !== -1 && (index < length - 2 || index === length - 2 && stripped[length - 1] !== "=")) return fail$4(new EncodingError({
		kind: "Decode",
		module: "Base64",
		input: stripped,
		message: "Found a '=' character, but it is not at the end"
	}));
	const missingOctets = stripped.endsWith("==") ? 2 : stripped.endsWith("=") ? 1 : 0;
	const decodedLength = 3 * (length / 4) - missingOctets;
	const native = decodeNative(stripped, decodedLength, void 0);
	if (native) return succeed$4(native);
	if (native === null) {
		const invalid = invalidCharacter.exec(stripped);
		if (invalid !== null) return fail$4(new EncodingError({
			kind: "Decode",
			module: "Base64",
			input: stripped,
			message: `Invalid character ${invalid[0]}`
		}));
	}
	try {
		const result = new Uint8Array(decodedLength);
		for (let i = 0, j = 0; i < length; i += 4, j += 3) {
			const buffer = getCode(stripped.charCodeAt(i)) << 18 | getCode(stripped.charCodeAt(i + 1)) << 12 | getCode(stripped.charCodeAt(i + 2)) << 6 | getCode(stripped.charCodeAt(i + 3));
			result[j] = buffer >> 16;
			result[j + 1] = buffer >> 8 & 255;
			result[j + 2] = buffer & 255;
		}
		return succeed$4(result);
	} catch (cause) {
		return fail$4(new EncodingError({
			kind: "Decode",
			module: "Base64",
			input: stripped,
			message: cause instanceof Error ? cause.message : "Invalid input"
		}));
	}
};
var encodeBytes = (bytes) => {
	const length = bytes.length;
	const toBase64 = Uint8Array.prototype.toBase64;
	if (length >= 32 && typeof toBase64 === "function") return toBase64.call(bytes);
	return length < 128 ? encodeShort(bytes) : encodeLong(bytes);
};
var encodeShort = (bytes) => {
	const length = bytes.length;
	let result = "";
	let i = 2;
	for (; i < length; i += 3) {
		result += alphabet[bytes[i - 2] >> 2];
		result += alphabet[(bytes[i - 2] & 3) << 4 | bytes[i - 1] >> 4];
		result += alphabet[(bytes[i - 1] & 15) << 2 | bytes[i] >> 6];
		result += alphabet[bytes[i] & 63];
	}
	if (i === length + 1) {
		result += alphabet[bytes[i - 2] >> 2];
		result += alphabet[(bytes[i - 2] & 3) << 4];
		result += "==";
	}
	if (i === length) {
		result += alphabet[bytes[i - 2] >> 2];
		result += alphabet[(bytes[i - 2] & 3) << 4 | bytes[i - 1] >> 4];
		result += alphabet[(bytes[i - 1] & 15) << 2];
		result += "=";
	}
	return result;
};
var encodeLong = (bytes) => {
	const length = bytes.length;
	const result = new Uint8Array(Math.ceil(length / 3) * 4);
	let i;
	let j = 0;
	for (i = 2; i < length; i += 3, j += 4) {
		result[j] = alphabetCodes[bytes[i - 2] >> 2];
		result[j + 1] = alphabetCodes[(bytes[i - 2] & 3) << 4 | bytes[i - 1] >> 4];
		result[j + 2] = alphabetCodes[(bytes[i - 1] & 15) << 2 | bytes[i] >> 6];
		result[j + 3] = alphabetCodes[bytes[i] & 63];
	}
	if (i === length + 1) {
		result[j] = alphabetCodes[bytes[i - 2] >> 2];
		result[j + 1] = alphabetCodes[(bytes[i - 2] & 3) << 4];
		result[j + 2] = paddingCode;
		result[j + 3] = paddingCode;
	}
	if (i === length) {
		result[j] = alphabetCodes[bytes[i - 2] >> 2];
		result[j + 1] = alphabetCodes[(bytes[i - 2] & 3) << 4 | bytes[i - 1] >> 4];
		result[j + 2] = alphabetCodes[(bytes[i - 1] & 15) << 2];
		result[j + 3] = paddingCode;
	}
	return decoder.decode(result);
};
var encoder$1 = /*#__PURE__*/ new TextEncoder();
var decoder = /*#__PURE__*/ new TextDecoder("utf-8", { ignoreBOM: true });
var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var alphabetCodes = /*#__PURE__*/ encoder$1.encode(alphabet);
var paddingCode = /*#__PURE__*/ "=".charCodeAt(0);
var invalidCharacter = /[^A-Za-z0-9+/=]/;
var codes = /*#__PURE__*/ (/* @__PURE__ */ new Uint8Array(123)).fill(255);
for (let i = 0; i < 64; i++) codes[/*#__PURE__*/ alphabet.charCodeAt(i)] = i;
codes[/*#__PURE__*/ "=".charCodeAt(0)] = 0;
var getCode = (charCode) => {
	if (charCode >= codes.length || codes[charCode] === 255) throw new TypeError(`Invalid character ${String.fromCharCode(charCode)}`);
	return codes[charCode];
};
({ ...BaseProto });
({ ...BaseProto });
({ ...PipeInspectableProto });
BaseProto.toString, BaseProto[NodeInspectSymbol];
({ ...PipeInspectableProto });
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/schema/annotations.js
/** @internal */
function resolve$1(ast) {
	return ast.checks ? ast.checks[ast.checks.length - 1].annotations : ast.annotations;
}
/** @internal */
function resolveAt$1(key) {
	return (ast) => resolve$1(ast)?.[key];
}
/** @internal */
var STRUCTURAL_ANNOTATION_KEY = "~structural";
/** @internal */
var IDENTIFIER_FALLBACK_KEY = "~identifier";
/** @internal */
var SENTINELS_ANNOTATION_KEY = "~sentinels";
/** @internal */
var CONSTRUCTOR_ANNOTATION_KEY = "~constructor";
/** @internal */
var jsonSchemaAnnotationKeys = [
	"title",
	"description",
	"default",
	"examples",
	"readOnly",
	"writeOnly",
	"format",
	"contentEncoding",
	"contentMediaType",
	"contentSchema"
];
/** @internal */
var resolveIdentifier = /*#__PURE__*/ resolveAt$1("identifier");
/** @internal */
var resolveIdentifierFallback = /*#__PURE__*/ resolveAt$1(IDENTIFIER_FALLBACK_KEY);
/** @internal */
var getExpected = /*#__PURE__*/ memoize((ast) => {
	const identifier = resolve$1(ast)?.identifier;
	if (typeof identifier === "string") return identifier;
	return ast.getExpected(getExpected);
});
/** @internal */
var annotationExcludedKeys = /*#__PURE__*/ new Set([
	SENTINELS_ANNOTATION_KEY,
	STRUCTURAL_ANNOTATION_KEY,
	"representation",
	"arbitraryConstraint",
	"toJsonSchema",
	"toCode",
	"toEquivalence",
	"toFormatter",
	"toCodec",
	"toCodecJson",
	"toCodecStringTree",
	"toCodecIso",
	"toCodecArbitrary"
]);
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/schema/parser.js
/** @internal */
var missing = /*#__PURE__*/ Symbol.for("effect/schema/parser/missing");
/** @internal */
var succeed = succeed$2;
/** @internal */
var missingExit = /*#__PURE__*/ succeed(missing);
/** @internal */
var sameExit = /*#__PURE__*/ Object.assign(/*#__PURE__*/ succeed(missing), { [missing]: true });
/** @internal */
var isSameExit = (result) => result[missing] === true;
/** @internal */
var toOption = (value) => value === missing ? none() : some(value);
/** @internal */
var fromOptionExit = (option) => option._tag === "None" ? missingExit : succeed(option.value);
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/SchemaIssue.js
/**
* Describes problems found while decoding, encoding, or checking data with
* schemas.
*
* An `Issue` records what failed and, for nested data, where the failure
* happened. The Schema system uses these values for missing keys, unexpected
* keys, invalid types, invalid values, failed filters, failed transformations,
* and alternatives that did not match. This module also formats issues.
*
* @stability stable
* @since 4.0.0
*/
var TypeId$13 = "~effect/SchemaIssue/Issue";
/**
* Returns `true` if the given value is an {@link Issue}.
*
* **When to use**
*
* Use when you need to narrow an `unknown` value to `Issue` in error-handling
* code, such as distinguishing an `Issue` from other error types in a catch-all
* handler.
*
* **Details**
*
* - Checks for the internal `TypeId` brand on the value.
*
* **Example** (Type-guarding an unknown error)
*
* ```ts import.meta.vitest
* import { SchemaIssue } from "effect"
*
* const issue = new SchemaIssue.MissingKey(undefined)
* SchemaIssue.isIssue(issue) // => true
* SchemaIssue.isIssue("not an issue") // => false
* ```
*
* @see {@link Issue}
*
* @stability stable
* @category guards
* @since 4.0.0
*/
function isIssue(u) {
	return hasProperty(u, TypeId$13) && u[TypeId$13] === TypeId$13;
}
/**
* Returns `true` when an issue contains an input reported by the schema parser.
*
* **When to use**
*
* Use when reading `Issue.input`, especially when `undefined` is a valid input
* value.
*
* **Details**
*
* Reported input is stored as an own property. This guard checks for that
* property and narrows `input` from optional to required.
*
* **Example** (Reading a reported input)
*
* ```ts import.meta.vitest
* import { Result, Schema, SchemaIssue } from "effect"
*
* const result = Schema.decodeUnknownResult(Schema.String)(1, { reportInput: true })
* if (Result.isFailure(result) && SchemaIssue.hasInput(result.failure.issue)) {
*   result.failure.issue.input // => 1
* }
* ```
*
* @see {@link Issue} for the complete issue model
*
* @stability stable
* @category guards
* @since 4.0.0
*/
function hasInput(issue) {
	return Object.hasOwn(issue, "input");
}
var IssueNodeImpl = class {
	[TypeId$13] = TypeId$13;
	constructor(input, options) {
		if (options?.reportInput === true && input !== missing) this.input = input;
	}
};
/**
* Constructs a schema issue for a failed refinement check.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Filter$1 = class extends IssueNodeImpl {
	_tag = "Filter";
	/**
	* The filter that failed.
	*/
	filter;
	/**
	* The issue that occurred.
	*/
	issue;
	constructor(filter, issue, input, options) {
		super(input, options);
		this.filter = filter;
		this.issue = issue;
	}
};
/**
* Constructs a schema issue for a failed transformation.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Encoding = class extends IssueNodeImpl {
	_tag = "Encoding";
	/**
	* The schema that caused the issue.
	*/
	ast;
	/**
	* The issue that occurred.
	*/
	issue;
	constructor(ast, issue, input, options) {
		super(input, options);
		this.ast = ast;
		this.issue = issue;
	}
};
/**
* Constructs a schema issue that points to a nested location.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Pointer = class extends IssueNodeImpl {
	_tag = "Pointer";
	/**
	* The path to the location in the input that caused the issue.
	*/
	path;
	/**
	* The issue that occurred.
	*/
	issue;
	constructor(path, issue) {
		super();
		this.path = path;
		this.issue = issue;
	}
};
/**
* Constructs a schema issue for a missing key or tuple index.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var MissingKey = class extends IssueNodeImpl {
	_tag = "MissingKey";
	/**
	* The metadata for the issue.
	*/
	annotations;
	constructor(annotations) {
		super();
		this.annotations = annotations;
	}
};
/**
* Constructs a schema issue for an unexpected key or tuple index.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var UnexpectedKey = class extends IssueNodeImpl {
	_tag = "UnexpectedKey";
	/**
	* The schema that caused the issue.
	*/
	ast;
	constructor(ast, input, options) {
		super(input, options);
		this.ast = ast;
	}
};
/**
* Constructs a schema issue that groups multiple child issues.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Composite = class extends IssueNodeImpl {
	_tag = "Composite";
	/**
	* The schema that caused the issue.
	*/
	ast;
	/**
	* The issues that occurred.
	*/
	issues;
	constructor(ast, issues, input, options) {
		super(input, options);
		this.ast = ast;
		this.issues = issues;
	}
};
/**
* Constructs a schema issue for an input with an invalid runtime type.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var InvalidType = class extends IssueNodeImpl {
	_tag = "InvalidType";
	/**
	* The schema that caused the issue.
	*/
	ast;
	constructor(ast, input, options) {
		super(input, options);
		this.ast = ast;
	}
};
/**
* Constructs a schema issue for a value that violates a constraint.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var InvalidValue = class extends IssueNodeImpl {
	_tag = "InvalidValue";
	/**
	* The metadata for the issue.
	*/
	annotations;
	constructor(annotations, input, options) {
		super(input, options);
		this.annotations = annotations;
	}
};
/**
* Constructs a schema issue for a value that matches no union member.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var AnyOf = class extends IssueNodeImpl {
	_tag = "AnyOf";
	/**
	* The schema that caused the issue.
	*/
	ast;
	/**
	* The issues that occurred.
	*/
	issues;
	constructor(ast, issues, input, options) {
		super(input, options);
		this.ast = ast;
		this.issues = issues;
	}
};
/**
* Constructs a schema issue for a value that matches multiple union members.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var OneOf = class extends IssueNodeImpl {
	_tag = "OneOf";
	/**
	* The schema that caused the issue.
	*/
	ast;
	/**
	* The schemas that were successful.
	*/
	successes;
	constructor(ast, successes, input, options) {
		super(input, options);
		this.ast = ast;
		this.successes = successes;
	}
};
function makeFilterIssue(entry, input, options) {
	if (isIssue(entry)) return entry;
	if (typeof entry === "string") return new InvalidValue({ message: entry }, input, options);
	const inner = typeof entry.issue === "string" ? new InvalidValue({ message: entry.issue }, input, options) : entry.issue;
	return new Pointer(entry.path, inner);
}
/** @internal */
function makeSingle(out, input, options) {
	if (out === void 0) return;
	if (typeof out === "boolean") return out ? void 0 : new InvalidValue(void 0, input, options);
	return makeFilterIssue(out, input, options);
}
/** @internal */
function normalizeFilterOutput(ast, out, input, options) {
	if (Array.isArray(out)) {
		if (!isReadonlyArrayNonEmpty(out)) return;
		return out.length === 1 ? makeFilterIssue(out[0], input, options) : new Composite(ast, map$4(out, (entry) => makeFilterIssue(entry, input, options)), input, options);
	}
	return makeSingle(out, input, options);
}
/**
* Returns the built-in {@link LeafHook} used by default formatters.
*
* **When to use**
*
* Use as the default leaf renderer when customizing only the {@link CheckHook}.
*
* **Details**
*
* - Checks for a `message` annotation first; returns it if present.
* - For `InvalidValue`, an `expected` annotation uses the standard expected
*   value message and includes reported input when available.
* - Otherwise generates a default message per `_tag`. When the issue reports
*   input, the message includes its formatted value where applicable:
*   - `InvalidType` → `"Expected <type>"` or `"Expected <type>, got <input>"`
*   - `InvalidValue` → `"Expected a valid value"` or `"Invalid data <input>"`
*   - `MissingKey` → `"Missing key"`
*   - `UnexpectedKey` → `"Expected no excess property"` or
*     `"Unexpected key with value <input>"`
*   - `Forbidden` → `"Forbidden operation"`
*   - `OneOf` → `"Expected exactly one member to match"` or
*     `"Expected exactly one member to match the input <input>"`
*
* **Example** (Formatting Standard Schema issues with defaultLeafHook)
*
* ```ts import.meta.vitest
* import { SchemaIssue } from "effect"
*
* const formatter = SchemaIssue.makeFormatterStandardSchemaV1({
*   leafHook: SchemaIssue.defaultLeafHook
* })
* formatter(new SchemaIssue.MissingKey(undefined)) // => { issues: [{ path: [], message: "Missing key" }] }
* ```
*
* @see {@link LeafHook}
* @see {@link makeFormatterStandardSchemaV1}
*
* @stability stable
* @category formatting
* @since 4.0.0
*/
var defaultLeafHook = (issue) => {
	const message = findMessage(issue);
	if (message !== void 0) return message;
	switch (issue._tag) {
		case "InvalidType": return getExpectedMessage(getExpected(issue.ast), issue);
		case "InvalidValue": {
			const expected = findExpected(issue);
			if (expected !== void 0) return getExpectedMessage(expected, issue);
			const input = formatInput(issue);
			return input === void 0 ? "Expected a valid value" : `Invalid data ${input}`;
		}
		case "MissingKey": return "Missing key";
		case "UnexpectedKey": {
			const input = formatInput(issue);
			return input === void 0 ? "Expected no excess property" : `Unexpected key with value ${input}`;
		}
		case "Forbidden": return "Forbidden operation";
		case "OneOf": {
			const input = formatInput(issue);
			return input === void 0 ? "Expected exactly one member to match" : `Expected exactly one member to match the input ${input}`;
		}
	}
};
/**
* Returns the built-in {@link CheckHook} used by default formatters.
*
* **When to use**
*
* Use as the default filter renderer when customizing only the {@link LeafHook}.
*
* **Details**
*
* - Looks for a `message` annotation on the filter first, then on the inner
*   issue.
* - Returns `undefined` when no annotation is found, causing the formatter to
*   fall back to `"Expected <filter>"` or, when the filter reports input,
*   `"Expected <filter>, got <input>"`.
*
* @see {@link CheckHook}
* @see {@link makeFormatterStandardSchemaV1}
*
* @stability stable
* @category formatting
* @since 4.0.0
*/
var defaultCheckHook = (issue) => findMessage(issue) ?? findMessage(issue.issue);
function formatInput(issue) {
	return hasInput(issue) ? format$1(issue.input) : void 0;
}
function findExpected(issue) {
	const expected = issue.annotations?.expected;
	return typeof expected === "string" ? expected : void 0;
}
function getExpectedMessage(expected, issue) {
	const input = formatInput(issue);
	return input === void 0 ? `Expected ${expected}` : `Expected ${expected}, got ${input}`;
}
function getFilterMessage(issue, checkHook) {
	const message = checkHook(issue);
	if (message !== void 0 || issue.issue._tag !== "InvalidValue") return message;
	const expected = findExpected(issue.issue);
	return expected === void 0 ? getExpectedMessage(formatCheck(issue.filter), issue) : getExpectedMessage(expected, issue.issue);
}
function formatCheck(check) {
	const expected = check.annotations?.expected;
	if (typeof expected === "string") return expected;
	switch (check._tag) {
		case "Filter": return "<filter>";
		case "FilterGroup": return check.checks.map((check) => formatCheck(check)).join(" & ");
	}
}
/**
* Creates a {@link Formatter} that converts an {@link Issue} into a
* human-readable multi-line string.
*
* **When to use**
*
* Use when you need to format a `SchemaIssue.Issue` as error messages for
* logging, CLI output, or developer-facing diagnostics.
*
* **Details**
*
* - Flattens the issue tree into `{ message, path }` entries using
*   {@link defaultLeafHook} and {@link defaultCheckHook}.
* - Includes reported input in default messages when the node producing the
*   message has an `input` field.
* - Each entry is rendered as `"<message>"` or `"<message>\n  at <path>"`.
* - Multiple entries are joined with newlines.
*
* **Gotchas**
*
* Formatting an issue can disclose input retained with `reportInput: true`.
* Wrapper inputs are not inherited by child messages, and custom messages are
* returned unchanged.
*
* **Example** (Formatting an issue as a string)
*
* ```ts import.meta.vitest
* import { SchemaIssue } from "effect"
*
* const formatter = SchemaIssue.makeFormatterDefault()
* formatter(new SchemaIssue.MissingKey(undefined)) // => "Missing key"
* ```
*
* @see {@link makeFormatterStandardSchemaV1} — produces Standard Schema V1 format instead
* @see {@link Formatter}
*
* @stability stable
* @category formatting
* @since 4.0.0
*/
function makeFormatterDefault() {
	return (issue) => formatIssue(issue, "");
}
/** @internal */
var defaultFormatter = /*#__PURE__*/ makeFormatterDefault();
function formatIssue(issue, path, messageOverride) {
	let message;
	switch (issue._tag) {
		case "Filter": return formatIssue(issue.issue, path, messageOverride ?? getFilterMessage(issue, defaultCheckHook));
		case "Encoding": return formatIssue(issue.issue, path, messageOverride);
		case "Pointer": return formatIssue(issue.issue, path + formatPath(issue.path), messageOverride);
		case "Composite":
		case "AnyOf":
			if (issue._tag === "Composite" || issue.issues.length > 0) return issue.issues.map((issue) => formatIssue(issue, path, messageOverride)).join("\n");
			message = messageOverride ?? findMessage(issue) ?? getExpectedMessage(getExpected(issue.ast), issue);
			break;
		default: message = messageOverride ?? defaultLeafHook(issue);
	}
	return path ? `${message}\n  at ${path}` : message;
}
function findMessage(issue) {
	if (issue._tag === "Pointer" || issue._tag === "Composite") return;
	if (issue._tag === "Encoding") return findMessage(issue.issue);
	const message = (issue._tag === "Filter" ? issue.filter.annotations : "annotations" in issue ? issue.annotations : issue.ast.annotations)?.[issue._tag === "MissingKey" ? "messageMissingKey" : issue._tag === "UnexpectedKey" ? "messageUnexpectedKey" : "message"];
	if (typeof message === "string") return message;
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/schema/cause.js
/** @internal */
function getSchemaIssue(cause) {
	let issue;
	for (const reason of cause.reasons) {
		if (!isFailReason(reason) || !isIssue(reason.error)) return;
		issue ??= reason.error;
	}
	return issue;
}
/** @internal */
function getSchemaIssueOrThrow(cause, message) {
	const issue = getSchemaIssue(cause);
	if (issue === void 0) throw new Error(message, { cause });
	return issue;
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/SchemaGetter.js
var makeGetter = (fields) => Object.assign(Object.create(Prototype$1), fields);
var passthrough_$1 = /*#__PURE__*/ makeGetter({ _tag: "Passthrough" });
function passthrough$1() {
	return passthrough_$1;
}
/**
* Creates a getter that applies a pure function to present values.
*
* **When to use**
*
* Use when you need a schema getter for a pure, infallible transformation
* between types.
* - Building encode/decode pairs for `Schema.decodeTo`.
*
* **Details**
*
* - This is the most commonly used constructor.
* - Transforms `Some(e)` to `Some(f(e))` and leaves `None` unchanged.
* - Skips `None` inputs — only called when a value is present.
* - Never fails.
*
* **Example** (Transforming strings to numbers)
*
* ```ts import.meta.vitest
* import { Schema, SchemaGetter } from "effect"
*
* const NumberFromString = Schema.String.pipe(
*   Schema.decodeTo(Schema.Number, {
*     decode: SchemaGetter.transform((s) => Number(s)),
*     encode: SchemaGetter.transform((n) => String(n))
*   })
* )
* Schema.decodeSync(NumberFromString)("42") // => 42
* ```
*
* @see {@link transformEffect} when the transformation returns an `Effect`
* @see {@link transformOptional} when you need to handle `None` inputs
* @see {@link passthrough} when no transformation is needed
*
* @stability stable
* @category transforming
* @since 4.0.0
*/
function transform$1(f) {
	return makeGetter({
		_tag: "Transform",
		transform: f
	});
}
/**
* Creates a getter that applies an effectful transformation to present values.
*
* **When to use**
*
* Use when you need a schema getter for a transformation that may fail, require
* Effect services, or run asynchronously.
*
* **Details**
*
* - Skips `None` inputs — only called when a value is present.
* - On success, wraps the result in `Some`.
* - On failure, propagates the `Issue`.
*
* **Example** (Parsing with failure)
*
* ```ts import.meta.vitest
* import { Effect, Option, SchemaGetter, SchemaIssue } from "effect"
*
* const safeParseInt = SchemaGetter.transformEffect<number, string>(
*   (s, options) => {
*     const n = parseInt(s, 10)
*     return isNaN(n)
*       ? Effect.fail(new SchemaIssue.InvalidValue({ message: "not an integer" }, s, options))
*       : Effect.succeed(n)
*   }
* )
* await Effect.runPromise(SchemaGetter.run(safeParseInt, Option.some("42"), {})) // => Option.some(42)
* ```
*
* @see {@link transform} when transformation cannot fail
* @see {@link transformOptionalEffect} when you need full `Option` control over the output
*
* @stability stable
* @category transforming
* @since 4.0.0
*/
function transformEffect$1(f) {
	return makeGetter({
		_tag: "TransformEffect",
		transform: f
	});
}
/**
* Creates a getter that transforms the full `Option` — both present and absent values.
*
* **When to use**
*
* Use when you need a schema getter to handle both `Some` and `None` cases.
*
* **Details**
*
* The getter is pure and never fails. It receives the full `Option<E>` and
* must return `Option<T>`, so it can turn a present value into absent or an
* absent value into present.
*
* **Example** (Filtering out empty strings)
*
* ```ts import.meta.vitest
* import { Effect, Option, SchemaGetter } from "effect"
*
* const skipEmpty = SchemaGetter.transformOptional<string, string>((o) =>
*   Option.filter(o, (s) => s.length > 0)
* )
* Effect.runSync(SchemaGetter.run(skipEmpty, Option.some(""), {})) // => Option.none()
* ```
*
* @see {@link transform} when you only need to transform present values
* @see {@link omit} when you always want `None`
*
* @stability stable
* @category transforming
* @since 4.0.0
*/
function transformOptional(f) {
	return makeGetter({
		_tag: "TransformOptional",
		transform: f
	});
}
/**
* Creates a getter that effectfully transforms the full `Option`.
*
* @stability stable
* @category transforming
* @since 4.0.0
*/
function transformOptionalEffect(f) {
	return makeGetter({
		_tag: "TransformOptionalEffect",
		transform: f
	});
}
/**
* Creates a getter that always returns `None`, effectively omitting the value from output.
*
* **When to use**
*
* Use when you need a schema getter to exclude a field during decoding or
* encoding.
*
* **Details**
*
* - Always returns `Option.None` regardless of input.
* - Never fails.
*
* **Example** (Omitting a field during encoding)
*
* ```ts import.meta.vitest
* import { Effect, Option, SchemaGetter } from "effect"
*
* const omitField = SchemaGetter.omit<string>()
* Effect.runSync(SchemaGetter.run(omitField, Option.some("hidden"), {})) // => Option.none()
* ```
*
* @see {@link transformOptional} when you want conditional omission
* @see {@link forbidden} when you want to fail instead of silently omit
*
* @stability stable
* @category filtering
* @since 4.0.0
*/
function omit$1() {
	return transformOptional(() => none());
}
/**
* Creates a getter that replaces `undefined` values with a default.
*
* **When to use**
*
* Use when you need a schema getter to provide a fallback for a field that may
* be `undefined` in the encoded input.
*
* **Details**
*
* - If the input is `Some(undefined)` or `None`, produces `Some(T)`.
* - If the input is `Some(value)` where value is not `undefined`, passes it through.
* - `defaultValue` is an `Effect` that will be executed each time a default is needed.
*
* **Example** (Providing a default value for an optional field)
*
* ```ts import.meta.vitest
* import { Effect, Option, SchemaGetter } from "effect"
*
* const withZero = SchemaGetter.withDefault(Effect.succeed(0))
* await Effect.runPromise(SchemaGetter.run(withZero, Option.some(undefined), {})) // => Option.some(0)
* ```
*
* @see {@link transformOptionalEffect} for custom effectful missing-key handling
* @see {@link required} when absent input should fail instead of using a default
*
* @stability stable
* @category transforming
* @since 4.0.0
*/
function withDefault$1(defaultValue) {
	return transformOptionalEffect((o) => {
		const filtered = filter(o, isNotUndefined);
		return isSome(filtered) ? succeed$1(filtered) : mapEager(defaultValue, some);
	});
}
/**
* Coerces any value to a `string` using the global `String()` constructor.
*
* **When to use**
*
* Use when you need a schema getter to coerce a present encoded value to a
* string with `String()`.
*
* **Details**
*
* The getter is pure, never fails, and delegates to `globalThis.String`.
*
* **Example** (Coercing to a string)
*
* ```ts import.meta.vitest
* import { Effect, Option, SchemaGetter } from "effect"
*
* const toString = SchemaGetter.String<number>()
* Effect.runSync(SchemaGetter.run(toString, Option.some(42), {})) // => Option.some("42")
* ```
*
* @see {@link transform} for custom string conversions
*
* @stability stable
* @category converting
* @since 4.0.0
*/
function String$3() {
	return transform$1(globalThis.String);
}
/**
* Coerces any value to a `number` using the global `Number()` constructor.
*
* **When to use**
*
* Use when you need a schema getter to coerce a present encoded value to a
* number with `Number()`.
*
* **Details**
*
* The getter is pure, never fails, and delegates to `globalThis.Number`. It may
* produce `NaN` for non-numeric inputs.
*
* **Example** (Coercing to a number)
*
* ```ts import.meta.vitest
* import { Effect, Option, SchemaGetter } from "effect"
*
* const toNumber = SchemaGetter.Number<string>()
* Effect.runSync(SchemaGetter.run(toNumber, Option.some("42"), {})) // => Option.some(42)
* ```
*
* @see {@link transformEffect} for effectful or validated number parsing
*
* @stability stable
* @category converting
* @since 4.0.0
*/
function Number$3() {
	return transform$1(globalThis.Number);
}
function parseJson(options) {
	return transformEffect$1((input, parseOptions) => try_({
		try: () => JSON.parse(input, options?.reviver),
		catch: () => new InvalidValue({ expected: "a valid JSON string" }, input, parseOptions)
	}));
}
/**
* Stringifies a present value using `JSON.stringify`.
*
* **When to use**
*
* Use when you need a schema getter to serialize a present decoded value to
* JSON text during encoding.
*
* **Details**
*
* - Skips `None` inputs.
* - If `JSON.stringify` throws or returns `undefined`, fails with
*   `SchemaIssue.InvalidValue`.
* - Supports optional `replacer` and `space` options, matching
*   `JSON.stringify`.
*
* **Example** (Stringifying JSON)
*
* ```ts import.meta.vitest
* import { Effect, Option, SchemaGetter } from "effect"
*
* const stringify = SchemaGetter.stringifyJson()
* const result = await Effect.runPromise(SchemaGetter.run(stringify, Option.some({ a: 1 }), {}))
* result // => Option.some("{\"a\":1}")
* ```
*
* @see {@link parseJson} for the inverse operation
*
* @stability stable
* @category encoding
* @since 4.0.0
*/
function stringifyJson(options) {
	return transformEffect$1((input, parseOptions) => try_({
		try: () => {
			const output = JSON.stringify(input, options?.replacer, options?.space);
			if (output === void 0) throw new TypeError("Value cannot be represented as JSON");
			return output;
		},
		catch: () => new InvalidValue({ expected: "a JSON-serializable value" }, input, parseOptions)
	}));
}
/**
* Encodes a `Uint8Array` or string to a Base64 string.
*
* **Details**
*
* The getter is pure and never fails.
*
* **Example** (Encoding to Base64)
*
* ```ts import.meta.vitest
* import { Effect, Option, SchemaGetter } from "effect"
*
* const encode = SchemaGetter.encodeBase64<Uint8Array>()
* const result = Effect.runSync(SchemaGetter.run(encode, Option.some(new Uint8Array([1, 2, 3])), {}))
* result // => Option.some("AQID")
* ```
*
* @see {@link decodeBase64} for the inverse operation to `Uint8Array`
* @see {@link decodeBase64String} for the inverse operation to `string`
* @see {@link encodeBase64Url} for the URL-safe variant
*
* @stability stable
* @category encoding
* @since 4.0.0
*/
function encodeBase64() {
	return transform$1(encode);
}
/**
* Decodes a Base64 string to a `Uint8Array`.
*
* **Details**
*
* - Fails with `SchemaIssue.InvalidValue` if the input is not valid Base64.
*
* **Example** (Decoding Base64 to bytes)
*
* ```ts import.meta.vitest
* import { Effect, Option, SchemaGetter } from "effect"
*
* const decode = SchemaGetter.decodeBase64<string>()
* const result = await Effect.runPromise(SchemaGetter.run(decode, Option.some("AQID"), {}))
* Option.map(result, Array.from) // => Option.some([1, 2, 3])
* ```
*
* @see {@link decodeBase64String} to decode to `string` instead
* @see {@link encodeBase64} for the inverse operation
*
* @stability stable
* @category decoding
* @since 4.0.0
*/
function decodeBase64() {
	return transformEffect$1((input, options) => mapErrorEager(fromResult(decode(input)), () => new InvalidValue({ expected: "a valid Base64 string" }, input, options)));
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/schema/content.js
var ContentTypeId = /*#__PURE__*/ Symbol.for("~effect/Schema/content");
/** @internal */
function setContent(operation, content) {
	Object.defineProperty(operation, ContentTypeId, { value: content });
	return operation;
}
/** @internal */
function getContent(operation) {
	return operation[ContentTypeId];
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/SchemaTransformation.js
/**
* Constructs schema middleware from its decode and encode functions.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Middleware = class extends Class$1 {
	_tag = "Middleware";
	decode;
	encode;
	constructor(decode, encode) {
		super();
		this.decode = decode;
		this.encode = encode;
	}
	flip() {
		return new Middleware(this.encode, this.decode);
	}
};
var TypeId$12 = "~effect/SchemaTransformation/Transformation";
/**
* Constructs a bidirectional schema transformation from its decode and encode getters.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Transformation = class extends Class$1 {
	[TypeId$12] = TypeId$12;
	_tag = "Transformation";
	decode;
	encode;
	constructor(decode, encode) {
		super();
		this.decode = decode;
		this.encode = encode;
	}
	flip() {
		return new Transformation(this.encode, this.decode);
	}
};
/**
* Returns `true` if `u` is a `Transformation` instance.
*
* **When to use**
*
* Use to check whether a value is already a schema transformation before
* wrapping it.
*
* **Details**
*
* - Pure predicate, no side effects.
* - Acts as a TypeScript type guard.
*
* **Example** (Checking a value)
*
* ```ts import.meta.vitest
* import { SchemaTransformation } from "effect"
*
* SchemaTransformation.isTransformation(SchemaTransformation.trim()) // => true
* SchemaTransformation.isTransformation({ decode: null, encode: null }) // => false
* ```
*
* @see {@link Transformation}
* @see {@link makeTransformation}
*
* @stability stable
* @category guards
* @since 4.0.0
*/
function isTransformation(u) {
	return hasProperty(u, TypeId$12) && u[TypeId$12] === TypeId$12;
}
/**
* Constructs a `Transformation` from an object with `decode` and `encode`
* `Getter`s. If the input is already a `Transformation`, returns it as-is.
*
* **When to use**
*
* Use when you already have schema getter instances and want to pair them into
* a schema transformation.
* - You want idempotent wrapping (won't double-wrap).
*
* **Details**
*
* - Returns the input unchanged if it is already a `Transformation`.
*
* **Example** (Wrapping existing getters)
*
* ```ts import.meta.vitest
* import { SchemaGetter, SchemaTransformation } from "effect"
*
* const t = SchemaTransformation.makeTransformation({
*   decode: SchemaGetter.transform<number, string>((s) => Number(s)),
*   encode: SchemaGetter.transform<string, number>((n) => String(n))
* })
* t._tag // => "Transformation"
* ```
*
* @see {@link transform} — simpler constructor from pure functions
* @see {@link transformEffect} — constructor from effectful functions
* @see {@link Transformation}
*
* @stability stable
* @category constructors
* @since 3.10.0
*/
var makeTransformation = (options) => {
	if (isTransformation(options)) return options;
	return new Transformation(options.decode, options.encode);
};
var passthrough_ = /*#__PURE__*/ new Transformation(/*#__PURE__*/ passthrough$1(), /*#__PURE__*/ passthrough$1());
function passthrough() {
	return passthrough_;
}
/**
* Decodes a `string` into a `number` and encodes a `number` back to a
* `string`.
*
* **When to use**
*
* Use when you need a schema transformation to parse numeric strings from APIs,
* form data, or URL parameters.
*
* **Details**
*
* Decoding coerces the string to a number like `Number(s)`. Encoding coerces
* the number to a string like `String(n)`. This does not validate that the
* result is finite; combine with `Schema.Finite` or `Schema.Int` for stricter
* checks.
*
* **Example** (Converting a string to a number)
*
* ```ts import.meta.vitest
* import { Schema, SchemaTransformation } from "effect"
*
* const schema = Schema.String.pipe(
*   Schema.decodeTo(Schema.Number, SchemaTransformation.numberFromString)
* )
* Schema.decodeSync(schema)("42") // => 42
* ```
*
* @see {@link bigintFromString}
* @see {@link transform}
*
* @stability stable
* @category converting
* @since 4.0.0
*/
var numberFromString = /*#__PURE__*/ new Transformation(/*#__PURE__*/ Number$3(), /*#__PURE__*/ String$3());
/**
* Decodes a Base64-encoded `string` into a `Uint8Array` and encodes a
* `Uint8Array` back to a Base64 string.
*
* **When to use**
*
* Use when you need a schema transformation for binary data transmitted as
* Base64 strings (e.g. file uploads, API payloads).
*
* **Details**
*
* Decoding parses the Base64 string into bytes. Encoding writes the byte array
* as a Base64 string.
*
* **Example** (Converting Base64 to a Uint8Array)
*
* ```ts import.meta.vitest
* import { Schema, SchemaTransformation } from "effect"
*
* const schema = Schema.String.pipe(
*   Schema.decodeTo(Schema.Uint8Array, SchemaTransformation.uint8ArrayFromBase64String)
* )
* Array.from(Schema.decodeSync(schema)("AQID")) // => [1, 2, 3]
* ```
*
* @see {@link fromJsonString}
* @see `Schema.Uint8ArrayFromBase64` - a ready-made schema wrapping this transformation.
*
* @stability stable
* @category encoding
* @since 4.0.0
*/
var uint8ArrayFromBase64String = /*#__PURE__*/ new Transformation(/*#__PURE__*/ decodeBase64(), /*#__PURE__*/ encodeBase64());
/**
* Decodes a JSON string with `JSON.parse` and encodes a value with
* `JSON.stringify`.
*
* **When to use**
*
* Use when you need a schema transformation to decode JSON stored or
* transmitted as a string, usually before composing with another schema that
* validates the parsed structure.
*
* **Details**
*
* The `reviver` option is passed to `JSON.parse` during decoding. The
* `replacer` and `space` options are passed to `JSON.stringify` during
* encoding. Decode fails with `InvalidValue` for invalid JSON, and encode can
* fail with `InvalidValue` when `JSON.stringify` cannot serialize the value.
*
* **Example** (Parsing JSON)
*
* ```ts import.meta.vitest
* import { Schema, SchemaTransformation } from "effect"
*
* const schema = Schema.String.pipe(
*   Schema.decodeTo(Schema.Unknown, SchemaTransformation.fromJsonString())
* )
* Schema.decodeSync(schema)("{\"ok\":true}") // => { ok: true }
* ```
*
* @see {@link uint8ArrayFromBase64String}
* @see {@link fromFormData}
*
* @stability stable
* @category decoding
* @since 4.0.0
*/
function fromJsonString$1(options) {
	return new Transformation(parseJson(options ?? {}), setContent(stringifyJson(options), {
		mediaType: "application/json",
		preserveSchema: options?.reviver === void 0 && options?.replacer === void 0
	}));
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/SchemaAST.js
/**
* Represents Effect schemas as runtime trees.
*
* Every `Schema` has an AST made from nodes for declarations, primitives,
* literals, arrays, objects, unions, suspended schemas, checks, annotations,
* encoding links, and parsing context. Most users work with the higher-level
* `Schema` module. Use `SchemaAST` when you need to inspect schema nodes, build
* ASTs programmatically, change encoded or decoded views, collect issues, or
* run low-level schema checks.
*
* @stability stable
* @since 4.0.0
*/
function makeGuard(tag) {
	return (ast) => ast._tag === tag;
}
/**
* Narrows an {@link AST} to {@link Declaration}.
*
* **When to use**
*
* Use to recognize declaration AST nodes before running declaration-specific
* handling.
*
* @see {@link Declaration} for the AST node type narrowed by this guard
*
* @stability stable
* @category guards
* @since 3.10.0
*/
var isDeclaration = /*#__PURE__*/ makeGuard("Declaration");
/**
* Narrows an {@link AST} to {@link Void}.
*
* **When to use**
*
* Use to identify AST nodes that represent the TypeScript `void` type before
* handling `Void`-specific schema behavior.
*
* @see {@link isUndefined} for narrowing AST nodes that represent the literal `undefined` value instead of TypeScript `void`
*
* @stability stable
* @category guards
* @since 4.0.0
*/
var isVoid = /*#__PURE__*/ makeGuard("Void");
/**
* Narrows an {@link AST} to {@link Never}.
*
* **When to use**
*
* Use to detect the AST node for a schema that can never match before handling
* other schema variants.
*
* @see {@link Never} for the AST node type narrowed by this guard
* @see {@link never} for the singleton `Never` AST instance
*
* @stability stable
* @category guards
* @since 4.0.0
*/
var isNever = /*#__PURE__*/ makeGuard("Never");
/**
* Narrows an {@link AST} to {@link Literal}.
*
* **When to use**
*
* Use to recognize exact string, number, boolean, or bigint literal AST nodes.
*
* @see {@link Literal} for the AST node type narrowed by this guard
* @see {@link LiteralValue} for the values stored by literal nodes
*
* @stability stable
* @category guards
* @since 3.10.0
*/
var isLiteral = /*#__PURE__*/ makeGuard("Literal");
/**
* Narrows an {@link AST} to {@link UniqueSymbol}.
*
* @stability stable
* @category guards
* @since 3.10.0
*/
var isUniqueSymbol = /*#__PURE__*/ makeGuard("UniqueSymbol");
/**
* Narrows an {@link AST} to {@link Arrays}.
*
* **When to use**
*
* Use to recognize array-like AST nodes before reading their element, rest, or
* mutability metadata.
*
* @see {@link Arrays} for the AST node type narrowed by this guard
*
* @stability stable
* @category guards
* @since 4.0.0
*/
var isArrays = /*#__PURE__*/ makeGuard("Arrays");
/**
* Narrows an {@link AST} to {@link Objects}.
*
* @stability stable
* @category guards
* @since 4.0.0
*/
var isObjects = /*#__PURE__*/ makeGuard("Objects");
/**
* Narrows an {@link AST} to {@link Union}.
*
* @stability stable
* @category guards
* @since 3.10.0
*/
var isUnion = /*#__PURE__*/ makeGuard("Union");
/**
* Narrows an {@link AST} to {@link Suspend}.
*
* @stability stable
* @category guards
* @since 3.10.0
*/
var isSuspend = /*#__PURE__*/ makeGuard("Suspend");
/**
* Constructs a {@link Link}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Link = class {
	to;
	transformation;
	constructor(to, transformation) {
		this.to = to;
		this.transformation = transformation;
	}
};
/** @internal */
var defaultParseOptions = {};
/**
* Constructs a {@link Context}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Context = class {
	isOptional;
	isMutable;
	/** Used for constructor default values (e.g. `withConstructorDefault` API) */
	constructorDefault;
	annotations;
	constructor(isOptional, isMutable, constructorDefault = void 0, annotations = void 0) {
		this.isOptional = isOptional;
		this.isMutable = isMutable;
		this.constructorDefault = constructorDefault;
		this.annotations = annotations;
	}
};
var TypeId$11 = "~effect/Schema";
var ASTNodeImpl = class {
	[TypeId$11] = TypeId$11;
	annotations;
	checks;
	encoding;
	context;
	constructor(annotations = void 0, checks = void 0, encoding = void 0, context = void 0) {
		this.annotations = annotations;
		this.checks = checks;
		this.encoding = encoding;
		this.context = context;
	}
	toString() {
		return `<${this._tag}>`;
	}
};
/**
* Constructs a {@link Declaration}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Declaration = class extends ASTNodeImpl {
	_tag = "Declaration";
	typeParameters;
	run;
	encodingChecks;
	/**
	* Parser factory {@link flip} swaps in, so a declaration can behave
	* differently when encoding. `undefined` reuses `run`.
	*/
	encodingRun;
	constructor(typeParameters, run, annotations, checks, encoding, context, encodingChecks, encodingRun) {
		super(annotations, checks, encoding, context);
		this.typeParameters = typeParameters;
		this.run = run;
		this.encodingChecks = encodingChecks;
		this.encodingRun = encodingRun;
	}
	/** @internal */
	getParser() {
		let run;
		return (input, options) => {
			if (input === missing) return missingExit;
			run ??= this.run(this.typeParameters);
			try {
				return run(input, this, options);
			} catch (error) {
				return die(error);
			}
		};
	}
	_rebuild(recur, checks, encodingChecks, run, encodingRun) {
		const tps = mapOrSame(this.typeParameters, recur);
		return tps === this.typeParameters && checks === this.checks && encodingChecks === this.encodingChecks && run === this.run && encodingRun === this.encodingRun ? this : new Declaration(tps, run, this.annotations, checks, void 0, this.context, encodingChecks, encodingRun);
	}
	/** @internal */
	recur(recur) {
		return this._rebuild(recur, this.checks, this.encodingChecks, this.run, this.encodingRun);
	}
	/** @internal */
	flip(recur) {
		return this._rebuild(recur, this.encodingChecks, this.checks, this.encodingRun ?? this.run, this.run);
	}
	/** @internal */
	getExpected() {
		const expected = this.annotations?.expected;
		if (typeof expected === "string") return expected;
		return "<Declaration>";
	}
};
/**
* Constructs a {@link Null}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Null$1 = class extends ASTNodeImpl {
	_tag = "Null";
	/** @internal */
	getParser() {
		return fromConst(this, null);
	}
	/** @internal */
	getExpected() {
		return "null";
	}
};
var null_ = /*#__PURE__*/ new Null$1();
var undefinedToNull = /*#__PURE__*/ new Link(null_, /*#__PURE__*/ new Transformation(/*#__PURE__*/ transform$1(() => void 0), /*#__PURE__*/ transform$1(() => null)));
/**
* Constructs a {@link Void}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Void$1 = class extends ASTNodeImpl {
	_tag = "Void";
	/** @internal */
	getParser() {
		const succeed$6 = succeed(void 0);
		return (input) => input === missing ? missingExit : succeed$6;
	}
	/** @internal */
	toCodecJson() {
		return replaceEncoding(this, [undefinedToNull]);
	}
	/** @internal */
	getExpected() {
		return "void";
	}
};
var void_ = /*#__PURE__*/ new Void$1();
/**
* Constructs a {@link Never}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Never = class extends ASTNodeImpl {
	_tag = "Never";
	/** @internal */
	getParser() {
		return fromRefinement(this, isNever$1);
	}
	/** @internal */
	getExpected() {
		return "never";
	}
};
/**
* Constructs a {@link Unknown}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Unknown$1 = class extends ASTNodeImpl {
	_tag = "Unknown";
	/** @internal */
	getParser() {
		return fromRefinement(this, isUnknown);
	}
	/** @internal */
	getExpected() {
		return "unknown";
	}
};
/**
* Provides the singleton {@link Unknown} AST instance.
*
* **When to use**
*
* Use when you need the reusable AST singleton for a schema node that accepts
* every value while keeping parsed values opaque.
*
* @see {@link any} for the singleton that accepts every value as `any`
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var unknown = /*#__PURE__*/ new Unknown$1();
/**
* Constructs a {@link Enum}. Numeric values must be finite.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Enum$1 = class extends ASTNodeImpl {
	_tag = "Enum";
	enums;
	constructor(enums, annotations, checks, encoding, context) {
		super(annotations, checks, encoding, context);
		for (const [, value] of enums) if (typeof value === "number" && !globalThis.Number.isFinite(value)) throw new Error(`A numeric enum value must be finite, got ${format$1(value)}`);
		this.enums = enums;
	}
	/** @internal */
	getParser() {
		const values = new Set(this.enums.map(([, v]) => v));
		return fromRefinement(this, (input) => values.has(input));
	}
	/** @internal */
	toCodecStringTree() {
		if (this.enums.some(([_, v]) => typeof v === "number")) {
			const coercions = Object.fromEntries(this.enums.map(([_, v]) => [globalThis.String(v), v]));
			return replaceEncoding(this, [new Link(new Union$1(Object.keys(coercions).map((k) => new Literal$1(k))), new Transformation(transform$1((s) => coercions[s]), String$3()))]);
		}
		return this;
	}
	/** @internal */
	getExpected() {
		return this.enums.map(([_, value]) => JSON.stringify(value)).join(" | ");
	}
};
/**
* Constructs a {@link Literal}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Literal$1 = class extends ASTNodeImpl {
	_tag = "Literal";
	literal;
	constructor(literal, annotations, checks, encoding, context) {
		super(annotations, checks, encoding, context);
		if (typeof literal === "number" && !globalThis.Number.isFinite(literal)) throw new Error(`A numeric literal must be finite, got ${format$1(literal)}`);
		this.literal = literal;
	}
	/** @internal */
	getParser() {
		return fromConst(this, this.literal);
	}
	/** @internal */
	matchPart(s, _options) {
		return s === globalThis.String(this.literal) ? this.literal : void 0;
	}
	/** @internal */
	toCodecJson() {
		return typeof this.literal === "bigint" ? literalToString(this) : this;
	}
	/** @internal */
	toCodecStringTree() {
		return typeof this.literal === "string" ? this : literalToString(this);
	}
	/** @internal */
	getExpected() {
		return typeof this.literal === "string" ? JSON.stringify(this.literal) : globalThis.String(this.literal);
	}
};
function literalToString(ast) {
	const literalAsString = globalThis.String(ast.literal);
	return replaceEncoding(ast, [new Link(new Literal$1(literalAsString), new Transformation(transform$1(() => ast.literal), transform$1(() => literalAsString)))]);
}
/**
* Constructs a {@link String}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var String$2 = class extends ASTNodeImpl {
	_tag = "String";
	/** @internal */
	getParser() {
		return fromRefinement(this, isString$1);
	}
	/** @internal */
	matchPart(s, options) {
		const checks = this.checks;
		return checks && !options.disableChecks && collectIssues(checks, s, void 0, this, options) ? void 0 : s;
	}
	/** @internal */
	getExpected() {
		return "string";
	}
};
/**
* Provides the singleton {@link String} AST instance.
*
* **When to use**
*
* Use as the shared `SchemaAST` node for unconstrained JavaScript strings.
*
* @see {@link String} for the AST node class
* @see {@link isString} for narrowing an AST to a string node
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var string = /*#__PURE__*/ new String$2();
/**
* Constructs a {@link Number}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Number$2 = class extends ASTNodeImpl {
	_tag = "Number";
	/** @internal */
	getParser() {
		return fromRefinement(this, isNumber);
	}
	/** @internal */
	matchKey(s, options) {
		return this._match(isStringNumberRegExp, s, options);
	}
	/** @internal */
	matchPart(s, options) {
		return this._match(isStringFiniteRegExp, s, options);
	}
	_match(regexp, s, options) {
		if (!regexp.test(s)) return void 0;
		const value = globalThis.Number(s);
		if (options.disableChecks || !this.checks) return value;
		return collectIssues(this.checks, value, void 0, this, options) ? void 0 : value;
	}
	/** @internal */
	toCodecJson() {
		if (this.checks && (hasCheck(this.checks, "effect/schema/isFinite") || hasCheck(this.checks, "effect/schema/isInt"))) return this;
		return replaceEncoding(this, [numberToJson]);
	}
	/** @internal */
	toCodecStringTree() {
		if (this.toCodecJson() === this) return replaceEncoding(this, [finiteToString]);
		return replaceEncoding(this, [numberToString]);
	}
	/** @internal */
	getExpected() {
		return "number";
	}
};
function hasCheck(checks, id) {
	return checks.some((check) => check.annotations?.representation?.id === id || check._tag === "FilterGroup" && hasCheck(check.checks, id));
}
/**
* Provides the singleton {@link Number} AST instance.
*
* **When to use**
*
* Use when you need the canonical `SchemaAST` node for schemas that accept any
* JavaScript number value.
*
* @see {@link Number} for the AST node class and serialization behavior
* @see {@link Literal} for exact finite numeric literal AST nodes
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var number = /*#__PURE__*/ new Number$2();
/**
* Constructs a {@link Boolean}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Boolean$2 = class extends ASTNodeImpl {
	_tag = "Boolean";
	/** @internal */
	getParser() {
		return fromRefinement(this, isBoolean);
	}
	/** @internal */
	getExpected() {
		return "boolean";
	}
};
/**
* Provides the singleton {@link Boolean} AST instance.
*
* **When to use**
*
* Use to reuse the standard AST node that accepts either `true` or `false` when
* constructing schema ASTs directly.
*
* @see {@link Boolean} for the AST node class
* @see {@link Literal} for exact boolean literal AST nodes
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var boolean = /*#__PURE__*/ new Boolean$2();
/**
* Constructs a {@link Arrays}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Arrays = class extends ASTNodeImpl {
	_tag = "Arrays";
	isMutable;
	elements;
	rest;
	encodingChecks;
	constructor(isMutable, elements, rest, annotations, checks, encoding, context, encodingChecks) {
		super(annotations, checks, encoding, context);
		this.isMutable = isMutable;
		this.elements = elements;
		this.rest = rest;
		this.encodingChecks = encodingChecks;
		let hasOptional = false;
		for (let i = 0; i < elements.length; i++) if (isOptional(elements[i])) hasOptional = true;
		else if (hasOptional) throw new Error("A required element cannot follow an optional element. ts(1257)");
		if (hasOptional && rest.length > 1) throw new Error("A required element cannot follow an optional element. ts(1257)");
		for (let i = 1; i < rest.length; i++) if (isOptional(rest[i])) throw new Error("An optional element cannot follow a rest element. ts(1266)");
	}
	/** @internal */
	getParser(compile, compileField = compile) {
		const ast = this;
		let elements;
		let rest;
		const elementLen = ast.elements.length;
		const tailLen = Math.max(0, ast.rest.length - 1);
		function getParser(tailThreshold, index) {
			if (index < elementLen) return elements[index];
			else if (index >= tailThreshold) return rest[index - tailThreshold + 1];
			return rest[0];
		}
		const finish = (state) => {
			const { input, len, options } = state;
			if (ast.rest.length === 0 && len > elementLen) for (let i = elementLen; i < len; i++) {
				const unexpected = new UnexpectedKey(ast, input[i], options);
				const issue = new Pointer([i], unexpected);
				if (options.errors === "all") {
					if (state.issues) state.issues.push(issue);
					else state.issues = [issue];
				} else return fail$1(new Composite(ast, [issue], input, options));
			}
			if (state.issues) return fail$1(new Composite(ast, state.issues, input, options));
			return succeed(state.output);
		};
		const parse = (input, options) => {
			const len = input.length;
			const state = {
				ast,
				getParser,
				input,
				len,
				tailThreshold: Math.max(elementLen, len - tailLen),
				output: [],
				issues: void 0,
				options
			};
			const end = ast.rest.length === 0 ? elementLen : Math.max(len, elementLen + tailLen);
			const concurrency = options.concurrency === void 0 ? 1 : resolveConcurrency(options.concurrency);
			const eff = concurrency === 1 ? parseArray(state, input, 0, end) : parseArrayConcurrent(state, input, {
				concurrency,
				end
			});
			if (!eff) return finish(state);
			if (effectIsExit(eff)) return flatMapEager(eff, () => finish(state));
			let first = true;
			return suspend(() => {
				if (!first) return parse(input, options);
				first = false;
				return flatMap(eff, () => finish(state));
			});
		};
		return (input, options) => {
			if (input === missing) return missingExit;
			try {
				if (!Array.isArray(input)) return fail$1(new InvalidType(ast, input, options));
				if (!elements) {
					elements = ast.elements.map((ast) => ({
						ast,
						parser: compileField(ast)
					}));
					rest = ast.rest.map((ast) => ({
						ast,
						parser: compileField(ast)
					}));
				}
				return parse(input, options);
			} catch (error) {
				return die(error);
			}
		};
	}
	_rebuild(recur, checks, encodingChecks) {
		const elements = mapOrSame(this.elements, recur);
		const rest = mapOrSame(this.rest, recur);
		return elements === this.elements && rest === this.rest && checks === this.checks && encodingChecks === this.encodingChecks ? this : new Arrays(this.isMutable, elements, rest, this.annotations, checks, void 0, this.context, encodingChecks);
	}
	/** @internal */
	recur(recur) {
		return this._rebuild(recur, this.checks, this.encodingChecks);
	}
	/** @internal */
	flip(recur) {
		return this._rebuild(recur, this.encodingChecks, this.checks);
	}
	/** @internal */
	getExpected() {
		return "array";
	}
};
/** @internal */
function stepArray(s, item, exit, i) {
	if (exit._tag === "Failure") return wrapPropertyKeyIssue(s, s.ast, i, exit);
	const value = isSameExit(exit) ? item : exit[args];
	if (value !== missing) s.output[i] = value;
	else {
		const p = s.getParser(s.tailThreshold, i);
		if (isOptional(p.ast)) return;
		const issue = new Pointer([i], new MissingKey(p.ast.context?.annotations));
		if (s.options.errors === "all") {
			if (s.issues) s.issues.push(issue);
			else s.issues = [issue];
		} else return fail$2(new Composite(s.ast, [issue], s.input, s.options));
	}
}
var parseArrayOptions = {
	onItem(s, item, i) {
		const value = i < s.len ? item : missing;
		return s.getParser(s.tailThreshold, i).parser(value, s.options);
	},
	step: stepArray
};
/** @internal */
var parseArray = /*#__PURE__*/ iterateEager()(parseArrayOptions);
var parseArrayConcurrent = /*#__PURE__*/ iterateConcurrent()(parseArrayOptions);
var wrapPropertyKeyIssue = (s, ast, key, exit) => {
	if (exit.cause.reasons.length === 0) return exit;
	const issue = getSchemaIssue(exit.cause);
	if (issue === void 0) return failCause(map$2(exit.cause, (issue) => new Composite(ast, [new Pointer([key], issue)], s.input, s.options)));
	const pointer = new Pointer([key], issue);
	if (s.options.errors === "all") {
		if (s.issues) s.issues.push(pointer);
		else s.issues = [pointer];
	} else return fail$2(new Composite(ast, [pointer], s.input, s.options));
};
/**
* floating point or integer, with optional exponent
*
* The mantissa alternation keeps rejection linear: `\d*\.?\d+` retries
* every split of a long digit run.
* @internal
*/
var FINITE_PATTERN = "[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[Ee][+-]?\\d+)?";
/**
* Returns the object keys that match the index signature parameter schema.
* @internal
*/
function getIndexSignatureKeys(input, parameter, options = defaultParseOptions) {
	let stringKeys;
	let symbolKeys;
	function go(parameter) {
		switch (parameter._tag) {
			case "String":
			case "TemplateLiteral": return (stringKeys ??= Object.keys(input)).filter((k) => parameter.matchPart(k, options) !== void 0);
			case "Number": return (stringKeys ??= Object.keys(input)).filter((k) => parameter.matchKey(k, options) !== void 0);
			case "Symbol": return (symbolKeys ??= Object.getOwnPropertySymbols(input)).filter((k) => Object.prototype.propertyIsEnumerable.call(input, k) && parameter.matchKey(k, options) !== void 0);
			case "Union": return [...new Set(parameter.types.flatMap(go))];
			default: return [];
		}
	}
	return go(parameterFromPropertyKey(toEncoded$1(parameter)));
}
/**
* Constructs a {@link PropertySignature}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var PropertySignature = class {
	name;
	type;
	constructor(name, type) {
		this.name = name;
		this.type = type;
	}
};
function isIndexSignatureParameterSide(ast) {
	switch (ast._tag) {
		case "String":
		case "Number":
		case "Symbol":
		case "TemplateLiteral": return true;
		case "Union": return ast.types.every(isIndexSignatureParameterSide);
		default: return false;
	}
}
function isIndexSignatureParameterEncodedSide(ast) {
	const encoded = getLastEncoding(ast);
	switch (encoded._tag) {
		case "String":
		case "Number":
		case "Symbol":
		case "TemplateLiteral": return true;
		case "Union": return encoded.types.every(isIndexSignatureParameterEncodedSide);
		default: return false;
	}
}
function isIndexSignatureParameter(ast) {
	return isIndexSignatureParameterSide(ast) && isIndexSignatureParameterEncodedSide(ast);
}
/**
* Constructs a {@link IndexSignature}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var IndexSignature = class {
	parameter;
	type;
	constructor(parameter, type) {
		if (!isIndexSignatureParameter(parameter)) throw new Error(`Invalid index signature parameter ${parameter._tag}`);
		this.parameter = parameter;
		this.type = type;
		if (isOptional(type) || type.encoding !== void 0 && isOptional(toEncoded$1(type))) throw new Error("Cannot use `Schema.optionalKey` or `Schema.optional` with index signatures. Index signatures already allow keys to be absent; use `Schema.UndefinedOr` to allow `undefined` values.");
	}
};
/**
* Constructs a {@link Objects}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Objects = class extends ASTNodeImpl {
	_tag = "Objects";
	propertySignatures;
	indexSignatures;
	encodingChecks;
	constructor(propertySignatures, indexSignatures, annotations, checks, encoding, context, encodingChecks) {
		super(annotations, checks, encoding, context);
		this.propertySignatures = propertySignatures;
		this.indexSignatures = indexSignatures;
		this.encodingChecks = encodingChecks;
	}
	/** @internal */
	getParser(compile, compileField = compile) {
		const ast = this;
		const hasProperties = ast.propertySignatures.length;
		const indexCount = ast.indexSignatures.length;
		if (!hasProperties && !indexCount) return fromRefinement(ast, isNotNullish);
		let properties;
		let indexes;
		const compileMembers = () => {
			if (!properties) {
				properties = ast.propertySignatures.map((ps) => ({
					parser: compileField(ps.type),
					name: ps.name,
					type: ps.type,
					ownOnly: requiresOwnProperty(ps.name)
				}));
				indexes = indexCount ? ast.indexSignatures.map((is) => ({
					is,
					parserKey: compile(parameterFromPropertyKey(is.parameter)),
					parserValue: compileField(is.type)
				})) : void 0;
			}
			return properties;
		};
		const makeFallback = () => {
			const expectedKeys = new Set(ast.propertySignatures.map((ps) => typeof ps.name === "number" ? globalThis.String(ps.name) : ps.name));
			const finishIndex = (s, key, k2, inputValue, exitValue) => {
				if (exitValue._tag === "Failure") return wrapPropertyKeyIssue(s, ast, key, exitValue) ?? void_$1;
				const value = isSameExit(exitValue) ? inputValue : exitValue[args];
				if (k2 !== missing && value !== missing) {
					if (hasProperties && (expectedKeys.has(key) || expectedKeys.has(typeof k2 === "number" ? globalThis.String(k2) : k2))) return void_$1;
					assignProperty(s.out, k2, value);
				}
				return void_$1;
			};
			const parseIndex = (s, key, index, exitKey) => {
				if (!exitKey) {
					const eff = index.parserKey(key, s.options);
					if (!effectIsExit(eff)) return flatMap(exit(eff), (exit) => parseIndex(s, key, index, exit));
					exitKey = eff;
				}
				if (exitKey._tag === "Failure") return wrapPropertyKeyIssue(s, ast, key, exitKey) ?? void_$1;
				const k2 = isSameExit(exitKey) ? key : exitKey[args];
				const inputValue = s.input[key];
				const result = index.parserValue(inputValue, s.options);
				return effectIsExit(result) ? finishIndex(s, key, k2, inputValue, result) : flatMap(exit(result), (exit) => finishIndex(s, key, k2, inputValue, exit));
			};
			const parseStringIndex = (s, key, index) => {
				const inputValue = s.input[key];
				const result = index.parserValue(inputValue, s.options);
				return effectIsExit(result) ? finishIndex(s, key, key, inputValue, result) : flatMap(exit(result), (exit) => finishIndex(s, key, key, inputValue, exit));
			};
			const parseIndexes = indexCount ? iterateConcurrent()({
				onItem: (s, [key, index]) => index.is.parameter === string ? parseStringIndex(s, key, index) : parseIndex(s, key, index),
				step: (_s, _item, exit) => exit._tag === "Failure" ? exit : void 0
			}) : void 0;
			return fnUntracedEager(function* (input, options) {
				if (input === missing) return missing;
				if (!(typeof input === "object" && input !== null && !Array.isArray(input))) return yield* fail$1(new InvalidType(ast, input, options));
				compileMembers();
				const record = input;
				const out = {};
				const state = {
					ast,
					input: record,
					out,
					issues: void 0,
					options
				};
				const errorsAllOption = options.errors === "all";
				const onExcessPropertyError = options.onExcessProperty === "error";
				const concurrency = options.concurrency === void 0 ? 1 : resolveConcurrency(options.concurrency);
				const indexKeys = indexCount && onExcessPropertyError ? ast.indexSignatures.map((index) => getIndexSignatureKeys(record, index.parameter, options)) : void 0;
				if (onExcessPropertyError) {
					const coveredKeys = indexKeys ? new Set(expectedKeys) : expectedKeys;
					if (indexKeys) for (const keys of indexKeys) for (const key of keys) coveredKeys.add(key);
					const inputKeys = Reflect.ownKeys(record);
					for (let i = 0; i < inputKeys.length; i++) {
						const key = inputKeys[i];
						if (!coveredKeys.has(key) && Object.prototype.propertyIsEnumerable.call(record, key)) {
							const unexpected = new UnexpectedKey(ast, record[key], options);
							const issue = new Pointer([key], unexpected);
							if (errorsAllOption) {
								if (state.issues) state.issues.push(issue);
								else state.issues = [issue];
								continue;
							} else return yield* fail$1(new Composite(ast, [issue], input, options));
						}
					}
				}
				if (hasProperties) {
					const eff = concurrency === 1 ? parseProperties(state, properties) : parsePropertiesConcurrent(state, properties, { concurrency });
					if (eff) yield* eff;
				}
				if (indexCount && concurrency === 1) for (let i = 0; i < indexCount; i++) {
					const index = indexes[i];
					const parse = index.is.parameter === string ? parseStringIndex : parseIndex;
					const keys = indexKeys?.[i] ?? (index.is.parameter === string ? Object.keys(record) : getIndexSignatureKeys(record, index.is.parameter, options));
					for (let j = 0; j < keys.length; j++) {
						const eff = parse(state, keys[j], index);
						if (!effectIsExit(eff)) yield* eff;
						else if (eff._tag === "Failure") return yield* eff;
					}
				}
				else if (parseIndexes) {
					const keyPairs = empty$1();
					for (let i = 0; i < indexCount; i++) {
						const index = indexes[i];
						const keys = indexKeys?.[i] ?? (index.is.parameter === string ? Object.keys(record) : getIndexSignatureKeys(record, index.is.parameter, options));
						for (let j = 0; j < keys.length; j++) keyPairs.push([keys[j], index]);
					}
					const eff = parseIndexes(state, keyPairs, { concurrency });
					if (eff) yield* eff;
				}
				if (state.issues) return yield* fail$1(new Composite(ast, state.issues, input, options));
				return out;
			});
		};
		if (indexCount) return makeFallback();
		let fallback;
		const resume = (snapshot, index, pending) => {
			const property = properties[index];
			return flatMap(exit(pending), (exit) => {
				const state = {
					...snapshot,
					out: { ...snapshot.out }
				};
				const terminal = stepProperty(state, property, exit);
				if (terminal) return terminal;
				const done = () => succeed(state.out);
				const eff = parseProperties(state, properties.slice(index + 1));
				return eff ? flatMapEager(eff, done) : done();
			});
		};
		return (input, options) => {
			if (input === missing) return missingExit;
			if (options.errors === "all" || options.onExcessProperty !== void 0 || options.concurrency !== void 0 && resolveConcurrency(options.concurrency) !== 1) return (fallback ??= makeFallback())(input, options);
			if (!(typeof input === "object" && input !== null && !Array.isArray(input))) return fail$1(new InvalidType(ast, input, options));
			const props = compileMembers();
			const record = input;
			const out = {};
			const state = {
				ast,
				input: record,
				out,
				issues: void 0,
				options
			};
			try {
				for (let index = 0; index < props.length; index++) {
					const property = props[index];
					const name = property.name;
					const hasKey = property.ownOnly ? Object.hasOwn(record, name) : name in record;
					const value = hasKey ? record[name] : missing;
					const exit = property.parser(value, options);
					if (!effectIsExit(exit)) return resume(state, index, exit);
					if (isSameExit(exit)) {
						if (hasKey) assignProperty(out, name, value);
						continue;
					}
					const terminal = stepProperty(state, property, exit);
					if (terminal) return terminal;
				}
			} catch (error) {
				return die(error);
			}
			return succeed(out);
		};
	}
	_rebuild(recur, recurParameter, checks, encodingChecks) {
		const props = mapOrSame(this.propertySignatures, (ps) => {
			const t = recur(ps.type);
			return t === ps.type ? ps : new PropertySignature(ps.name, t);
		});
		const indexes = mapOrSame(this.indexSignatures, (is) => {
			const p = recurParameter(is.parameter);
			const t = recur(is.type);
			return p === is.parameter && t === is.type ? is : new IndexSignature(p, t);
		});
		return props === this.propertySignatures && indexes === this.indexSignatures && checks === this.checks && encodingChecks === this.encodingChecks ? this : new Objects(props, indexes, this.annotations, checks, void 0, this.context, encodingChecks);
	}
	/** @internal */
	flip(recur) {
		return this._rebuild(recur, recur, this.encodingChecks, this.checks);
	}
	/** @internal */
	recur(recur, recurParameter = recur) {
		return this._rebuild(recur, recurParameter, this.checks, this.encodingChecks);
	}
	/** @internal */
	getExpected() {
		if (this.propertySignatures.length === 0 && this.indexSignatures.length === 0) return "object | array";
		return "object";
	}
};
/** @internal */
function stepProperty(s, p, exit) {
	if (exit._tag === "Failure") return wrapPropertyKeyIssue(s, s.ast, p.name, exit);
	if (isSameExit(exit)) return;
	const value = exit[args];
	if (value !== missing) {
		assignProperty(s.out, p.name, value);
		return;
	}
	delete s.out[p.name];
	if (!isOptional(p.type)) {
		const issue = new Pointer([p.name], new MissingKey(p.type.context?.annotations));
		if (s.options.errors === "all") {
			if (s.issues) s.issues.push(issue);
			else s.issues = [issue];
			return;
		} else return fail$2(new Composite(s.ast, [issue], s.input, s.options));
	}
}
var parsePropertiesOptions = {
	onItem(s, p) {
		if (!(p.ownOnly ? Object.hasOwn(s.input, p.name) : p.name in s.input)) return p.parser(missing, s.options);
		const value = s.input[p.name];
		assignProperty(s.out, p.name, value);
		return p.parser(value, s.options);
	},
	step: stepProperty
};
/** @internal */
var parseProperties = /*#__PURE__*/ iterateEager()(parsePropertiesOptions);
var parsePropertiesConcurrent = /*#__PURE__*/ iterateConcurrent()(parsePropertiesOptions);
function combineChecks(a, b) {
	if (!a) return b;
	if (!b) return a;
	return [...a, ...b];
}
/** @internal */
function struct(fields, checks, annotations) {
	return new Objects(Reflect.ownKeys(fields).map((key) => {
		return new PropertySignature(key, fields[key].ast);
	}), [], annotations, checks);
}
/** @internal */
function getAST(self) {
	return self.ast;
}
/** @internal */
function union(members, options, checks) {
	return new Union$1(members.map(getAST), options, void 0, checks);
}
var toCandidate = /*#__PURE__*/ memoizeIdempotent((ast) => {
	while (true) {
		if (isSuspend(ast)) return unknown;
		const encoding = ast.encoding;
		if (!encoding) return ast.recur?.(toCandidate, identity) ?? ast;
		if (encoding.some((link) => link.transformation._tag === "Middleware" && link.transformation.decode !== identity)) return unknown;
		ast = encoding[encoding.length - 1].to;
	}
});
function getCandidateTypes(ast) {
	switch (ast._tag) {
		case "Null": return ["null"];
		case "Undefined": return ["undefined"];
		case "String":
		case "TemplateLiteral": return ["string"];
		case "Number": return ["number"];
		case "Boolean": return ["boolean"];
		case "Symbol":
		case "UniqueSymbol": return ["symbol"];
		case "BigInt": return ["bigint"];
		case "Arrays": return ["array"];
		case "ObjectKeyword": return [
			"object",
			"array",
			"function"
		];
		case "Objects": return ast.propertySignatures.length || ast.indexSignatures.length ? ["object"] : [
			"string",
			"number",
			"boolean",
			"symbol",
			"bigint",
			"object",
			"array",
			"function"
		];
		case "Enum": return Array.from(new Set(ast.enums.map(([, v]) => typeof v)));
		case "Literal": return [typeof ast.literal];
		case "Union": return Array.from(new Set(ast.types.flatMap(getCandidateTypes)));
		default: return [
			"null",
			"undefined",
			"string",
			"number",
			"boolean",
			"symbol",
			"bigint",
			"object",
			"array",
			"function"
		];
	}
}
/** @internal */
function collectSentinels(ast) {
	switch (ast._tag) {
		default: return [];
		case "Declaration": {
			const s = ast.annotations?.[SENTINELS_ANNOTATION_KEY];
			return Array.isArray(s) ? s : [];
		}
		case "Objects": return ast.propertySignatures.flatMap((ps) => {
			const type = ps.type;
			if (!isOptional(type)) {
				if (isLiteral(type)) return [{
					key: ps.name,
					literal: type.literal
				}];
				if (isUniqueSymbol(type)) return [{
					key: ps.name,
					literal: type.symbol
				}];
			}
			return [];
		});
		case "Arrays": return ast.elements.flatMap((e, i) => {
			if (!isOptional(e)) {
				if (isLiteral(e)) return [{
					key: i,
					literal: e.literal
				}];
				if (isUniqueSymbol(e)) return [{
					key: i,
					literal: e.symbol
				}];
			}
			return [];
		});
		case "Union": {
			if (ast.types.length === 0) return [];
			const members = ast.types.map((type) => collectSentinels(toCandidate(type)));
			return members[0].filter((s) => members.every((sentinels) => sentinels.some((o) => o.key === s.key && o.literal === s.literal)));
		}
		case "Suspend": return collectSentinels(ast.thunk());
	}
}
var candidateIndexCache = /*#__PURE__*/ new WeakMap();
var emptyCandidates = /*#__PURE__*/ Object.freeze([]);
var getRuntimeType = (input) => input === null ? "null" : Array.isArray(input) ? "array" : typeof input;
var objectPrototypeKeys = /*#__PURE__*/ new Set(Reflect.ownKeys(Object.prototype)).add("__proto__");
/**
* Fields named after `Object.prototype` members must be own properties.
*
* @internal
*/
var requiresOwnProperty = (key) => objectPrototypeKeys.has(typeof key === "number" ? globalThis.String(key) : key);
var hasPropertySignature = (input, key) => Object.hasOwn(input, key) || key in input && !requiresOwnProperty(key);
/** @internal */
function getCandidateIndex(types) {
	let index = candidateIndexCache.get(types);
	if (index) return index;
	let bySentinel;
	let sentinelCandidateCount = 0;
	let otherwise;
	let literalCandidates;
	let onlyLiterals = true;
	const literalOf = [];
	for (let i = 0; i < types.length; i++) {
		const a = types[i];
		const encoded = toCandidate(a);
		if (isNever(encoded)) continue;
		if (isLiteral(encoded) || isUniqueSymbol(encoded)) {
			literalCandidates ??= /* @__PURE__ */ new Map();
			const literal = isLiteral(encoded) ? encoded.literal : encoded.symbol;
			literalOf[i] = literal;
			let arr = literalCandidates.get(literal);
			if (!arr) literalCandidates.set(literal, arr = []);
			arr.push(i);
		} else onlyLiterals = false;
		const sentinels = collectSentinels(encoded);
		if (sentinels.length) {
			bySentinel ??= /* @__PURE__ */ new Map();
			sentinelCandidateCount++;
			for (const { key, literal } of sentinels) {
				let entry = bySentinel.get(key);
				if (!entry) bySentinel.set(key, entry = [/* @__PURE__ */ new Map(), /* @__PURE__ */ new Set()]);
				entry[1].add(i);
				let indexes = entry[0].get(literal);
				if (!indexes) entry[0].set(literal, indexes = /* @__PURE__ */ new Set());
				indexes.add(i);
			}
		} else {
			otherwise ??= {};
			const candidateTypes = getCandidateTypes(encoded);
			for (const t of candidateTypes) (otherwise[t] ??= []).push(i);
		}
	}
	const fallbacks = {};
	const getFallback = (type) => fallbacks[type] ??= Object.freeze(otherwise?.[type] ?? emptyCandidates);
	if (onlyLiterals && literalCandidates) {
		literalCandidates.forEach(Object.freeze);
		index = (input) => literalCandidates.get(input) ?? emptyCandidates;
	} else if (bySentinel?.size === 1 && !otherwise) {
		const [key, [byValue]] = bySentinel.entries().next().value;
		const candidates = /* @__PURE__ */ new Map();
		for (const [literal, indexes] of byValue) candidates.set(literal, Object.freeze(Array.from(indexes)));
		const all = Object.freeze(types.map((_, i) => i));
		index = (input, isConstructor) => {
			if (isObjectKeyword(input)) {
				const value = hasPropertySignature(input, key) ? input[key] : void 0;
				if (value !== void 0) return candidates.get(value) ?? emptyCandidates;
				if (isConstructor) return all;
			}
			return emptyCandidates;
		};
	} else if (bySentinel) {
		let commonSentinel;
		for (const entry of bySentinel) if ((!commonSentinel || entry[1][0].size > commonSentinel[1][0].size) && entry[1][1].size === sentinelCandidateCount) commonSentinel = entry;
		index = (input, isConstructor) => {
			const runtimeType = getRuntimeType(input);
			if (!isObjectKeyword(input)) return getFallback(runtimeType);
			const selected = new Set(otherwise?.[runtimeType]);
			let directKey;
			if (commonSentinel) {
				const [key, [byValue]] = commonSentinel;
				const hasKey = hasPropertySignature(input, key);
				const value = hasKey ? input[key] : void 0;
				if (hasKey && (!isConstructor || value !== void 0)) {
					const match = byValue.get(value);
					if (!match) return getFallback(runtimeType);
					for (const i of match) selected.add(i);
					directKey = key;
				}
			}
			if (directKey === void 0) for (const [key, [byValue, all]] of bySentinel) {
				const hasKey = hasPropertySignature(input, key);
				const value = hasKey ? input[key] : void 0;
				if (hasKey && (!isConstructor || value !== void 0)) {
					const match = byValue.get(value);
					if (match) for (const i of match) selected.add(i);
				} else if (isConstructor) for (const i of all) selected.add(i);
			}
			for (const [key, [byValue, all]] of bySentinel) {
				if (key === directKey) continue;
				const hasKey = hasPropertySignature(input, key);
				const value = hasKey ? input[key] : void 0;
				if (hasKey && (!isConstructor || value !== void 0)) {
					const match = byValue.get(value);
					for (const i of selected) if (all.has(i) && !match?.has(i)) selected.delete(i);
				}
			}
			return Array.from(selected).sort((a, b) => a - b);
		};
	} else index = (input) => {
		const fallback = getFallback(getRuntimeType(input));
		return literalCandidates ? fallback.filter((i) => literalOf[i] === void 0 || literalOf[i] === input) : fallback;
	};
	candidateIndexCache.set(types, index);
	return index;
}
/**
* Constructs a {@link Union}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Union$1 = class extends ASTNodeImpl {
	_tag = "Union";
	types;
	options;
	encodingChecks;
	constructor(types, options, annotations, checks, encoding, context, encodingChecks) {
		super(annotations, checks, encoding, context);
		this.types = types;
		this.options = options;
		this.encodingChecks = encodingChecks;
	}
	/** @internal */
	getParser(compile, compileField) {
		const ast = this;
		const isConstructor = compileField !== void 0;
		const parsers = [];
		const parser = (i) => parsers[i] ??= compile(ast.types[i]);
		let index;
		return (input, options) => {
			if (input === missing) return missingExit;
			const candidates = (index ??= getCandidateIndex(ast.types))(input, isConstructor);
			if (candidates.length === 0) return fail$1(new AnyOf(ast, [], input, options));
			if (candidates.length === 1) {
				const result = parser(candidates[0])(input, options);
				if (result._tag === "Success") return result;
				return effectIsExit(result) ? failSingleUnionCandidate(ast, result.cause, input, options) : catchSingleUnionCandidate(ast, result, input, options);
			}
			return parseUnionCandidates(ast, parser, candidates, input, options);
		};
	}
	_rebuild(recur, checks, encodingChecks) {
		const types = mapOrSame(this.types, recur);
		return types === this.types && checks === this.checks && encodingChecks === this.encodingChecks ? this : new Union$1(types, this.options, this.annotations, checks, void 0, this.context, encodingChecks);
	}
	/** @internal */
	recur(recur) {
		return this._rebuild(recur, this.checks, this.encodingChecks);
	}
	/** @internal */
	flip(recur) {
		return this._rebuild(recur, this.encodingChecks, this.checks);
	}
	/** @internal */
	matchPart(s, options) {
		for (const type of this.types) {
			const out = type.matchPart(s, options);
			if (out !== void 0) return out;
		}
	}
	/** @internal */
	getExpected(getExpected) {
		const expected = this.annotations?.expected;
		if (typeof expected === "string") return expected;
		if (this.types.length === 0) return "never";
		const types = this.types.map((type) => {
			const encoded = toEncoded$1(type);
			switch (encoded._tag) {
				case "Arrays": {
					const literals = encoded.elements.filter(isLiteral);
					if (literals.length > 0) return `${formatIsMutable(encoded.isMutable)}[ ${literals.map((e) => getExpected(e) + formatIsOptional(e.context?.isOptional)).join(", ")}, ... ]`;
					break;
				}
				case "Objects": {
					const literals = encoded.propertySignatures.filter((ps) => isLiteral(ps.type));
					if (literals.length > 0) return `{ ${literals.map((ps) => `${formatIsMutable(ps.type.context?.isMutable)}${formatPropertyKey(ps.name)}${formatIsOptional(ps.type.context?.isOptional)}: ${getExpected(ps.type)}`).join(", ")}, ... }`;
					break;
				}
			}
			return getExpected(encoded);
		});
		return Array.from(new Set(types)).join(" | ");
	}
};
function failSingleUnionCandidate(ast, cause, input, options) {
	const issue = getSchemaIssue(cause);
	if (!issue) return failCause(cause);
	return fail$2(new AnyOf(ast, [issue], input, options));
}
function catchSingleUnionCandidate(ast, result, input, options) {
	return catchCause(result, (cause) => failSingleUnionCandidate(ast, cause, input, options));
}
function parseUnionCandidates(ast, parser, candidates, input, options) {
	const state = {
		ast,
		parser,
		input,
		out: void 0,
		successes: ast.options?.mode === "oneOf" ? [] : void 0,
		issues: void 0,
		options
	};
	const eff = parseUnion(state, candidates);
	if (!eff) {
		if (state.out) return state.out;
		return fail$1(new AnyOf(ast, state.issues ?? [], input, options));
	}
	if (effectIsExit(eff)) return resumeUnion(eff, state);
	let first = true;
	return suspend(() => {
		if (!first) return parseUnionCandidates(ast, parser, candidates, input, options);
		first = false;
		return resumeUnion(eff, state);
	});
}
function resumeUnion(eff, state) {
	return flatMapEager(eff, (_) => {
		if (state.out) return isSameExit(state.out) ? succeed$1(state.input) : state.out;
		return fail$1(new AnyOf(state.ast, state.issues ?? [], state.input, state.options));
	});
}
var parseUnion = /*#__PURE__*/ iterateEager()({
	onItem(s, i) {
		return s.parser(i)(s.input, s.options);
	},
	step(s, i, exit) {
		if (exit._tag === "Failure") {
			const issue = getSchemaIssue(exit.cause);
			if (issue === void 0) return exit;
			if (s.issues) s.issues.push(issue);
			else s.issues = [issue];
		} else {
			if (s.out && s.successes) {
				s.successes.push(s.ast.types[i]);
				return fail$2(new OneOf(s.ast, s.successes, s.input, s.options));
			}
			s.out = exit;
			if (s.successes) s.successes.push(s.ast.types[i]);
			else return void_$1;
		}
	}
});
var nonFiniteLiterals = /*#__PURE__*/ new Union$1([
	/*#__PURE__*/ new Literal$1("Infinity"),
	/*#__PURE__*/ new Literal$1("-Infinity"),
	/*#__PURE__*/ new Literal$1("NaN")
]);
function formatIsMutable(isMutable) {
	return isMutable ? "" : "readonly ";
}
function formatIsOptional(isOptional) {
	return isOptional ? "?" : "";
}
/**
* Constructs a {@link Filter}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Filter = class extends Class$1 {
	_tag = "Filter";
	run;
	annotations;
	/**
	* Whether the parsing process should be aborted after this check has failed.
	*/
	aborted;
	constructor(run, annotations = void 0, aborted = false) {
		super();
		this.run = run;
		this.annotations = annotations;
		this.aborted = aborted;
	}
	annotate(annotations) {
		return new Filter(this.run, {
			...this.annotations,
			...annotations
		}, this.aborted);
	}
	abort() {
		return new Filter(this.run, this.annotations, true);
	}
	and(other, annotations) {
		return new FilterGroup([this, other], annotations);
	}
};
/**
* Constructs a {@link FilterGroup}.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var FilterGroup = class extends Class$1 {
	_tag = "FilterGroup";
	checks;
	annotations;
	constructor(checks, annotations = void 0) {
		super();
		this.checks = checks;
		this.annotations = annotations;
	}
	annotate(annotations) {
		return new FilterGroup(this.checks, {
			...this.annotations,
			...annotations
		});
	}
	and(other, annotations) {
		return new FilterGroup([this, other], annotations);
	}
};
/** @internal */
function makeFilter$1(filter, annotations, aborted = false) {
	return new Filter((input, ast, options) => normalizeFilterOutput(ast, filter(input, ast, options), input, options), annotations, aborted);
}
/** @internal */
function isFinite(annotations) {
	return makeFilter$1((n) => globalThis.Number.isFinite(n), {
		expected: "a finite number",
		representation: {
			id: "effect/schema/isFinite",
			payload: null
		},
		toJsonSchema: () => ({ type: "number" }),
		toCode: () => ({ runtime: "Schema.isFinite()" }),
		arbitraryConstraint: { number: "finite" },
		...annotations
	});
}
var numberToJson = /*#__PURE__*/ new Link(/*#__PURE__*/ new Union$1([/* @__PURE__ */ appendChecks(number, [/*#__PURE__*/ isFinite()]), nonFiniteLiterals]), /*#__PURE__*/ new Transformation(/*#__PURE__*/ Number$3(), /*#__PURE__*/ transform$1((n) => globalThis.Number.isFinite(n) ? n : globalThis.String(n))));
/**
* Creates a {@link Filter} that validates strings by running `RegExp.test`.
*
* **When to use**
*
* Use when string validation should be represented as a schema `Filter` backed
* by a regular expression.
*
* **Details**
*
* The filter can be used with `Schema.check` or attached directly to a
* `String` AST node through checks. The regular expression is cloned and its
* `lastIndex` is reset before each test, so global and sticky expressions are
* deterministic and the provided regular expression is not mutated. The
* regular expression source is stored in annotations for serialization and
* arbitrary generation.
*
* **Gotchas**
*
* Arbitrary metadata preserves both `regExp.source` and `regExp.flags`.
* Implementations that cannot consume all flags may still use the source as a
* generation hint because the Schema filter validates every generated value.
* JSON Schema has no way to carry JavaScript regular-expression flags. Unless
* annotations provide `toJsonSchema`, the RegExp constraint is omitted from
* JSON Schema export.
*
* **Example** (Validating an email pattern)
*
* ```ts import.meta.vitest
* import { SchemaAST } from "effect"
*
* const emailFilter = SchemaAST.isPattern(/^[^@]+@[^@]+$/)
* emailFilter.run("alice@example.com", SchemaAST.string, {}) // => undefined
* emailFilter.run("invalid", SchemaAST.string, {})?._tag // => "InvalidValue"
* ```
*
* @see {@link Filter}
* @stability stable
* @category constructors
* @since 4.0.0
*/
function isPattern$1(regExp, annotations) {
	const copy = new globalThis.RegExp(regExp);
	const payload = {
		source: copy.source,
		flags: copy.flags
	};
	return makeFilter$1((s) => {
		copy.lastIndex = 0;
		return copy.test(s);
	}, {
		expected: `a string matching the RegExp ${payload.source}`,
		representation: {
			id: "effect/schema/isPattern",
			payload
		},
		toJsonSchema: () => [{}, true],
		arbitraryConstraint: { patterns: [payload] },
		...annotations
	});
}
var bodyOwners = /*#__PURE__*/ new WeakMap();
function copy(ast, changes) {
	const out = Object.assign(Object.create(Object.getPrototypeOf(ast)), ast, changes);
	if (Reflect.ownKeys(changes).every((key) => key === "context" || key === "encoding")) bodyOwners.set(out, getContextOwner(ast));
	return out;
}
/** @internal */
function getContextOwner(ast) {
	const existing = bodyOwners.get(ast);
	if (existing !== void 0) return existing;
	if (ast.encoding === void 0) return ast;
	const owner = Object.assign(Object.create(Object.getPrototypeOf(ast)), ast, { encoding: void 0 });
	bodyOwners.set(ast, owner);
	return owner;
}
/** @internal */
function replaceEncoding(ast, encoding) {
	return ast.encoding === encoding ? ast : copy(ast, { encoding });
}
/** @internal */
function replaceContext(ast, context) {
	if (ast.context === context) return ast;
	const owner = getContextOwner(ast);
	if (owner.context === context && owner.encoding === ast.encoding) return owner;
	return copy(ast, { context });
}
/** @internal */
function getLastEncoding(ast) {
	return ast.encoding ? getLastEncoding(ast.encoding[ast.encoding.length - 1].to) : ast;
}
/** @internal */
function annotate(ast, annotations) {
	if (ast.checks) {
		const last = ast.checks[ast.checks.length - 1];
		return replaceChecks(ast, append(ast.checks.slice(0, -1), last.annotate(annotations)));
	}
	return copy(ast, { annotations: {
		...ast.annotations,
		...annotations
	} });
}
/** @internal */
function replaceChecks(ast, checks) {
	if (ast._tag === "Suspend" && checks) throw new Error("Cannot add checks to Suspend");
	if (ast.checks === checks) return ast;
	return copy(ast, { checks });
}
/** @internal */
function appendChecks(ast, checks) {
	return replaceChecks(ast, combineChecks(ast.checks, checks));
}
/** @internal */
function mapLink(link, f) {
	const to = f(link.to);
	return to === link.to ? link : new Link(to, link.transformation);
}
function updateLastLink(encoding, f) {
	const links = encoding;
	const last = links[links.length - 1];
	const out = mapLink(last, f);
	return out === last ? encoding : append(encoding.slice(0, encoding.length - 1), out);
}
/** @internal */
function applyToLastLink(f) {
	return (ast) => ast.encoding ? replaceEncoding(ast, updateLastLink(ast.encoding, f)) : ast;
}
/** @internal */
function replaceContextLastLink(ast, context) {
	return applyToLastLink((ast) => replaceContext(ast, context))(ast);
}
/** @internal */
function applyToSelfOrLastLinkEncodingIdempotent(f, options) {
	function out(ast) {
		if (ast.encoding) {
			const last = ast.encoding[ast.encoding.length - 1];
			return options?.stopAt?.(last) ? ast : replaceEncoding(ast, updateLastLink(ast.encoding, out));
		}
		return f(ast);
	}
	return memoizeIdempotent(out);
}
function appendTransformation(from, transformation, to) {
	const link = new Link(from, transformation);
	return replaceEncoding(to, to.encoding ? [...to.encoding, link] : [link]);
}
function mapOrSame(as, f) {
	let out;
	for (let i = 0; i < as.length; i++) {
		const a = as[i];
		const fa = f(a);
		if (out) out[i] = fa;
		else if (fa !== a) {
			out = new Array(as.length);
			for (let j = 0; j < i; j++) out[j] = as[j];
			out[i] = fa;
		}
	}
	return out ?? as;
}
/** @internal */
function annotateKey(ast, annotations) {
	return replaceContext(ast, ast.context ? new Context(ast.context.isOptional, ast.context.isMutable, ast.context.constructorDefault, {
		...ast.context.annotations,
		...annotations
	}) : new Context(false, false, void 0, annotations));
}
/** @internal */
var optionalKey$1 = /*#__PURE__*/ memoizeIdempotent((ast) => {
	return optionalKeyLastLink(replaceContext(ast, ast.context ? ast.context.isOptional === false ? new Context(true, ast.context.isMutable, ast.context.constructorDefault, ast.context.annotations) : ast.context : new Context(true, false)));
});
var optionalKeyLastLink = /*#__PURE__*/ applyToLastLink(optionalKey$1);
/** @internal */
function withConstructorDefault$1(ast, defaultValue) {
	return replaceContext(ast, ast.context ? new Context(ast.context.isOptional, ast.context.isMutable, defaultValue, ast.context.annotations) : new Context(false, false, defaultValue));
}
/**
* Attaches a `Transformation` to the `to` AST, making it decode from the
* `from` AST and encode back to it.
*
* **Details**
*
* This is the low-level primitive behind `Schema.decodeTo`. It appends a
* {@link Link} to the `to` node's encoding chain.
*
* - Returns a new AST with the same type as `to`.
*
* @see {@link Link}
* @see {@link Encoding}
* @see {@link flip}
* @stability stable
* @category transforming
* @since 4.0.0
*/
function decodeTo$1(from, to, transformation) {
	return appendTransformation(from, transformation, to);
}
/**
* Returns `true` if the AST node represents an optional property.
*
* **Details**
*
* Checks `ast.context?.isOptional`. Defaults to `false` when no
* {@link Context} is set.
*
* @see `Schema.optionalKey`
* @see {@link Context}
* @stability stable
* @category predicates
* @since 4.0.0
*/
function isOptional(ast) {
	return ast.context?.isOptional ?? false;
}
/** @internal */
function isMutable(ast) {
	return ast.context?.isMutable ?? false;
}
function isStructuralCheck(check) {
	return check.annotations?.["~structural"] === true || check._tag === "FilterGroup" && check.checks.every(isStructuralCheck);
}
function extractStructuralChecks(checks) {
	function extract(check) {
		if (isStructuralCheck(check)) return [check];
		return check._tag === "FilterGroup" ? check.checks.flatMap(extract) : [];
	}
	const out = checks.flatMap(extract);
	return isArrayNonEmpty(out) ? out : void 0;
}
function canPreserveEncodingChecks(ast) {
	let preserve = true;
	function visit(child) {
		preserve = preserve && !child.encoding && !isSuspend(child);
		if (preserve && "recur" in child) child.recur(visit);
		return child;
	}
	if ("recur" in ast) ast.recur(visit);
	return preserve;
}
/**
* Strips all encoding transformations from an AST, returning the decoded
* (type-level) representation.
*
* **Details**
*
* - Memoized: same input reference → same output reference.
* - Recursively walks into composite nodes ({@link Arrays}, {@link Objects},
*   {@link Union}, {@link Suspend}).
*
* **Example** (Getting the type AST)
*
* ```ts import.meta.vitest
* import { Schema, SchemaAST } from "effect"
*
* const schema = Schema.NumberFromString
* const typeAst = SchemaAST.toType(schema.ast)
* typeAst._tag // => "Number"
* ```
*
* @see {@link toEncoded}
* @see {@link flip}
* @stability stable
* @category transforming
* @since 4.0.0
*/
var toType$1 = /*#__PURE__*/ memoizeIdempotent((ast) => {
	const owner = getContextOwner(ast);
	if (owner !== ast) {
		const type = toType$1(owner);
		return type === owner && ast.encoding === void 0 ? ast : replaceContext(type, ast.context);
	}
	const type = "recur" in ast ? ast.recur(toType$1) : ast;
	if ("encodingChecks" in type && type.encodingChecks) return copy(type, {
		encodingChecks: void 0,
		checks: combineChecks(canPreserveEncodingChecks(ast) ? type.encodingChecks : isArrays(type) || isObjects(type) || isDeclaration(type) && type.typeParameters.length > 0 ? extractStructuralChecks(type.encodingChecks) : void 0, type.checks)
	});
	return type;
});
/**
* Returns the encoded (wire-format) AST by flipping and then stripping
* encodings.
*
* **Details**
*
* Equivalent to `toType(flip(ast))`. This gives you the AST that describes
* the shape of the serialized/encoded data.
*
* - Memoized: same input reference → same output reference.
*
* **Example** (Getting the encoded AST)
*
* ```ts import.meta.vitest
* import { Schema, SchemaAST } from "effect"
*
* const schema = Schema.NumberFromString
* const encodedAst = SchemaAST.toEncoded(schema.ast)
* encodedAst._tag // => "String"
* ```
*
* @see {@link toType}
* @see {@link flip}
* @stability stable
* @category transforming
* @since 4.0.0
*/
var toEncoded$1 = /*#__PURE__*/ memoizeIdempotent((ast) => {
	return toType$1(flip(ast));
});
function flipEncoding(ast, encoding) {
	const links = encoding;
	const len = links.length;
	const last = links[len - 1];
	const ls = [new Link(flip(replaceEncoding(ast, void 0)), links[0].transformation.flip())];
	for (let i = 1; i < len; i++) ls.unshift(new Link(flip(links[i - 1].to), links[i].transformation.flip()));
	const to = flip(last.to);
	if (to.encoding) return replaceEncoding(to, [...to.encoding, ...ls]);
	else return replaceEncoding(to, ls);
}
/**
* Swaps the decode and encode directions of an AST's {@link Encoding} chain.
*
* **Details**
*
* After flipping, what was decoding becomes encoding and vice versa. This is
* the core operation behind `Schema.encodeEffect` — encoding a value is decoding
* with a flipped SchemaAST.
*
* - Memoized: same input reference → same output reference.
* - Recursively walks composite nodes.
*
* @see {@link toType}
* @see {@link toEncoded}
* @stability stable
* @category transforming
* @since 4.0.0
*/
var flip = /*#__PURE__*/ memoize((ast) => {
	if (ast.encoding) return flipEncoding(ast, ast.encoding);
	const owner = getContextOwner(ast);
	if (owner !== ast) {
		const flipped = flip(owner);
		return flipped === owner ? ast : replaceContext(flipped, ast.context);
	}
	return "flip" in ast ? ast.flip(flip) : "recur" in ast ? ast.recur(flip) : ast;
});
function fromConst(ast, value) {
	const succeed$7 = value === 0 ? sameExit : succeed(value);
	return (input, options) => {
		if (input === missing) return missingExit;
		if (input === value) return succeed$7;
		return fail$1(new InvalidType(ast, input, options));
	};
}
function fromRefinement(ast, refinement) {
	return (input, options) => {
		if (input === missing) return missingExit;
		if (refinement(input)) return sameExit;
		return fail$1(new InvalidType(ast, input, options));
	};
}
/** @internal */
var parameterFromPropertyKey = /*#__PURE__*/ applyToSelfOrLastLinkEncodingIdempotent((ast) => {
	switch (ast._tag) {
		default: return ast;
		case "Number": return ast.toCodecStringTree();
		case "Union": return ast.recur(parameterFromPropertyKey);
	}
});
/** @internal */
var parameterFromString = /*#__PURE__*/ applyToSelfOrLastLinkEncodingIdempotent((ast) => {
	switch (ast._tag) {
		default: return ast;
		case "Symbol":
		case "UniqueSymbol": return ast.toCodecStringTree();
		case "Union": return ast.recur(parameterFromString);
	}
});
/**
* any string, including newlines
* @internal
*/
var STRING_PATTERN = "[\\s\\S]*?";
var isStringFiniteRegExp = /*#__PURE__*/ new globalThis.RegExp(`^${FINITE_PATTERN}$`);
var isStringNumberRegExp = /*#__PURE__*/ new globalThis.RegExp(`^(?:${FINITE_PATTERN}|Infinity|-Infinity|NaN)$`);
/** @internal */
function isStringFinite(annotations) {
	return isPattern$1(isStringFiniteRegExp, {
		expected: "a string representing a finite number",
		representation: {
			id: "effect/schema/isStringFinite",
			payload: null
		},
		toJsonSchema: () => ({ pattern: isStringFiniteRegExp.source }),
		...annotations
	});
}
var finiteString = /*#__PURE__*/ appendChecks(string, [/*#__PURE__*/ isStringFinite()]);
var finiteToString = /*#__PURE__*/ new Link(finiteString, numberFromString);
var numberToString = /*#__PURE__*/ new Link(/*#__PURE__*/ new Union$1([finiteString, nonFiniteLiterals]), numberFromString);
/** @internal */
function collectIssues(checks, value, issues, ast, options) {
	for (let i = 0; i < checks.length; i++) {
		const check = checks[i];
		if (check._tag === "FilterGroup") {
			issues = collectIssues(check.checks, value, issues, ast, options);
			if (issues && (options.errors !== "all" || issues[issues.length - 1].filter.aborted)) return issues;
		} else {
			const issue = check.run(value, ast, options);
			if (issue) {
				const filter = new Filter$1(check, issue, value, options);
				if (issues) issues.push(filter);
				else issues = [filter];
				if (options.errors !== "all" || check.aborted) return issues;
			}
		}
	}
	return issues;
}
/** @internal */
function getConstructorDescriptor(ast) {
	if (!isDeclaration(ast)) return void 0;
	const getDescriptor = ast.annotations?.[CONSTRUCTOR_ANNOTATION_KEY];
	return isFunction(getDescriptor) ? getDescriptor(ast.typeParameters) : void 0;
}
/**
* Returns a single annotation value by key from the AST node.
*
* **Details**
*
* Like {@link resolve}, reads from the last check's annotations when checks
* are present. Returns `undefined` if the key is not found.
*
* @see {@link resolve}
* @stability stable
* @category annotations
* @since 4.0.0
*/
var resolveAt = resolveAt$1;
function isJsonLeaf(u) {
	return u === null || typeof u === "string" || typeof u === "boolean" || typeof u === "number" && globalThis.Number.isFinite(u);
}
function isStringTreeLeaf(u) {
	return u === void 0 || typeof u === "string";
}
function isTree(u, isLeaf) {
	const cache = /* @__PURE__ */ new WeakMap();
	const stack = [];
	outer: while (true) {
		if (typeof u !== "object" || u === null) {
			if (!isLeaf(u)) return false;
		} else {
			const value = u;
			const cached = cache.get(value);
			if (cached === false) return false;
			if (cached === void 0) {
				const isArray = Array.isArray(value);
				if (!isArray) {
					const prototype = Object.getPrototypeOf(value);
					if (prototype !== null && prototype !== Object.prototype && Object.getPrototypeOf(prototype) !== null) return false;
				}
				cache.set(value, false);
				stack.push({
					value,
					keys: isArray ? value.length : Object.keys(value),
					index: 0
				});
			}
		}
		while (stack.length > 0) {
			const frame = stack[stack.length - 1];
			const keys = frame.keys;
			if (typeof keys === "number") {
				if (frame.index < keys) {
					u = frame.value[frame.index++];
					continue outer;
				}
			} else if (frame.index < keys.length) {
				u = frame.value[keys[frame.index++]];
				continue outer;
			}
			cache.set(frame.value, true);
			stack.pop();
		}
		return true;
	}
}
/**
* Returns true if the value is a JSON value.
*
* When a cyclic reference is detected, returns false.
*
* @internal
*/
function isJson$1(u) {
	return isTree(u, isJsonLeaf);
}
/** @internal */
var Json$1 = /*#__PURE__*/ new Declaration([], () => (input, ast, options) => isJson$1(input) ? sameExit : fail$1(new InvalidType(ast, input, options)), {
	representation: {
		id: "effect/schema/Json",
		payload: null
	},
	expected: "JSON value",
	toCodecJson: () => void 0,
	toCodecStringTree: () => unknownToStringTree
});
/** @internal */
var unknownToJson = /*#__PURE__*/ new Link(Json$1, /*#__PURE__*/ passthrough());
/** @internal */
var objectKeywordToJson = /*#__PURE__*/ new Link(/*#__PURE__*/ new Union$1([/*#__PURE__*/ new Arrays(false, [], [Json$1]), /*#__PURE__*/ new Objects([], [/*#__PURE__*/ new IndexSignature(string, Json$1)])]), /*#__PURE__*/ passthrough());
/**
* Returns true if the value is a StringTree value.
*
* When a cyclic reference is detected, returns false.
*
* @internal
*/
function isStringTree(u) {
	return isTree(u, isStringTreeLeaf);
}
/** @internal */
var unknownToStringTree = /*#__PURE__*/ new Link(/* @__PURE__ */ new Declaration([], () => (input, ast, options) => isStringTree(input) ? sameExit : fail$1(new InvalidType(ast, input, options)), {
	expected: "StringTree",
	toCodecStringTree: () => void 0
}), /*#__PURE__*/ passthrough());
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/schema/interpreter.js
var flatMapTransformation = (result, current, f) => isSameExit(result) ? f(current) : flatMapEager(result, f);
function compileTransformation(transformation) {
	const apply = compileTransformationUnsafe(transformation);
	return (result, current, options) => {
		try {
			return apply(result, current, options);
		} catch (error) {
			return die(error);
		}
	};
}
function compileTransformationUnsafe(transformation) {
	if (transformation._tag === "Middleware") return (result, current, options) => {
		return fromOptionalEffect(isSameExit(result) ? transformation.decode(succeed(toOption(current)), options) : transformation.decode(mapEager(result, toOption), options));
	};
	const getter = transformation.decode;
	switch (getter._tag) {
		case "Passthrough": return (result, current) => isSameExit(result) ? succeed(current) : result;
		case "Transform": {
			const transform = (value) => value === missing ? missingExit : succeed(getter.transform(value));
			return (result, current) => flatMapTransformation(result, current, transform);
		}
		case "TransformOptional": {
			const transform = (value) => fromOptionExit(getter.transform(toOption(value)));
			return (result, current) => flatMapTransformation(result, current, transform);
		}
		case "TransformEffect": return (result, current, options) => flatMapTransformation(result, current, (value) => value === missing ? missingExit : getter.transform(value, options));
		case "TransformOptionalEffect": return (result, current, options) => flatMapTransformation(result, current, (value) => fromOptionalEffect(getter.transform(toOption(value), options)));
	}
}
var fromOptionalEffect = (effect) => flatMapEager(effect, fromOptionExit);
/** @internal */
var wrapEncoding = (ast, input, options, effect) => catchCause(effect, (cause) => failCauseSync(() => map$2(cause, (issue) => new Encoding(ast, issue, input, options))));
function makeConstructorParser(descriptor, compile) {
	const transform = compileTransformation(descriptor.link.transformation);
	let sourceParser;
	return (input, options) => {
		if (input === missing) return missingExit;
		if (descriptor.isConstructed(input)) return sameExit;
		const result = (sourceParser ??= compile(descriptor.link.to))(input, options);
		return transform(result, input, options);
	};
}
function withDefault(ast, parser) {
	const defaultValue = ast.context.constructorDefault;
	return (input, options) => {
		if (input !== missing && input !== void 0) return parser(input, options);
		const result = defaultValue;
		if (effectIsExit(result) && result._tag === "Success") {
			const local = parser(result[args], options);
			return isSameExit(local) ? result : local;
		}
		return flatMapEager(wrapEncoding(ast, input, options, result), (value) => {
			const local = parser(value, options);
			return isSameExit(local) ? succeed(value) : local;
		});
	};
}
/** @internal */
function compileField(ast, compile) {
	const parser = compile(ast);
	return ast.context?.constructorDefault === void 0 ? parser : withDefault(ast, parser);
}
/** @internal */
function compile(ast, compile, compileField, base, specialize) {
	if (ast._tag === "Declaration") for (const parameter of ast.typeParameters) compile(parameter);
	const descriptor = compileField ? getConstructorDescriptor(ast) : void 0;
	const parser = descriptor ? makeConstructorParser(descriptor, compile) : base ?? ast.getParser(compile, compileField);
	const checks = ast.checks;
	const links = ast.encoding;
	const transformations = links?.map((link) => compileTransformation(link.transformation));
	const encodingChecks = ast.encodingChecks;
	if (!links && !checks && !encodingChecks) return parser;
	let encodingParsers;
	const parseChecks = (input, options) => {
		let result = parser(input, options);
		try {
			if (encodingChecks && !options.disableChecks) {
				if (effectIsExit(result)) {
					if (result._tag === "Success") {
						const output = isSameExit(result) ? input : result[args];
						if (input !== missing && output !== missing) {
							const issues = collectIssues(encodingChecks, input, void 0, ast, options);
							if (issues) result = fail$1(new Composite(ast, issues, input, options));
						}
					}
				} else result = flatMap(result, (value) => {
					if (input !== missing && value !== missing) {
						const issues = collectIssues(encodingChecks, input, void 0, ast, options);
						if (issues) return fail$1(new Composite(ast, issues, input, options));
					}
					return succeed$1(value);
				});
			}
			if (checks && !options.disableChecks) {
				if (effectIsExit(result)) {
					if (result._tag === "Success") {
						const value = isSameExit(result) ? input : result[args];
						if (value === missing) return result;
						const issues = collectIssues(checks, value, void 0, ast, options);
						if (issues) result = fail$1(new Composite(ast, issues, value, options));
					}
				} else result = flatMap(result, (value) => {
					if (value !== missing) {
						const issues = collectIssues(checks, value, void 0, ast, options);
						if (issues) return fail$1(new Composite(ast, issues, value, options));
					}
					return succeed$1(value);
				});
			}
			return result;
		} catch (error) {
			return die(error);
		}
	};
	const parseLocal = specialize === void 0 ? parseChecks : specialize(parseChecks);
	if (!links) return parseLocal;
	return (input, options) => {
		const parsers = encodingParsers ??= links.map((link) => compile(link.to));
		let current = input;
		let result = parsers[parsers.length - 1](input, options);
		for (let i = links.length - 1; i >= 0; i--) {
			result = transformations[i](result, current, options);
			if (i !== 0) {
				const next = parsers[i - 1];
				if (result._tag === "Success") {
					current = result[args];
					result = next(current, options);
				} else result = flatMapEager(result, (value) => {
					const nextResult = next(value, options);
					return isSameExit(nextResult) ? succeed(value) : nextResult;
				});
			}
		}
		if (result._tag === "Success") {
			const value = result[args];
			const local = parseLocal(value, options);
			return isSameExit(local) ? result : local;
		}
		result = wrapEncoding(ast, input, options, result);
		return flatMapEager(result, (value) => {
			const local = parseLocal(value, options);
			return isSameExit(local) ? succeed(value) : local;
		});
	};
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/schema/compilerRegistry.js
/** @internal */
var invalid = /*#__PURE__*/ Symbol();
var cache = /*#__PURE__*/ new WeakMap();
/** @internal */
var compilerAdaptersEnabled = false;
var decodeChild = (ast) => compilerAdaptersEnabled ? lazyParser(resolve, ast, "parser") : resolve(ast).parser;
var makeChild = (ast) => compilerAdaptersEnabled ? lazyParser(resolve, ast, "makeEffect") : resolve(ast).makeEffect;
var makeField = (ast) => compileField(ast, makeChild);
var InterpretedEntry = class {
	ast;
	constructor(ast) {
		this.ast = ast;
	}
	get decodeEffect() {
		return this.cachedDecodeEffect ??= compile(this.ast, decodeChild);
	}
	get parser() {
		return this.decodeEffect;
	}
	get makeEffect() {
		return this.cachedMakeEffect ??= compile(this.ast, makeChild, makeField);
	}
};
/** @internal */
function lazyParser(resolve, ast, operation) {
	const entry = resolve(ast);
	if (entry.compiled === void 0 || Object.hasOwn(entry, operation)) return entry[operation];
	let parser;
	return (input, options) => (parser ??= entry[operation])(input, options);
}
/** @internal */
function resolve(ast) {
	const cached = cache.get(ast);
	if (cached !== void 0) return cached;
	const entry = new InterpretedEntry(ast);
	cache.set(ast, entry);
	return entry;
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/SchemaParser.js
/**
* Runs schemas against real values.
*
* Schema parsers construct values from schema input, check whether a value
* matches a schema, decode encoded input, and encode decoded values back to
* their external form. This module exposes those operations through several
* result styles, including `Effect`, `Promise`, `Exit`, `Option`, `Result`, and
* synchronous functions that throw. It also contains the lower-level runner that
* walks a schema AST and reports schema failures as `SchemaIssue.Issue` values.
*
* @stability stable
* @since 4.0.0
*/
/**
* Creates an effectful maker for the schema's decoded type side.
*
* **When to use**
*
* Use to construct decoded schema values in `Effect` while preserving
* construction failures as `SchemaIssue.Issue` values in the error channel.
*
* **Details**
*
* The returned function accepts constructor input, applies constructor defaults,
* runs type-side validation unless checks are disabled, and fails with a
* `SchemaIssue.Issue` when construction fails.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
function makeEffect(schema) {
	const ast = schema.ast;
	let parser;
	return (input, options) => {
		return (parser ??= runWithCompiler(constructorCompiler, toType$1(ast)))(input, options?.disableChecks ? options?.parseOptions ? {
			...options.parseOptions,
			disableChecks: true
		} : { disableChecks: true } : options?.parseOptions);
	};
}
/**
* Creates a synchronous maker that returns `Option.some` with the constructed
* value on success, or `Option.none` when construction fails with schema issues.
*
* **When to use**
*
* Use when you need to validate schema constructor input and only care whether
* construction succeeds, without exposing `SchemaIssue.Issue` details.
*
* **Gotchas**
*
* Only causes made entirely of schema issues are converted to `Option.none`.
* Causes that contain defects, interruptions, or asynchronous work at this
* synchronous boundary throw an `Error` whose cause is the underlying `Cause`.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
function makeOption(schema) {
	const parser = makeEffect(schema);
	return (input, options) => {
		const exit = runSyncExit(parser(input, options));
		if (isSuccess(exit)) return some(exit.value);
		getSchemaIssueOrThrow(exit.cause, "Option adapter can only return none for schema issues");
		return none();
	};
}
/**
* Creates a synchronous maker for the schema's decoded type side.
*
* **When to use**
*
* Use to construct decoded schema values synchronously when invalid input
* should throw an `Error` whose cause is `SchemaIssue.Issue`.
*
* **Details**
*
* The returned function constructs a value from constructor input and throws an
* `Error` with the `SchemaIssue.Issue` in its `cause` when construction fails.
* Schema validation failures use the generic message `"Schema validation failed"`.
* Format the `cause` explicitly with `SchemaIssue.makeFormatterDefault()` when
* human-readable details are needed.
*
* **Gotchas**
*
* Causes that contain defects, interruptions, or asynchronous work at this
* synchronous boundary throw an `Error` whose cause is the underlying `Cause`,
* instead of being converted to a schema validation error.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
function make$5(schema) {
	return makeConstructorSync(toType$1(schema.ast));
}
/**
* Creates a type guard that checks whether an input satisfies the schema's decoded
* type side.
*
* **When to use**
*
* Use to build a type guard for checking the decoded side of a schema without
* exposing issue details.
*
* **Details**
*
* The guard returns `true` on successful validation and `false` when validation
* fails only with schema issues, without exposing issue details.
*
* **Gotchas**
*
* Only causes made entirely of schema issues are converted to `false`. Causes
* that contain defects, interruptions, or asynchronous work at this synchronous
* boundary throw an `Error` whose cause is the underlying `Cause`.
*
* @stability stable
* @category guards
* @since 3.10.0
*/
function is$1(schema) {
	return _is(schema.ast);
}
function makeIs(ast) {
	if (!compilerAdaptersEnabled) {
		const parser = asExit(run(ast));
		return (input) => {
			const exit = parser(input, defaultParseOptions);
			if (isSuccess(exit)) return true;
			getSchemaIssueOrThrow(exit.cause, "Type guard adapter can only return false for schema issues");
			return false;
		};
	}
	const entry = resolve(ast);
	const guard = entry.is;
	if (guard !== void 0) return (input) => {
		try {
			return guard(input, defaultParseOptions);
		} catch (error) {
			getSchemaIssueOrThrow(die$1(error), "Type guard adapter can only return false for schema issues");
			return false;
		}
	};
	const parser = entry.parser;
	return (input) => {
		const exit = runSyncExit(parserResult(parser(input, defaultParseOptions), input));
		if (isSuccess(exit)) return true;
		getSchemaIssueOrThrow(exit.cause, "Type guard adapter can only return false for schema issues");
		return false;
	};
}
/** @internal */
function _is(ast) {
	const typeAST = toType$1(ast);
	let guard = (input) => {
		guard = makeIs(typeAST);
		return guard(input);
	};
	return (input) => {
		return guard(input);
	};
}
/**
* Creates an effectful decoder for `unknown` input.
*
* **When to use**
*
* Use when you need to decode untyped boundary input in an `Effect` whose
* failure channel is `SchemaIssue.Issue`, while preserving transformations
* and service requirements.
*
* **Details**
*
* The returned function succeeds with the schema's decoded `Type` or fails with a
* `SchemaIssue.Issue`. Decoding service requirements are preserved in the returned
* `Effect`. Parse options may be provided when creating the decoder and overridden
* when applying it.
*
* @see {@link decodeEffect} for input already typed as the schema's `Encoded` type
*
* @stability stable
* @category decoding
* @since 4.0.0
*/
function decodeUnknownEffect$1(schema, options) {
	const parser = run(schema.ast);
	return options === void 0 ? parser : (input, overrideOptions) => parser(input, mergeParseOptions(options, overrideOptions));
}
/** @internal */
function decodeUnknownOption$1(schema, options) {
	return asOption(decodeUnknownEffect$1(schema, options));
}
/**
* Creates an effectful encoder for `unknown` input.
*
* **When to use**
*
* Use when you need to encode untyped boundary input in an `Effect` whose
* failure channel is `SchemaIssue.Issue`, while preserving service
* requirements.
*
* **Details**
*
* The returned function succeeds with the schema's `Encoded` value or fails with a
* `SchemaIssue.Issue`. Encoding service requirements are preserved in the returned
* `Effect`. Parse options may be provided when creating the encoder and overridden
* when applying it.
*
* @see {@link encodeEffect} for the typed-input variant when the value is already typed as the schema's decoded `Type`
*
* @stability stable
* @category encoding
* @since 4.0.0
*/
function encodeUnknownEffect$1(schema, options) {
	const parser = run(flip(schema.ast));
	return options === void 0 ? parser : (input, overrideOptions) => parser(input, mergeParseOptions(options, overrideOptions));
}
var mergeParseOptions = (options, overrideOptions) => overrideOptions ? {
	...options,
	...overrideOptions
} : options;
var getValue = (value) => {
	if (value === missing) return fail$1(new InvalidValue());
	return succeed$1(value);
};
/** @internal */
function run(ast) {
	return runWithCompiler(normalCompiler, ast);
}
function parserResult(result, input) {
	if (isSameExit(result)) return succeed$1(input);
	if (!effectIsExit(result)) return flatMapEager(result, getValue);
	return result["~effect/Effect/args"] === missing ? getValue(missing) : result;
}
function runWithCompiler(compiler, ast) {
	let parser;
	return (input, options) => {
		const result = (parser ??= compiler(ast))(input, options ?? defaultParseOptions);
		if (isSameExit(result)) return succeed$1(input);
		if (!effectIsExit(result)) return flatMapEager(result, getValue);
		return result["~effect/Effect/args"] === missing ? getValue(missing) : result;
	};
}
function asExit(parser) {
	return (input, options) => runSyncExit(parser(input, options));
}
/** @internal */
function asOption(parser) {
	const parserExit = asExit(parser);
	return (input, options) => {
		const exit = parserExit(input, options);
		if (isSuccess(exit)) return some(exit.value);
		getSchemaIssueOrThrow(exit.cause, "Option adapter can only return none for schema issues");
		return none();
	};
}
function runSync(effect, message) {
	const exit = runSyncExit(effect);
	if (isSuccess(exit)) return exit.value;
	const issue = getSchemaIssueOrThrow(exit.cause, message);
	throw new Error("Schema validation failed", { cause: issue });
}
var constructorDefectMessage = "Constructor adapter can only throw schema issues";
function throwConstructorDefect(error) {
	throw new Error(constructorDefectMessage, { cause: die$1(error) });
}
function makeConstructorSync(ast) {
	let entry;
	return (input, options) => constructSync(entry ??= resolve(ast), input, options);
}
function constructSync(entry, input, options) {
	const parseOptions = options?.disableChecks ? options.parseOptions ? {
		...options.parseOptions,
		disableChecks: true
	} : { disableChecks: true } : options?.parseOptions ?? defaultParseOptions;
	const make = entry.make;
	if (make !== void 0 && input !== missing) {
		let output;
		try {
			output = make(input, parseOptions);
		} catch (error) {
			throwConstructorDefect(error);
		}
		if (output !== invalid && output !== missing) return output;
	}
	return runSync(parserResult(entry.makeEffect(input, parseOptions), input), constructorDefectMessage);
}
/**
* Constructs a class instance from its type-side declaration.
*
* When the declaration has no compiled constructor, the fields are validated first
* and the instance is built outside the parser, so stacks captured by the
* class constructor keep the caller's frames.
*
* @internal
*/
function makeClassSync(ast, input, options, construct) {
	const entry = resolve(ast);
	const descriptor = getConstructorDescriptor(ast);
	if (descriptor === void 0 || entry.make !== void 0 || entry.compiledMakeEffect !== void 0) return constructSync(entry, input, options);
	if (descriptor.isConstructed(input)) return input;
	const fields = constructSync((entry.resolve ?? resolve)(descriptor.link.to), input, options);
	try {
		return construct(fields);
	} catch (error) {
		throwConstructorDefect(error);
	}
}
var normalCompiler = (ast) => resolve(ast).parser;
var constructorCompiler = (ast) => resolve(ast).makeEffect;
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/schema/make.js
/** @internal */
var TypeId$10 = "~effect/Schema/Schema";
var RebuildOptions = /*#__PURE__*/ Symbol();
var SchemaProto = {
	[TypeId$10]: TypeId$10,
	get make() {
		const value = make$5(this);
		Object.defineProperty(this, "make", {
			value,
			enumerable: true
		});
		return value;
	},
	get makeEffect() {
		const value = makeEffect(this);
		Object.defineProperty(this, "makeEffect", {
			value,
			enumerable: true
		});
		return value;
	},
	get makeOption() {
		const value = makeOption(this);
		Object.defineProperty(this, "makeOption", {
			value,
			enumerable: true
		});
		return value;
	},
	pipe() {
		return pipeArguments(this, arguments);
	},
	annotate(annotations) {
		return this.rebuild(annotate(this.ast, annotations));
	},
	annotateKey(annotations) {
		return this.rebuild(annotateKey(this.ast, annotations));
	},
	check(...checks) {
		return this.rebuild(appendChecks(this.ast, checks));
	},
	rebuild(ast) {
		return make$4(ast, this[RebuildOptions]);
	}
};
/** @internal */
function make$4(ast, options) {
	function Schema() {}
	const self = Object.setPrototypeOf(Schema, SchemaProto);
	if (options && (Object.hasOwn(options, "name") || Object.hasOwn(options, "length") || Object.hasOwn(options, "__proto__"))) Object.defineProperties(self, Object.getOwnPropertyDescriptors({ ...options }));
	else Object.assign(self, options);
	self[RebuildOptions] = options;
	self.ast = ast;
	return self;
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/jsonSchema.js
/** @internal */
function getSubschemaKind(keyword) {
	switch (keyword) {
		case "$defs":
		case "properties":
		case "patternProperties":
		case "dependentSchemas": return "map";
		case "allOf":
		case "anyOf":
		case "oneOf":
		case "prefixItems": return "array";
		case "not":
		case "additionalProperties":
		case "propertyNames":
		case "unevaluatedProperties":
		case "items":
		case "contains":
		case "unevaluatedItems":
		case "if":
		case "then":
		case "else":
		case "contentSchema": return "schema";
	}
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/JsonPointer.js
/**
* Helpers for escaping JSON Pointer path segments and converting JSON Pointer
* URI fragments. JSON Pointer uses `/` to separate path tokens inside a JSON
* document, so token text must encode literal `~` and `/` characters. URI
* fragments additionally apply percent-encoding after JSON Pointer escaping.
*
* @stability stable
* @since 4.0.0
*/
/**
* Escapes a JSON Pointer reference token according to RFC 6901 by encoding special characters so the token can be safely used as a segment in a JSON Pointer.
*
* **When to use**
*
* Use when you need to escape a single JSON Pointer path segment.
*
* **Details**
*
* - Returns a new escaped string
* - Replaces `~` (tilde) with `~0` and `/` (forward slash) with `~1`
* - Returns the input unchanged if it contains no special characters
* - Empty strings are valid and returned unchanged
*
* **Gotchas**
*
* The replacement order matters: `~` is replaced before `/` to prevent double-escaping.
*
* **Example** (Escaping special characters)
*
* ```ts import.meta.vitest
* import { JsonPointer } from "effect"
*
* JsonPointer.escapeToken("a/b") // => "a~1b"
* JsonPointer.escapeToken("c~d") // => "c~0d"
* JsonPointer.escapeToken("path/to~key") // => "path~1to~0key"
* ```
*
* @see {@link unescapeToken} The inverse operation for decoding escaped tokens
* @stability stable
* @category encoding
* @since 4.0.0
*/
function escapeToken(token) {
	return token.replace(/~/g, "~0").replace(/\//g, "~1");
}
/**
* Decodes a JSON Pointer reference token according to RFC 6901 escaping rules.
*
* **When to use**
*
* Use when you need to decode a single escaped JSON Pointer path segment.
*
* **Details**
*
* - Returns a new unescaped string
* - Replaces `~1` with `/` (forward slash) and `~0` with `~` (tilde)
* - Returns the input unchanged if it contains no escaped sequences
* - Empty strings are valid and returned unchanged
*
* **Gotchas**
*
* The replacement order matters: `~1` is replaced before `~0` to prevent incorrect decoding.
*
* **Example** (Unescaping special characters)
*
* ```ts import.meta.vitest
* import { JsonPointer } from "effect"
*
* JsonPointer.unescapeToken("a~1b") // => "a/b"
* JsonPointer.unescapeToken("c~0d") // => "c~d"
* JsonPointer.unescapeToken("path~1to~0key") // => "path/to~key"
* ```
*
* @see {@link escapeToken} The inverse operation for encoding tokens
* @stability stable
* @category decoding
* @since 4.0.0
*/
function unescapeToken(token) {
	return token.replace(/~1/g, "/").replace(/~0/g, "~");
}
/** @internal */
function formatUriFragmentToken(token) {
	return encodeURI(escapeToken(token)).replace(/#/g, "%23");
}
/** @internal */
function decodeUriFragment(fragment) {
	if (fragment.length === 0 || fragment === "#") return "";
	if (!fragment.startsWith("#")) return void 0;
	const encoded = fragment.slice(1);
	try {
		if (encodeURI(encoded).replace(/%25/g, "%").replace(/#/g, "%23") !== encoded) return void 0;
		const pointer = decodeURIComponent(encoded);
		return pointer.startsWith("/") && !/~(?:[^01]|$)/.test(pointer) ? pointer : void 0;
	} catch {
		return;
	}
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/JsonSchema.js
/**
* Helpers for normalizing and converting JSON Schema and OpenAPI schema
* documents. Supported inputs include JSON Schema Draft-07, Draft 2020-12,
* OpenAPI 3.0, and OpenAPI 3.1; conversions normalize through
* `Document<"draft-2020-12">` before emitting another dialect, including
* JSON Schema Draft-04. The module also defines document types, meta-schema
* constants, and OpenAPI component-key helpers.
*
* @stability stable
* @since 4.0.0
*/
function transformSchema(node, transform) {
	return walk(node, false, true);
	function walk(node, inheritedResource, isRoot = false) {
		if (!isObject(node)) return node;
		const inEmbeddedResource = inheritedResource || !isRoot && createsResource(node.$id);
		const out = {};
		for (const key of Object.keys(node)) {
			const value = node[key];
			let transformed = value;
			switch (getSubschemaKind(key)) {
				case "map":
					transformed = mapObject(value, (value) => walk(value, inEmbeddedResource)) ?? value;
					break;
				case "array":
					transformed = Array.isArray(value) ? value.map((value) => walk(value, inEmbeddedResource)) : value;
					break;
				case "schema": transformed = walk(value, inEmbeddedResource);
			}
			assignProperty(out, key, transformed);
		}
		transform(out, inEmbeddedResource);
		return out;
	}
}
/** @internal */
function rewriteRefs(schema, rewrite) {
	return transformSchema(schema, (schema) => {
		rewriteSchemaRef(schema, rewrite);
	});
}
function rewriteSchemaRef(schema, rewrite) {
	if (typeof schema.$ref === "string") assignProperty(schema, "$ref", rewrite(schema.$ref, "$ref"));
	if (typeof schema.$dynamicRef === "string") assignProperty(schema, "$dynamicRef", rewrite(schema.$dynamicRef, "$dynamicRef"));
}
function mapObject(value, f) {
	if (!isObject(value)) return void 0;
	const out = {};
	for (const key of Object.keys(value)) assignProperty(out, key, f(value[key], key));
	return out;
}
function createsResource(id) {
	return typeof id === "string" && id.length > 0 && id[0] !== "#";
}
var PRE_2020_TO_2020_COLLISIONS = [
	"$anchor",
	"$defs",
	"$dynamicAnchor",
	"$dynamicRef",
	"$vocabulary",
	"contentSchema",
	"dependentRequired",
	"dependentSchemas",
	"maxContains",
	"minContains",
	"prefixItems",
	"unevaluatedItems",
	"unevaluatedProperties"
];
[...PRE_2020_TO_2020_COLLISIONS];
[...PRE_2020_TO_2020_COLLISIONS];
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/schema/toCodec.js
/** @internal */
function toCodecJson$1(schema) {
	return make$4(toCodecJsonAST(schema.ast), { schema });
}
/** @internal */
var toCodecJsonAST = /*#__PURE__*/ makeCodecDerivation(toCodecJsonASTStep);
function makeCodecDerivation(step, options) {
	const deriveBody = memoize((owner) => {
		const body = replaceContext(owner, void 0);
		const out = step(body, recur);
		return out === body ? null : out;
	});
	const recur = applyToSelfOrLastLinkEncodingIdempotent((ast) => {
		const derived = deriveBody(getContextOwner(ast));
		if (derived === null) return ast;
		const out = replaceContext(derived, ast.context);
		return ast.context === void 0 ? out : replaceContextLastLink(out, withoutConstructorDefault(ast.context));
	}, options);
	return recur;
}
function withoutConstructorDefault(context) {
	return context.constructorDefault === void 0 ? context : new Context(context.isOptional, context.isMutable, void 0, context.annotations);
}
function validateCanonicalObjectPropertyNames(ast) {
	if (ast.propertySignatures.some((ps) => typeof ps.name !== "string")) throw new globalThis.Error("Objects property names must be strings", { cause: ast });
}
function makeReorder(getPriority) {
	return (types) => {
		const sortedTypes = [...types].sort((a, b) => getPriority(toEncoded$1(a)) - getPriority(toEncoded$1(b)));
		if (!sortedTypes.some((ast, index) => ast !== types[index])) return types;
		return sortedTypes;
	};
}
var toCodecJsonReorder = /*#__PURE__*/ makeReorder((ast) => {
	switch (ast._tag) {
		case "BigInt":
		case "Symbol":
		case "UniqueSymbol": return 0;
		default: return 1;
	}
});
function toCodecJsonASTStep(ast, recur) {
	switch (ast._tag) {
		case "Declaration": {
			const getLink = ast.annotations?.toCodecJson ?? ast.annotations?.toCodec;
			if (!isFunction(getLink)) return replaceEncoding(ast, [unknownToJson]);
			const link = getLink(ast.typeParameters.map((tp) => make$4(toEncoded$1(tp))));
			return link === void 0 ? ast : replaceEncoding(ast, [mapLink(link, recur)]);
		}
		case "Unknown": return replaceEncoding(ast, [unknownToJson]);
		case "ObjectKeyword": return replaceEncoding(ast, [objectKeywordToJson]);
		case "Undefined":
		case "Void":
		case "Literal":
		case "Number": return ast.toCodecJson();
		case "UniqueSymbol":
		case "Symbol":
		case "BigInt": return ast.toCodecStringTree();
		case "Objects":
			validateCanonicalObjectPropertyNames(ast);
			return ast.recur(recur, parameterFromString);
		case "Union": {
			const sortedTypes = toCodecJsonReorder(ast.types);
			if (sortedTypes !== ast.types) return new Union$1(sortedTypes, ast.options, ast.annotations, ast.checks, ast.encoding, ast.context, ast.encodingChecks).recur(recur);
			return ast.recur(recur);
		}
		case "Arrays":
		case "Suspend": return ast.recur(recur);
	}
	return ast;
}
/** @internal */
function toCodecStringTree$1(schema) {
	return make$4(toCodecStringTreeAST(schema.ast), { schema });
}
var toStringTreeReorder = /*#__PURE__*/ makeReorder((ast) => {
	switch (ast._tag) {
		case "Null":
		case "Boolean":
		case "Number":
		case "BigInt":
		case "Symbol":
		case "UniqueSymbol": return 0;
		default: return 1;
	}
});
function toCodecStringTreeASTStep(ast, recur, onMissingAnnotation) {
	switch (ast._tag) {
		case "Declaration": {
			const typeParameters = ast.typeParameters.map((tp) => make$4(recur(toEncoded$1(tp))));
			const getStringTreeLink = ast.annotations?.toCodecStringTree;
			if (isFunction(getStringTreeLink)) {
				const link = getStringTreeLink(typeParameters);
				if (link === void 0) return ast;
				return replaceEncoding(ast, [mapLink(link, recur)]);
			}
			const getJsonLink = ast.annotations?.toCodecJson;
			const jsonLink = isFunction(getJsonLink) ? getJsonLink(typeParameters) : void 0;
			const getLink = jsonLink === void 0 ? ast.annotations?.toCodec : void 0;
			const link = jsonLink ?? (isFunction(getLink) ? getLink(typeParameters) : void 0);
			return link === void 0 ? onMissingAnnotation(ast) : replaceEncoding(ast, [mapLink(link, recur)]);
		}
		case "Null": return replaceEncoding(ast, [nullToString]);
		case "Boolean": return replaceEncoding(ast, [booleanToString]);
		case "Unknown":
		case "ObjectKeyword": return replaceEncoding(ast, [unknownToStringTree]);
		case "Enum":
		case "Number":
		case "Literal":
		case "UniqueSymbol":
		case "Symbol":
		case "BigInt": return ast.toCodecStringTree();
		case "Objects":
			validateCanonicalObjectPropertyNames(ast);
			return ast.recur(recur, parameterFromString);
		case "Union": {
			const sortedTypes = toStringTreeReorder(ast.types);
			if (sortedTypes !== ast.types) return new Union$1(sortedTypes, ast.options, ast.annotations, ast.checks, ast.encoding, ast.context, ast.encodingChecks).recur(recur);
			return ast.recur(recur);
		}
		case "Arrays":
		case "Suspend": return ast.recur(recur);
	}
	return ast;
}
var nullToString = /*#__PURE__*/ new Link(/*#__PURE__*/ new Literal$1("null"), /*#__PURE__*/ new Transformation(/*#__PURE__*/ transform$1(() => null), /*#__PURE__*/ transform$1(() => "null")));
var booleanToString = /*#__PURE__*/ new Link(/*#__PURE__*/ new Union$1([/*#__PURE__*/ new Literal$1("true"), /*#__PURE__*/ new Literal$1("false")]), /*#__PURE__*/ new Transformation(/*#__PURE__*/ transform$1((s) => s === "true"), /*#__PURE__*/ String$3()));
var arrayFromSingleTransformation = /*#__PURE__*/ new Transformation(/*#__PURE__*/ transform$1((input) => typeof input === "string" ? [input] : input), /*#__PURE__*/ passthrough$1());
var isCodecArrayFromSingleLink = (link) => link.transformation === arrayFromSingleTransformation;
var toCodecStringTreeAST = /*#__PURE__*/ makeCodecDerivation((ast, recur) => toCodecStringTreeASTStep(ast, recur, (ast) => {
	throw new globalThis.Error("Missing structural codec for StringTree", { cause: ast });
}), { stopAt: isCodecArrayFromSingleLink });
globalThis.RegExp;
/**
* Escapes special characters in a regular expression pattern.
*
* **When to use**
*
* Use to turn literal text into a safe regular expression pattern fragment.
*
* **Example** (Escaping a pattern string)
*
* ```ts import.meta.vitest
* import { RegExp } from "effect"
*
* RegExp.escape("a*b") // => "a\\*b"
* ```
*
* @stability stable
* @category transforming
* @since 2.0.0
*/
var escape = (string) => string.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/errors.js
/** @internal */
function errorWithPath(message, path) {
	if (path.length > 0) message += `\n  at ${formatPath(path)}`;
	return new Error(message);
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/schema/toJsonSchemaDocument.js
function formatDefinitionReference(key) {
	return `#/$defs/${formatUriFragmentToken(key)}`;
}
var jsonSchemaAnnotationExcludedKeys = /*#__PURE__*/ new Set([
	...annotationExcludedKeys,
	IDENTIFIER_FALLBACK_KEY,
	...jsonSchemaAnnotationKeys
]);
function collectJsonSchemaAnnotations(annotations, options) {
	if (annotations === void 0) return void 0;
	const out = {};
	for (const key of [
		"title",
		"description",
		"format",
		"contentEncoding",
		"contentMediaType"
	]) {
		const value = annotations[key];
		if (typeof value === "string") out[key] = value;
	}
	for (const key of ["readOnly", "writeOnly"]) {
		const value = annotations[key];
		if (typeof value === "boolean") out[key] = value;
	}
	const expected = annotations.expected;
	if (out.description === void 0 && options?.generateDescriptions === true && typeof expected === "string") out.description = expected;
	const defaultValue = annotations.default;
	if (isJson$1(defaultValue)) out.default = defaultValue;
	const examples = annotations.examples;
	if (Array.isArray(examples) && isJson$1(examples)) out.examples = examples;
	const contentSchema = annotations.contentSchema;
	if (isJson$1(contentSchema)) out.contentSchema = contentSchema;
	if (options?.includeAnnotationKey !== void 0) for (const [key, value] of Object.entries(annotations)) {
		if (jsonSchemaAnnotationExcludedKeys.has(key) || !options.includeAnnotationKey(key)) continue;
		if (isJson$1(value)) assignProperty(out, key, value);
	}
	return Object.keys(out).length === 0 ? void 0 : out;
}
function extractJsonSchemaNumberType(schema) {
	let type = schema.type === "number" || schema.type === "integer" ? schema.type : void 0;
	let out = schema;
	if (type !== void 0) {
		out = { ...schema };
		delete out.type;
	}
	if (Array.isArray(out.allOf)) {
		const members = [];
		let changed = false;
		for (const member of out.allOf) {
			const extracted = extractJsonSchemaNumberType(member);
			if (extracted.type !== void 0) {
				changed = true;
				if (type === void 0 || extracted.type === "integer") type = extracted.type;
			}
			if (Object.keys(extracted.schema).length > 0) members.push(extracted.schema);
		}
		if (changed) {
			const { allOf: _, ...rest } = out;
			out = members.length === 0 ? rest : {
				...rest,
				allOf: members
			};
		}
	}
	return {
		type,
		schema: out
	};
}
function isJsonSchemaNumberEncoding(schema) {
	if (!Array.isArray(schema.anyOf) || schema.anyOf.length !== 2 || schema.anyOf[0]?.type !== "number") return false;
	const special = schema.anyOf[1];
	return special?.type === "string" && Array.isArray(special.enum) && special.enum.length === 3 && special.enum.includes("NaN") && special.enum.includes("Infinity") && special.enum.includes("-Infinity");
}
var inlineableCheckKeywords = "|type|format|pattern|multipleOf|minimum|maximum|exclusiveMinimum|exclusiveMaximum|minLength|maxLength|minItems|maxItems|uniqueItems|minProperties|maxProperties|propertyNames|";
function hasOnlyKeywords(schema, allowed) {
	return Object.keys(schema).every((key) => allowed.includes(`|${key}|`));
}
function hasNoCollisions(left, rightKeys) {
	return typeof left.$ref !== "string" && rightKeys.every((key) => !Object.hasOwn(left, key));
}
var lowerBoundKeywords = "|minimum|exclusiveMinimum|minLength|minItems|minProperties|";
var upperBoundKeywords = "|maximum|exclusiveMaximum|maxLength|maxItems|maxProperties|";
function mergeInlineCheck(left, right, rightKeys) {
	if (typeof left.$ref === "string") return void 0;
	const out = {
		...left,
		...right
	};
	for (const key of rightKeys) {
		if (!Object.hasOwn(left, key)) continue;
		const a = left[key];
		const b = right[key];
		if (typeof a !== "number" || typeof b !== "number") return void 0;
		if (lowerBoundKeywords.includes(`|${key}|`)) out[key] = Math.max(a, b);
		else if (upperBoundKeywords.includes(`|${key}|`)) out[key] = Math.min(a, b);
		else return void 0;
	}
	if (typeof out.minimum === "number" && typeof out.exclusiveMinimum === "number") delete out[out.exclusiveMinimum >= out.minimum ? "minimum" : "exclusiveMinimum"];
	if (typeof out.maximum === "number" && typeof out.exclusiveMaximum === "number") delete out[out.exclusiveMaximum <= out.maximum ? "maximum" : "exclusiveMaximum"];
	return out;
}
var promotableAnnotationKeywords = "|title|description|default|examples|readOnly|writeOnly|";
var inlineableAnnotatedCheckKeywords = inlineableCheckKeywords + promotableAnnotationKeywords;
function appendJsonSchema(left, right, inlineCheck) {
	if (Object.keys(left).length === 0) return right;
	const rightKeys = Object.keys(right);
	if (rightKeys.length === 0) return left;
	const leftType = left.type === "number" || left.type === "integer" ? left.type : void 0;
	const isNumberEncoding = isJsonSchemaNumberEncoding(left);
	if (leftType !== void 0 || isNumberEncoding) {
		const extracted = extractJsonSchemaNumberType(right);
		if (extracted.type !== void 0) {
			const type = leftType === "integer" || extracted.type === "integer" ? "integer" : "number";
			const base = {
				...left,
				type
			};
			if (isNumberEncoding) delete base.anyOf;
			const extractedKeys = Object.keys(extracted.schema);
			if (extractedKeys.length === 0) return base;
			return hasOnlyKeywords(extracted.schema, promotableAnnotationKeywords) && hasNoCollisions(base, extractedKeys) ? {
				...base,
				...extracted.schema
			} : appendJsonSchema(base, extracted.schema, inlineCheck);
		}
	}
	if (inlineCheck) {
		const merged = mergeInlineCheck(left, right, rightKeys);
		if (merged !== void 0) return merged;
	}
	const members = Array.isArray(right.allOf) && rightKeys.length === 1 ? right.allOf : [right];
	if (Array.isArray(left.allOf)) return {
		...left,
		allOf: [...left.allOf, ...members]
	};
	if (typeof left.$ref === "string") return { allOf: [left, ...members] };
	return {
		...left,
		allOf: members
	};
}
function isExact(exactness, seen = /* @__PURE__ */ new Set()) {
	if (typeof exactness === "boolean") return exactness;
	if (seen.has(exactness)) return true;
	seen.add(exactness);
	return exactness.every((dependency) => isExact(dependency, seen));
}
function isApproximateCheckOutput(output) {
	return Array.isArray(output);
}
function compileJsonSchema(representations, rootPaths, references, options) {
	const numberKeyPattern = `^(?:${FINITE_PATTERN}|Infinity|-Infinity|NaN)$`;
	const compiledDefinitions = /* @__PURE__ */ new Map();
	const definitionAliases = /* @__PURE__ */ new Map();
	const compiledRepresentations = /* @__PURE__ */ new WeakMap();
	const pendingOneOf = /* @__PURE__ */ new Map();
	const fallbackDefinitions = /* @__PURE__ */ new Map();
	const referenceKeys = Object.keys(references);
	for (const key of referenceKeys) compileDefinition(key, ["references", key]);
	const compiledSchemas = map$4(representations, (representation, index) => recur(representation, rootPaths[index], []));
	for (const { branches, schemas } of pendingOneOf.values()) if (!isExact(branches)) {
		for (const schema of schemas) if (Array.isArray(schema.oneOf)) {
			schema.anyOf = schema.oneOf;
			delete schema.oneOf;
		}
	}
	for (const key of referenceKeys) {
		const representation = references[key];
		const fallback = getIdentifierFallback(representation);
		if (fallback === void 0) continue;
		const schema = compiledDefinitions.get(key).schema;
		const candidates = fallbackDefinitions.get(fallback);
		const match = candidates?.find((candidate) => equals$1(compiledDefinitions.get(candidate).schema, schema));
		if (match === void 0) {
			if (candidates === void 0) fallbackDefinitions.set(fallback, [key]);
			else candidates.push(key);
		} else definitionAliases.set(key, match);
	}
	const schemas = map$4(compiledSchemas, finalizeJsonSchema);
	const definitions = {};
	for (const key of referenceKeys) if (!definitionAliases.has(key)) assignProperty(definitions, key, finalizeJsonSchema(compiledDefinitions.get(key).schema));
	return {
		dialect: "draft-2020-12",
		schemas,
		definitions
	};
	function registerPendingOneOf(schema) {
		if (Array.isArray(schema.oneOf)) pendingOneOf.get(schema.oneOf)?.schemas.push(schema);
		return schema;
	}
	function compileAnnotatedMember(member, path, dependencies) {
		const schema = recur(member.type, [...path, "type"], dependencies);
		const annotations = collectJsonSchemaAnnotations(member.annotations, options);
		return annotations === void 0 ? schema : registerPendingOneOf(appendJsonSchema(schema, annotations));
	}
	function compileDefinition(key, path) {
		if (!Object.hasOwn(references, key)) throw errorWithPath(`Invalid reference ${key}`, [...path, "$ref"]);
		const cached = compiledDefinitions.get(key);
		if (cached !== void 0) return cached;
		const result = {
			schema: {},
			dependencies: []
		};
		compiledDefinitions.set(key, result);
		result.schema = recur(references[key], ["references", key], result.dependencies);
		return result;
	}
	function finalizeJsonSchema(schema) {
		return rewriteRefs(schema, ($ref) => {
			const pointer = decodeUriFragment($ref);
			if (pointer === void 0) {
				if (/^#(?:\/|%2f)/i.test($ref)) throw new Error(`Invalid JSON Pointer URI fragment ${JSON.stringify($ref)}`);
				return $ref;
			}
			if (!pointer.startsWith("/$defs/")) return $ref;
			const separator = pointer.indexOf("/", 7);
			const canonical = definitionAliases.get(unescapeToken(pointer.slice(7, separator < 0 ? void 0 : separator)));
			if (canonical === void 0) return $ref;
			return $ref.replace(/^#(?:\/|%2f).*?(?:\/|%2f).*?(?=\/|%2f|$)/i, formatDefinitionReference(canonical));
		});
	}
	function getIdentifierFallback(representation) {
		if (representation._tag === "Reference") return void 0;
		const annotations = representation.checks.length === 0 ? representation.annotations : representation.checks[representation.checks.length - 1].annotations;
		return typeof annotations?.identifier !== "string" && typeof annotations?.["~identifier"] === "string" ? annotations[IDENTIFIER_FALLBACK_KEY] : void 0;
	}
	function compileCheck(check, type, path, dependencies) {
		const annotations = check.annotations;
		const callback = annotations?.toJsonSchema;
		if (callback !== void 0) {
			const result = callback({
				type,
				schemas: check.representation?.schemas?.map((schema, index) => recur(schema, [
					...path,
					"representation",
					"schemas",
					index
				], dependencies)) ?? []
			});
			const approximate = isApproximateCheckOutput(result);
			if (approximate) dependencies.push(false);
			const fragment = approximate ? result[0] : result;
			const ordinary = collectJsonSchemaAnnotations(annotations, options);
			const schema = ordinary === void 0 ? fragment : {
				...fragment,
				...ordinary
			};
			const allowed = ordinary === void 0 ? inlineableCheckKeywords : inlineableAnnotatedCheckKeywords;
			return [schema, check._tag === "Filter" && hasOnlyKeywords(schema, allowed) && (ordinary === void 0 || hasOnlyKeywords(ordinary, promotableAnnotationKeywords)) ? true : void 0];
		}
		if (check._tag === "Filter") {
			dependencies.push(false);
			return;
		}
		const schemas = check.checks.flatMap((child, index) => {
			const result = compileCheck(child, type, [
				...path,
				"checks",
				index
			], dependencies);
			return result === void 0 ? [] : [result[0]];
		});
		if (schemas.length === 0) return void 0;
		const ordinary = collectJsonSchemaAnnotations(annotations, options);
		const schema = { allOf: schemas };
		return [ordinary === void 0 ? schema : {
			...schema,
			...ordinary
		}];
	}
	function recur(representation, path, dependencies) {
		if (representation._tag === "Reference") {
			dependencies.push(compileDefinition(representation.$ref, path).dependencies);
			return { $ref: formatDefinitionReference(representation.$ref) };
		}
		const cached = compiledRepresentations.get(representation);
		if (cached !== void 0) {
			dependencies.push(cached.dependencies);
			return cached.schema;
		}
		const local = [];
		dependencies.push(local);
		let output = {
			...on(representation, path, local),
			...collectJsonSchemaAnnotations(representation.annotations, options)
		};
		if (representation._tag === "String" && representation.content !== void 0) {
			const content = representation.content;
			output.contentMediaType = content.mediaType;
			delete output.contentSchema;
			if (content.schema !== void 0) output.contentSchema = recur(content.schema, [
				...path,
				"content",
				"schema"
			], []);
		}
		for (let index = 0; index < representation.checks.length; index++) {
			const type = typeof output.type === "string" && isJsonSchemaType(output.type) ? output.type : void 0;
			const check = compileCheck(representation.checks[index], type, [
				...path,
				"checks",
				index
			], local);
			if (check !== void 0) output = appendJsonSchema(output, ...check);
		}
		compiledRepresentations.set(representation, {
			schema: output,
			dependencies: local
		});
		return registerPendingOneOf(output);
	}
	function on(representation, path, dependencies) {
		switch (representation._tag) {
			case "Any":
			case "Unknown": return {};
			case "ObjectKeyword": return { anyOf: [{ type: "object" }, { type: "array" }] };
			case "Void":
			case "Undefined":
			case "Null": return { type: "null" };
			case "BigInt": return {
				type: "string",
				allOf: [{ pattern: "^-?\\d+$" }]
			};
			case "Symbol": return {
				type: "string",
				allOf: [{ pattern: "^Symbol\\(([\\s\\S]*)\\)$" }]
			};
			case "UniqueSymbol": return globalThis.Symbol.keyFor(representation.symbol) === void 0 ? { not: {} } : {
				type: "string",
				enum: [globalThis.String(representation.symbol)]
			};
			case "Declaration":
				dependencies.push(false);
				return {};
			case "Suspend": return recur(representation.thunk, [...path, "thunk"], dependencies);
			case "Never": return { not: {} };
			case "String": return { type: "string" };
			case "Number": return { anyOf: [{ type: "number" }, {
				type: "string",
				enum: [
					"NaN",
					"Infinity",
					"-Infinity"
				]
			}] };
			case "Boolean": return { type: "boolean" };
			case "Literal": {
				const literal = representation.literal;
				return typeof literal === "bigint" ? {
					type: "string",
					enum: [globalThis.String(literal)]
				} : {
					type: typeof literal,
					enum: [literal]
				};
			}
			case "Enum": {
				const types = representation.enums.map(([title, literal]) => ({
					type: typeof literal,
					enum: [literal],
					title
				}));
				return types.length === 0 ? { not: {} } : { anyOf: types };
			}
			case "TemplateLiteral": {
				const { exact, pattern } = getTemplateLiteralPattern(representation.parts);
				if (!exact) dependencies.push(false);
				return {
					type: "string",
					pattern
				};
			}
			case "Arrays": {
				const out = { type: "array" };
				let minItems = representation.elements.length;
				const prefixItems = representation.elements.map((element, index) => {
					if (element.isOptional) minItems--;
					return compileAnnotatedMember(element, [
						...path,
						"elements",
						index
					], dependencies);
				});
				if (prefixItems.length > 0) {
					out.prefixItems = prefixItems;
					out.maxItems = representation.elements.length;
					if (minItems > 0) out.minItems = minItems;
				} else out.items = false;
				if (representation.rest.length === 1) {
					delete out.maxItems;
					const rest = recur(representation.rest[0], [
						...path,
						"rest",
						0
					], dependencies);
					if (Object.keys(rest).length > 0) out.items = rest;
					else delete out.items;
				} else if (representation.rest.length > 1) {
					delete out.maxItems;
					delete out.items;
					out.minItems = minItems + representation.rest.length - 1;
					dependencies.push(false);
				}
				return out;
			}
			case "Objects": return compileObjects(representation, path, dependencies);
			case "Union": {
				const branches = [];
				const types = representation.types.map((type, index) => recur(type, [
					...path,
					"types",
					index
				], branches));
				dependencies.push(branches);
				if (types.length === 0) return { not: {} };
				if (representation.options?.mode === "oneOf") {
					pendingOneOf.set(types, {
						branches,
						schemas: []
					});
					return { oneOf: types };
				}
				if (types.length > 1) {
					const compacted = compactEnums(types);
					if (compacted !== void 0) return compacted;
				}
				return { anyOf: types.flatMap((type) => Array.isArray(type.anyOf) && Object.keys(type).length === 1 ? type.anyOf : [type]) };
			}
		}
	}
	function compileObjects(representation, path, dependencies) {
		const { indexSignatures, propertySignatures } = representation;
		if (propertySignatures.length === 0 && indexSignatures.length === 0) return { not: { type: "null" } };
		const out = { type: "object" };
		const properties = {};
		const required = [];
		for (const [index, property] of propertySignatures.entries()) {
			const propertyPath = [
				...path,
				"propertySignatures",
				index
			];
			if (typeof property.name !== "string") throw errorWithPath("Objects property names must be strings", [...propertyPath, "name"]);
			assignProperty(properties, property.name, compileAnnotatedMember(property, propertyPath, dependencies));
			if (!property.isOptional) required.push(property.name);
		}
		if (propertySignatures.length > 0) out.properties = properties;
		if (required.length > 0) out.required = required;
		const indexes = indexSignatures.map((signature, index) => {
			const indexPath = [
				...path,
				"indexSignatures",
				index
			];
			const schema = recur(signature.type, [...indexPath, "type"], dependencies);
			const type = equals$1(schema, { not: {} }) ? false : schema;
			const patterns = getParameterPatterns(signature.parameter, [...indexPath, "parameter"], /* @__PURE__ */ new Set());
			if (patterns === void 0) dependencies.push(false);
			return {
				type,
				patterns
			};
		});
		const patternProperties = {};
		for (const { patterns, type } of indexes) for (const pattern of patterns ?? []) {
			const previous = patternProperties[pattern];
			assignProperty(patternProperties, pattern, previous === void 0 ? type : previous === false || type === false ? false : registerPendingOneOf(appendJsonSchema(previous, type)));
		}
		const hasPatternProperties = Object.keys(patternProperties).length > 0;
		if (hasPatternProperties) out.patternProperties = patternProperties;
		const additionalPropertySchemas = indexes.filter(({ patterns }) => patterns?.length === 0).map(({ type }) => type);
		const hasUnrepresentableIndexPattern = indexes.some(({ patterns }) => patterns === void 0);
		if (hasUnrepresentableIndexPattern && options?.onExcessProperty === "error") {
			const propertyNames = [];
			if (propertySignatures.length > 0) propertyNames.push({ enum: Object.keys(properties) });
			for (const [index, signature] of indexSignatures.entries()) propertyNames.push(getPropertyNameSchema(signature.parameter, [
				...path,
				"indexSignatures",
				index,
				"parameter"
			], dependencies, /* @__PURE__ */ new Set()));
			out.propertyNames = propertyNames.length === 1 ? propertyNames[0] : { anyOf: propertyNames };
			const values = indexes.map(({ type }) => type);
			out.additionalProperties = values.length === 1 ? values[0] : { anyOf: values };
			if (additionalPropertySchemas.length > 0) out.allOf = additionalPropertySchemas.map((type) => ({
				type: "object",
				additionalProperties: type
			}));
		} else if (additionalPropertySchemas.length === 0) out.additionalProperties = hasUnrepresentableIndexPattern || options?.onExcessProperty !== "error";
		else if (additionalPropertySchemas.length === 1 && propertySignatures.length === 0 && !hasPatternProperties) out.additionalProperties = additionalPropertySchemas[0];
		else out.allOf = additionalPropertySchemas.map((type) => ({
			type: "object",
			additionalProperties: type
		}));
		if (typeof out.additionalProperties === "object" && out.additionalProperties !== null && Object.keys(out.additionalProperties).length === 0) delete out.additionalProperties;
		return out;
	}
	function getPropertyNameSchema(parameter, path, dependencies, seenReferences) {
		switch (parameter._tag) {
			case "Number": return {
				type: "string",
				pattern: numberKeyPattern
			};
			case "Reference":
				if (seenReferences.has(parameter.$ref)) return { type: "string" };
				return getPropertyNameSchema(references[parameter.$ref], ["references", parameter.$ref], dependencies, new Set(seenReferences).add(parameter.$ref));
			case "Union": return { anyOf: parameter.types.map((type) => getPropertyNameSchema(type, path, dependencies, seenReferences)) };
			default: return recur(parameter, path, dependencies);
		}
	}
	function getParameterPatterns(parameter, path, seenReferences) {
		switch (parameter._tag) {
			case "Reference": {
				compileDefinition(parameter.$ref, path);
				if (seenReferences.has(parameter.$ref)) return void 0;
				const next = new Set(seenReferences).add(parameter.$ref);
				return getParameterPatterns(references[parameter.$ref], ["references", parameter.$ref], next);
			}
			case "String": {
				if (parameter.checks.length === 0) return [];
				if (parameter.checks.length !== 1 || parameter.checks[0]._tag !== "Filter" || parameter.checks[0].annotations?.toJsonSchema === void 0) return;
				const dependencies = [];
				const schema = recur(parameter, path, dependencies);
				if (!isExact(dependencies)) return void 0;
				return schema.type === "string" && typeof schema.pattern === "string" && hasOnlyKeywords(schema, "|type|pattern|title|description|default|examples|readOnly|writeOnly|") ? [schema.pattern] : void 0;
			}
			case "TemplateLiteral": {
				if (parameter.checks.length > 0) return void 0;
				const { exact, pattern } = getTemplateLiteralPattern(parameter.parts);
				return exact ? [pattern] : void 0;
			}
			case "Union": {
				if (parameter.types.length === 0 || parameter.checks.length > 0 || parameter.options?.mode === "oneOf") return;
				const patterns = [];
				for (let index = 0; index < parameter.types.length; index++) {
					const memberPatterns = getParameterPatterns(parameter.types[index], [
						...path,
						"types",
						index
					], seenReferences);
					if (memberPatterns === void 0) return void 0;
					if (memberPatterns.length === 0) return [];
					patterns.push(...memberPatterns);
				}
				return patterns;
			}
			case "Number": return parameter.checks.length === 0 ? [numberKeyPattern] : void 0;
			default: throw errorWithPath(`Invalid index signature parameter ${parameter._tag}`, path);
		}
	}
	function getTemplateLiteralPattern(parts) {
		const activeReferences = /* @__PURE__ */ new Set();
		let exact = true;
		return {
			pattern: `^${parts.map(getPartPattern).join("")}$`,
			exact
		};
		function getPartPattern(part) {
			if (part._tag !== "Reference" && part.checks.length > 0) exact = false;
			switch (part._tag) {
				case "Reference": {
					if (!Object.hasOwn(references, part.$ref)) throw errorWithPath(`Invalid reference ${part.$ref}`, []);
					if (activeReferences.has(part.$ref)) throw errorWithPath(`Invalid recursive TemplateLiteral part ${part.$ref}`, []);
					activeReferences.add(part.$ref);
					const pattern = getPartPattern(references[part.$ref]);
					activeReferences.delete(part.$ref);
					return pattern;
				}
				case "Literal": return escape(globalThis.String(part.literal));
				case "String": return STRING_PATTERN;
				case "Number": return FINITE_PATTERN;
				case "BigInt": return "-?\\d+";
				case "TemplateLiteral": return part.parts.map(getPartPattern).join("");
				case "Union":
					if (part.types.length === 0) return "(?!)";
					if (part.options?.mode === "oneOf") exact = false;
					return `(?:${part.types.map(getPartPattern).join("|")})`;
				default: throw errorWithPath(`Invalid TemplateLiteral part ${part._tag}`, []);
			}
		}
	}
}
function isJsonSchemaType(input) {
	return input === "string" || input === "number" || input === "boolean" || input === "array" || input === "object" || input === "null" || input === "integer";
}
function compactEnums(schemas) {
	let sharedType = void 0;
	const values = [];
	for (const schema of schemas) {
		if (Object.keys(schema).length !== 2 || schema.type === void 0 || !Array.isArray(schema.enum) || schema.enum.length === 0) return;
		if (sharedType === void 0) sharedType = schema.type;
		else if (schema.type !== sharedType) return void 0;
		for (const value of schema.enum) {
			if (values.includes(value)) return void 0;
			values.push(value);
		}
	}
	return {
		type: sharedType,
		enum: values
	};
}
/** @internal */
function toJsonSchemaDocument$1(document, options) {
	const output = compileJsonSchema([document.representation], [["representation"]], document.references, options);
	return {
		dialect: output.dialect,
		schema: output.schemas[0],
		definitions: output.definitions
	};
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/schema/toRepresentation.js
var defaultReferencePolicy = ({ identifier }) => identifier;
function annotationsField(annotations) {
	return annotations === void 0 ? void 0 : { annotations };
}
/** @internal */
function toRepresentation(ast, options) {
	const { references, representations } = toRepresentations([ast], options);
	return {
		representation: representations[0],
		references
	};
}
/** @internal */
function toRepresentations(asts, options) {
	const references = {};
	const usedReferences = /* @__PURE__ */ new Set();
	const candidates = /* @__PURE__ */ new Map();
	for (const ast of asts) visit(ast);
	const referencePolicy = options?.referencePolicy ?? defaultReferencePolicy;
	for (const variants of candidates.values()) for (const candidate of variants) {
		const requestedReference = referencePolicy({
			ast: candidate.ast,
			occurrences: candidate.occurrences,
			identifier: candidate.identifier
		});
		if (requestedReference !== void 0) candidate.reference = getReference(requestedReference, requestedReference === candidate.identifier || !requestedReference.endsWith("_") ? "_" : "");
		else if (candidate.isRecursive) candidate.reference = getReference(`${candidate.ast._tag}_`, "");
	}
	return {
		representations: map$4(asts, recur),
		references
	};
	function getReference(prefix, separator) {
		let candidate = prefix;
		let suffix = 0;
		while (usedReferences.has(candidate)) candidate = `${prefix}${separator}${++suffix}`;
		usedReferences.add(candidate);
		return candidate;
	}
	function annotateReference(ast, candidate, reference) {
		const fallback = candidate.fallback;
		if (fallback !== void 0) return resolveIdentifierFallback(ast) === fallback ? ast : annotate(ast, { [IDENTIFIER_FALLBACK_KEY]: fallback });
		return reference === candidate.identifier ? ast : annotate(ast, { identifier: reference });
	}
	function getCandidate(input, encodingLength = input.encoding?.length ?? 0) {
		let ast = input;
		let content;
		while (ast.encoding !== void 0 && encodingLength > 0) {
			const last = ast.encoding[encodingLength - 1];
			if (last.to.encoding === void 0 && last.to._tag === "String") {
				const metadata = getContent(last.transformation.encode);
				if (metadata !== void 0) content = {
					mediaType: metadata.mediaType,
					schema: metadata.preserveSchema ? getCandidate(ast, encodingLength - 1) : void 0
				};
			}
			ast = last.to;
			encodingLength = ast.encoding?.length ?? 0;
		}
		const owner = getContextOwner(ast);
		let identifier = resolveIdentifier(ast);
		const fallback = identifier === void 0 ? (ast !== input ? resolveIdentifier(input) : void 0) ?? resolveIdentifierFallback(ast) : void 0;
		if (fallback !== void 0) identifier = `${fallback}Encoded`;
		let variants = candidates.get(owner);
		if (variants === void 0) {
			variants = [];
			candidates.set(owner, variants);
		}
		let candidate = variants.find((candidate) => candidate.identifier === identifier && candidate.content?.mediaType === content?.mediaType && candidate.content?.schema === content?.schema);
		if (candidate === void 0) {
			candidate = {
				ast: owner,
				identifier,
				fallback,
				content,
				occurrences: 0
			};
			variants.push(candidate);
		}
		return candidate;
	}
	function visit(input) {
		visitCandidate(getCandidate(input));
		return input;
	}
	function visitCandidate(candidate) {
		const ast = candidate.ast;
		candidate.occurrences++;
		if (candidate.visiting) {
			candidate.isRecursive = true;
			return;
		}
		if (candidate.occurrences > 1) return;
		candidate.visiting = true;
		if (candidate.content?.schema !== void 0) visitCandidate(candidate.content.schema);
		visitChecks(ast.checks);
		switch (ast._tag) {
			default:
				if ("recur" in ast) ast.recur(visit);
				break;
			case "TemplateLiteral":
				ast.parts.forEach(visit);
				break;
			case "Suspend": visit(ast.thunk());
		}
		candidate.visiting = false;
	}
	function visitChecks(checks) {
		checks?.forEach((check) => {
			check.annotations?.representation?.schemas?.forEach((schema) => visit(toType$1(schema)));
			if (check._tag === "FilterGroup") visitChecks(check.checks);
		});
	}
	function recur(input) {
		return recurCandidate(getCandidate(input));
	}
	function recurCandidate(candidate) {
		const ast = candidate.ast;
		const reference = candidate.reference;
		if (reference !== void 0) {
			if (!candidate.emitted) {
				candidate.emitted = true;
				const representation = on(candidate.identifier === void 0 ? ast : annotateReference(ast, candidate, reference), candidate.content);
				assignProperty(references, reference, representation);
			}
			return {
				_tag: "Reference",
				$ref: reference
			};
		}
		return on(ast, candidate.content);
	}
	function on(ast, content) {
		const common = {
			checks: ast.checks?.map(fromCheck) ?? [],
			...ast._tag === "Declaration" ? fromAnnotations(ast.annotations) : annotationsField(ast.annotations)
		};
		switch (ast._tag) {
			case "Declaration": return {
				_tag: ast._tag,
				typeParameters: ast.typeParameters.map(recur),
				...common
			};
			default: return {
				_tag: ast._tag,
				...content === void 0 ? void 0 : { content: {
					mediaType: content.mediaType,
					...content.schema === void 0 ? void 0 : { schema: recurCandidate(content.schema) }
				} },
				...common
			};
			case "Literal": return {
				_tag: ast._tag,
				literal: ast.literal,
				...common
			};
			case "UniqueSymbol": return {
				_tag: ast._tag,
				symbol: ast.symbol,
				...common
			};
			case "Enum": return {
				_tag: ast._tag,
				enums: ast.enums,
				...common
			};
			case "TemplateLiteral": return {
				_tag: ast._tag,
				parts: ast.parts.map(recur),
				...common
			};
			case "Arrays": return {
				_tag: ast._tag,
				elements: ast.elements.map((element) => {
					const projected = getLastEncoding(element);
					const annotations = projected.context?.annotations;
					return {
						isOptional: isOptional(projected),
						type: recur(element),
						...annotationsField(annotations)
					};
				}),
				rest: ast.rest.map(recur),
				...common
			};
			case "Objects": return {
				_tag: ast._tag,
				propertySignatures: ast.propertySignatures.map((property) => {
					const projected = getLastEncoding(property.type);
					const annotations = projected.context?.annotations;
					return {
						name: property.name,
						type: recur(property.type),
						isOptional: isOptional(projected),
						isMutable: isMutable(projected),
						...annotationsField(annotations)
					};
				}),
				indexSignatures: ast.indexSignatures.map((index) => ({
					parameter: recur(index.parameter),
					type: recur(index.type)
				})),
				...common
			};
			case "Union": return {
				_tag: ast._tag,
				types: ast.types.map(recur),
				...ast.options === void 0 ? {} : { options: ast.options },
				...common
			};
			case "Suspend": return {
				_tag: ast._tag,
				...common,
				checks: [],
				thunk: recur(ast.thunk())
			};
		}
	}
	function fromCheck(check) {
		return {
			...check._tag === "Filter" ? {
				_tag: check._tag,
				aborted: check.aborted
			} : {
				_tag: check._tag,
				checks: map$4(check.checks, fromCheck)
			},
			...fromAnnotations(check.annotations, true)
		};
	}
	function fromAnnotations(annotations, projectSchemas = false) {
		if (annotations === void 0) return void 0;
		const { representation, ...ordinary } = annotations;
		const projected = projectSchemas && representation?.schemas !== void 0 ? {
			...representation,
			schemas: representation.schemas.map((schema) => recur(toType$1(schema)))
		} : representation;
		return {
			...projected === void 0 ? void 0 : { representation: projected },
			...Object.keys(ordinary).length === 0 ? void 0 : { annotations: ordinary }
		};
	}
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Struct.js
/**
* Creates a new struct with the specified keys removed.
*
* **When to use**
*
* Use to exclude sensitive or irrelevant fields from a struct.
*
* **Gotchas**
*
* Keys not present in the struct are silently ignored.
*
* **Example** (Removing a property)
*
* ```ts import.meta.vitest
* import { pipe, Struct } from "effect"
*
* const user = { name: "Alice", age: 30, password: "secret" }
* pipe(user, Struct.omit(["password"])) // => { name: "Alice", age: 30 }
* ```
*
* @see {@link pick} – the inverse (keep only specified keys)
* @stability stable
* @category filtering
* @since 2.0.0
*/
var omit = /*#__PURE__*/ dual(2, (self, keys) => {
	return buildStruct(self, (k, v) => !hasPropertyKey(keys, k) ? [k, v] : void 0);
});
/**
* Wraps a plain function as a {@link Lambda} value so it can be used with
* {@link map}, {@link mapPick}, and {@link mapOmit}.
*
* **When to use**
*
* Use to create a typed lambda for struct mapping APIs that need type-level
* input and output tracking.
*
* **Details**
*
* The type parameter `L` encodes both the input and output types at the type
* level, allowing the compiler to track how struct value types change. At
* runtime, the returned value is the same function; `lambda` only adjusts the
* type.
*
* **Example** (Wrapping values in arrays)
*
* ```ts import.meta.vitest
* import { pipe, Struct } from "effect"
*
* interface AsArray extends Struct.Lambda {
*   <A>(self: A): Array<A>
*   readonly "~lambda.out": Array<this["~lambda.in"]>
* }
*
* const asArray = Struct.lambda<AsArray>((a) => [a])
* const result = pipe({ x: 1, y: "hello" }, Struct.map(asArray))
* result // => { x: [1], y: ["hello"] }
* ```
*
* @see {@link Lambda} – the type-level interface
* @see {@link map} – apply a lambda to all struct values
* @stability stable
* @category constructors
* @since 4.0.0
*/
var lambda = (f) => f;
/**
* Applies a {@link Lambda} transformation to every value in a struct.
*
* **When to use**
*
* Use when you want to apply the same function to every value in a struct.
*
* **Details**
*
* The lambda must be created with {@link lambda} so the compiler can track the
* output types.
*
* **Example** (Wrapping every value in an array)
*
* ```ts import.meta.vitest
* import { pipe, Struct } from "effect"
*
* interface AsArray extends Struct.Lambda {
*   <A>(self: A): Array<A>
*   readonly "~lambda.out": Array<this["~lambda.in"]>
* }
*
* const asArray = Struct.lambda<AsArray>((a) => [a])
* const result = pipe({ width: 10, height: 20 }, Struct.map(asArray))
* result // => { width: [10], height: [20] }
* ```
*
* @see {@link mapPick} – apply a lambda only to selected keys
* @see {@link mapOmit} – apply a lambda to all keys except selected ones
* @see {@link evolve} – apply different functions to different keys
* @stability stable
* @category mapping
* @since 4.0.0
*/
var map = /*#__PURE__*/ dual(2, (self, lambda) => {
	return buildStruct(self, (k, v) => [k, lambda(v)]);
});
function hasPropertyKey(keys, key) {
	return keys.some((candidate) => candidate === key || typeof candidate === "number" && String(candidate) === key);
}
/**
* Walk `source`; for each key decide what to emit via the small callback.
*
* The callback returns either
*   • `undefined`  → nothing is copied, or
*   • `[newKey, newVal]`
*
* so every public API just supplies a different callback.
*/
function buildStruct(source, f) {
	const out = {};
	for (const k of Reflect.ownKeys(source)) {
		if (!Object.prototype.propertyIsEnumerable.call(source, k)) continue;
		const res = f(k, source[k]);
		if (res) {
			const [nk, nv] = res;
			assignProperty(out, nk, nv);
		}
	}
	return out;
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/schemaError.js
var SchemaErrorTypeId = "~effect/Schema/SchemaError";
function isSchemaError$1(u) {
	return hasProperty(u, "~effect/Schema/SchemaError") && u["~effect/Schema/SchemaError"] === "~effect/Schema/SchemaError";
}
({ ...BaseProto });
({ ...BaseProto });
({ ...BaseProto });
({ ...BaseProto });
({ ...BaseProto });
({ ...BaseProto });
({ ...BaseProto });
({ ...BaseProto });
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Schema.js
var TypeId$7 = TypeId$10;
/**
* Creates a schema for a **parametric** type (a generic container such as
* `Array<A>`, `Option<A>`, etc.) by accepting a list of type-parameter schemas
* and a decoder factory.
*
* **When to use**
*
* Use when you are defining a schema for a generic container whose validation
* depends on one or more type-parameter schemas.
*
* **Details**
*
* The outer call `declareConstructor<T, E, Iso>()` fixes the decoded type `T`,
* the encoded type `E`, and the optional iso type. The inner call receives:
* - `typeParameters` — the concrete schemas for each type variable
* - `run` — a factory that, given resolved codecs for each type parameter,
*   returns a parsing function `(u, ast, options) => Effect<T, Issue>`
* - `annotations` — optional metadata
*
* @see {@link declare} for creating schemas for non-parametric types.
*
* **Example** (Schema for a parametric `Box<A>` type)
*
* ```ts import.meta.vitest
* import { Effect, Schema, SchemaIssue, SchemaParser } from "effect"
*
* interface Box<A> {
*   readonly value: A
* }
*
* const isBox = (u: unknown): u is Box<unknown> =>
*   typeof u === "object" && u !== null && "value" in u
*
* const Box = <A extends Schema.Constraint>(item: A) =>
*   Schema.declareConstructor<Box<A["Type"]>, Box<A["Encoded"]>>()(
*     [item],
*     ([itemCodec]) =>
*       (u, ast, options) => {
*         if (!isBox(u)) {
*           return Effect.fail(new SchemaIssue.InvalidType(ast, u, options))
*         }
*         return Effect.map(
*           SchemaParser.decodeUnknownEffect(itemCodec)(u.value, options),
*           (value) => ({ value })
*         )
*       }
*   )
*
* const schema = Box(Schema.Number)
* Effect.runSync(Schema.decodeUnknownEffect(schema)({ value: 1 })) // => { value: 1 }
* ```
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
function declareConstructor() {
	return (typeParameters, run, annotations) => {
		return make$3(new Declaration(typeParameters.map(getAST), (typeParameters) => run(typeParameters.map((ast) => make$3(ast))), annotations));
	};
}
/**
* Creates a schema for a **non-parametric** opaque type using a type-guard
* function. The schema accepts any unknown value and succeeds when `is` returns
* `true`, failing with an `InvalidType` issue otherwise.
*
* **When to use**
*
* Use when you are defining a schema for an opaque type with no type parameters
* and validation can be expressed as a type guard.
*
* **Example** (Defining a schema for a custom `UserId` branded type)
*
* ```ts import.meta.vitest
* import { Schema } from "effect"
*
* type UserId = string & { readonly _tag: "UserId" }
*
* const isUserId = (u: unknown): u is UserId =>
*   typeof u === "string" && u.startsWith("user_")
*
* const UserId = Schema.declare<UserId>(isUserId, {
*   title: "UserId",
*   description: "A user identifier starting with 'user_'"
* })
* Schema.decodeUnknownSync(UserId)("user_123") // => "user_123"
* ```
*
* @see {@link declareConstructor} for creating schemas for parametric types.
*
* @stability stable
* @category constructors
* @since 3.10.0
*/
function declare(is, annotations) {
	return declareConstructor()([], () => (input, ast, options) => is(input) ? succeed$1(input) : fail$1(new InvalidType(ast, input, options)), annotations);
}
/**
* Error thrown or returned when schema decoding or encoding fails.
*
* **Details**
*
* The `issue` field contains a structured {@link SchemaIssue.Issue} tree describing
* every validation failure, including the path to the problematic value and
* the expected type or constraint. The `message` field renders the issue tree
* with the default formatter.
*
* **Gotchas**
*
* Parsing with `reportInput: true` adds an enumerable `input` field to
* value-bearing issues. Built-in messages may include reported input, and
* custom annotations or messages are not sanitized.
*
* **Example** (Inspecting a SchemaError)
*
* ```ts import.meta.vitest
* import { Result, Schema } from "effect"
*
* const result = Schema.decodeUnknownResult(Schema.Number)("not a number")
* const message = Result.isFailure(result) ? result.failure.message : ""
* message // => "Expected number"
* ```
*
* @see {@link isSchemaError} for narrowing unknown values
* @stability stable
* @category errors
* @since 4.0.0
*/
var SchemaError = class extends (/*#__PURE__*/ TaggedError$1("SchemaError")) {
	[SchemaErrorTypeId] = SchemaErrorTypeId;
	constructor(issue) {
		const stackTraceLimit = getStackTraceLimit();
		setStackTraceLimit(0);
		try {
			super({ issue });
		} finally {
			setStackTraceLimit(stackTraceLimit);
		}
	}
	get message() {
		return defaultFormatter(this.issue);
	}
	toJSON() {
		return {
			_tag: this._tag,
			message: this.message
		};
	}
	[NodeInspectSymbol]() {
		return this.toJSON();
	}
	toString() {
		return `SchemaError(${this.message})`;
	}
};
/**
* Returns `true` if `u` is a {@link SchemaError}.
*
* **When to use**
*
* Use when you need to narrow an unknown value to `SchemaError`.
*
* **Example** (Narrowing Schema errors)
*
* ```ts import.meta.vitest
* import { Result, Schema } from "effect"
*
* const result = Result.try(() => Schema.decodeUnknownSync(Schema.Number)("oops"))
* const error: unknown = Result.isFailure(result) ? result.failure : undefined
* Schema.isSchemaError(error) // => true
* ```
*
* @stability stable
* @category guards
* @since 4.0.0
*/
function isSchemaError(u) {
	return isSchemaError$1(u);
}
function fromIssueEffect(self) {
	if (effectIsExit(self)) return fromIssueExit(self);
	return catchCause(self, (cause) => failCauseSync(() => map$2(cause, (issue) => new SchemaError(issue))));
}
function fromIssueExit(exit) {
	return isSuccess(exit) ? exit : failCause(map$2(exit.cause, (issue) => new SchemaError(issue)));
}
function getSchemaErrorOrThrow(cause, message) {
	let schemaError;
	for (const reason of cause.reasons) {
		if (!isFailReason(reason) || !isSchemaError(reason.error)) throw new globalThis.Error(message, { cause });
		schemaError ??= reason.error;
	}
	if (schemaError === void 0) throw new globalThis.Error(message, { cause });
	return schemaError;
}
function runSchemaErrorSync(self) {
	const exit = runSyncExit(self);
	if (isSuccess(exit)) return exit.value;
	throw getSchemaErrorOrThrow(exit.cause, "Sync adapter can only throw schema errors");
}
/**
* Creates a type guard function that checks if a value conforms to a given
* schema.
*
* **Details**
*
* This function returns a predicate that performs a type-safe check, narrowing
* the type of the input value if the check passes. The predicate returns `false`
* for schema mismatches.
*
* **Gotchas**
*
* Only causes made entirely of schema issues are converted to `false`. Causes
* that contain defects, interruptions, or other non-schema reasons throw
* instead.
*
* **Example** (Defining a basic type guard)
*
* ```ts import.meta.vitest
* import { Schema } from "effect"
*
* const isString = Schema.is(Schema.String)
*
* isString("hello") // => true
* isString(42) // => false
*
* // Type narrowing in action
* const value: unknown = "hello"
* if (isString(value)) {
*   // value is now typed as string
*   value.toUpperCase() // => "HELLO"
* }
* ```
*
* @stability stable
* @category guards
* @since 3.10.0
*/
var is = is$1;
/**
* Decodes an `unknown` input against a schema, returning an `Effect` that
* succeeds with the decoded value or fails with a {@link SchemaError}.
*
* **When to use**
*
* Use when you need to decode unknown input in an `Effect` whose failure
* channel is `SchemaError`.
*
* **Details**
*
* Prefer {@link decodeEffect} when the input is already typed as the schema's
* `Encoded` type.
* Options may be provided either when creating the decoder or when applying it;
* application options override creation options.
*
* @see {@link SchemaParser.decodeUnknownEffect} for the adapter that fails with `SchemaIssue.Issue` directly
*
* @stability stable
* @category decoding
* @since 4.0.0
*/
function decodeUnknownEffect(schema, options) {
	const parser = decodeUnknownEffect$1(schema, options);
	return (input, options) => {
		return fromIssueEffect(parser(input, options));
	};
}
/**
* Decodes an `unknown` input against a schema, returning an `Option` that is
* `Some` with the decoded value on success or `None` for schema mismatches.
*
* **When to use**
*
* Use when you do not know the input type statically and only need to know
* whether decoding succeeded.
*
* **Details**
*
* Prefer this over {@link decodeUnknownExit} or {@link decodeUnknownEffect}
* when you don't need error details. For input already typed as the schema's
* `Encoded` type use {@link decodeOption}.
* Options may be provided either when creating the decoder or when applying it;
* application options override creation options.
*
* **Gotchas**
*
* Only causes made entirely of schema issues are converted to `None`. Causes
* that contain defects, interruptions, or other non-schema reasons throw
* instead.
*
* @stability stable
* @category decoding
* @since 3.10.0
*/
var decodeUnknownOption = decodeUnknownOption$1;
/**
* Decodes an `unknown` input against a schema synchronously, returning the
* decoded value or throwing a {@link SchemaError} for schema mismatches.
*
* **When to use**
*
* Use when you need to validate unknown data at a synchronous boundary and want
* schema mismatches to throw `SchemaError`.
*
* **Details**
*
* For input already typed as the schema's `Encoded` type use `decodeSync`.
* Only service-free schemas can be decoded synchronously. For alternatives that
* do not throw on schema mismatches, see `decodeUnknownOption`,
* `decodeUnknownExit`, or `decodeUnknownEffect`. Options may be provided either
* when creating the decoder or when applying it; application options override
* creation options.
*
* **Gotchas**
*
* Non-schema failures may throw a runtime failure instead of `SchemaError`.
*
* **Example** (Decoding with a transformation schema)
*
* ```ts import.meta.vitest
* import { Schema } from "effect"
*
* const NumberFromString = Schema.NumberFromString
*
* Schema.decodeUnknownSync(NumberFromString)("42") // => 42
* ```
*
* @see {@link SchemaParser.decodeUnknownSync} for the adapter that throws an `Error` whose cause is `SchemaIssue.Issue`
*
* @stability stable
* @category decoding
* @since 4.0.0
*/
function decodeUnknownSync(schema, options) {
	const parser = decodeUnknownEffect(schema, options);
	return (input, options) => {
		return runSchemaErrorSync(parser(input, options));
	};
}
/**
* Encodes an `unknown` input against a schema, returning an `Effect` that
* succeeds with the encoded value or fails with a {@link SchemaError}.
*
* **When to use**
*
* Use when you need to encode unknown input in an `Effect` whose failure
* channel is `SchemaError`.
*
* **Details**
*
* Prefer {@link encodeEffect} when the value is already typed as the schema's
* `Type`.
* Options may be provided either when creating the encoder or when applying it;
* application options override creation options.
*
* **Example** (Encoding a value to a string)
*
* ```ts import.meta.vitest
* import { Effect, Schema } from "effect"
*
* const NumberFromString = Schema.NumberFromString
*
* await Effect.runPromise(Schema.encodeUnknownEffect(NumberFromString)(42)) // => "42"
* ```
*
* @see {@link SchemaParser.encodeUnknownEffect} for the adapter that fails with `SchemaIssue.Issue` directly
*
* @stability stable
* @category encoding
* @since 4.0.0
*/
function encodeUnknownEffect(schema, options) {
	const parser = encodeUnknownEffect$1(schema, options);
	return (input, options) => {
		return fromIssueEffect(parser(input, options));
	};
}
/**
* Encodes an `unknown` input against a schema synchronously, throwing a
* {@link SchemaError} for schema mismatches.
*
* **When to use**
*
* Use when you need to serialize unknown data at a synchronous boundary and
* want schema mismatches to throw `SchemaError`.
*
* **Details**
*
* For alternatives that do not throw on schema mismatches, see
* {@link encodeUnknownOption}, {@link encodeUnknownExit}, or
* {@link encodeUnknownEffect}. For values already typed as the schema's `Type`
* use {@link encodeSync}. Options may be provided either when creating the
* encoder or when applying it; application options override creation options.
*
* **Gotchas**
*
* Non-schema failures may throw a runtime failure instead of `SchemaError`.
*
* @see {@link SchemaParser.encodeUnknownSync} for the adapter that throws an `Error` whose cause is `SchemaIssue.Issue`
*
* @stability stable
* @category encoding
* @since 4.0.0
*/
function encodeUnknownSync(schema, options) {
	const parser = encodeUnknownEffect(schema, options);
	return (input, options) => {
		return runSchemaErrorSync(parser(input, options));
	};
}
/**
* Encodes a typed input (the schema's `Type`) against a schema synchronously,
* throwing a {@link SchemaError} for schema mismatches.
*
* **When to use**
*
* Use when you already have a value typed as the schema's `Type` and want
* schema mismatches to throw `SchemaError` synchronously.
*
* **Details**
*
* For `unknown` input use {@link encodeUnknownSync}.
* Options may be provided either when creating the encoder or when applying it;
* application options override creation options.
*
* **Gotchas**
*
* Non-schema failures may throw a runtime failure instead of `SchemaError`.
*
* @see {@link SchemaParser.encodeSync} for the adapter that throws an `Error` whose cause is `SchemaIssue.Issue`
*
* @stability stable
* @category encoding
* @since 4.0.0
*/
var encodeSync = encodeUnknownSync;
/**
* Creates a schema from an AST (Abstract Syntax Tree) node.
*
* **Details**
*
* This is the fundamental constructor for all schemas in the Effect Schema
* library. It takes an AST node and wraps it in a fully-typed schema that
* preserves all type information and provides the complete schema API.
*
* The `make` function is used internally to create all primitive schemas like
* `String`, `Number`, `Boolean`, etc., as well as more complex schemas. It's
* the bridge between the untyped AST representation and the strongly-typed
* schema.
*
* @stability stable
* @category constructors
* @since 3.10.0
*/
var make$3 = make$4;
/**
* Checks whether a value is a `Schema`.
*
* @stability stable
* @category guards
* @since 3.10.0
*/
function isSchema(u) {
	return hasProperty(u, TypeId$7) && u[TypeId$7] === TypeId$7;
}
/**
* Creates an exact optional key schema for struct fields. Unlike `optional`,
* this creates exact optional properties (not `| undefined`) that can be
* completely omitted from the object.
*
* **Example** (Creating a struct with optional key)
*
* ```ts import.meta.vitest
* import { Schema } from "effect"
*
* const schema = Schema.Struct({
*   name: Schema.String,
*   age: Schema.optionalKey(Schema.Number)
* })
*
* // Type: { readonly name: string; readonly age?: number }
* type Person = typeof schema["Type"]
* ```
*
* @stability stable
* @category combinators
* @since 4.0.0
*/
var optionalKey = /*#__PURE__*/ lambda((schema) => make$3(optionalKey$1(schema.ast), { schema }));
/**
* Extracts the type-side schema: sets `Encoded` to equal the decoded `Type`,
* discarding the encoding transformation path.
*
* @stability stable
* @category transforming
* @since 4.0.0
*/
var toType = /*#__PURE__*/ lambda((schema) => make$3(toType$1(schema.ast), { schema }));
/**
* Extracts the encoded-side schema: sets `Type` to equal the `Encoded`,
* discarding the decoding transformation path.
*
* @stability stable
* @category transforming
* @since 4.0.0
*/
var toEncoded = /*#__PURE__*/ lambda((schema) => make$3(toEncoded$1(schema.ast), { schema }));
/**
* Creates a schema for a single literal value (string, number, bigint, boolean, or null).
*
* **Example** (Defining a string literal)
*
* ```ts import.meta.vitest
* import { Schema } from "effect"
*
* const schema = Schema.Literal("hello")
* // Type: Schema.Literal<"hello">
* Schema.decodeSync(schema)("hello") // => "hello"
* ```
*
* @see {@link Literals} for a schema that represents a union of literals.
* @see {@link tag} for a schema that represents a literal value that can be
* used as a discriminator field in tagged unions and has a constructor default.
* @stability stable
* @category constructors
* @since 3.10.0
*/
function Literal(literal) {
	const out = make$3(new Literal$1(literal), {
		literal,
		transform(to) {
			return out.pipe(decodeTo(Literal(to), {
				decode: transform$1(() => to),
				encode: transform$1(() => literal)
			}));
		}
	});
	return out;
}
/**
* Creates a schema from a TypeScript enum or an object mapping names to string or number values.
* Validates that the input is one of those values. Numeric values must be finite.
*
* **Gotchas**
*
* Throws when a numeric member is `NaN`, `Infinity`, or `-Infinity`.
*
* **Example** (Defining a direction enum)
*
* ```ts import.meta.vitest
* import { Schema } from "effect"
*
* enum Direction {
*   Up = "Up",
*   Down = "Down"
* }
*
* const schema = Schema.Enum(Direction)
* Schema.decodeSync(schema)(Direction.Up) // => "Up"
* ```
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
function Enum(enums) {
	return make$3(new Enum$1(Object.keys(enums).filter((key) => typeof enums[enums[key]] !== "number").map((key) => [key, enums[key]])), { enums });
}
/**
* Schema for the `unknown` type. Accepts any value without validation.
*
* **When to use**
*
* Use as a top schema when you need to accept any input while preserving
* TypeScript's `unknown` safety at use sites.
*
* @see {@link Any} for the `any` variant.
* @stability stable
* @category schemas
* @since 3.10.0
*/
var Unknown = /*#__PURE__*/ make$3(unknown);
/**
* Schema for the `null` literal. Validates that the input is strictly `null`.
*
* @see {@link NullOr} for a union with another schema.
* @stability stable
* @category schemas
* @since 3.10.0
*/
var Null = /*#__PURE__*/ make$3(null_);
/**
* Schema for `string` values. Validates that the input is `typeof` `"string"`.
*
* @stability stable
* @category schemas
* @since 4.0.0
*/
var String$1 = /*#__PURE__*/ make$3(string);
/**
* Schema for `number` values, including `NaN`, `Infinity`, and `-Infinity`.
*
* **Details**
*
* Default JSON serializer:
*
* - Finite numbers are serialized as numbers.
* - Non-finite values are serialized as strings (`"NaN"`, `"Infinity"`, `"-Infinity"`).
*
* @see {@link Finite} for a schema that excludes non-finite values.
* @stability stable
* @category schemas
* @since 4.0.0
*/
var Number$1 = /*#__PURE__*/ make$3(number);
/**
* Schema for `boolean` values. Validates that the input is `typeof` `"boolean"`.
*
* **When to use**
*
* Use to validate values that are already JavaScript booleans.
*
* @see {@link BooleanFromBit} for a schema that decodes bit literals `0` or `1` into a boolean
*
* @stability stable
* @category schemas
* @since 4.0.0
*/
var Boolean$1 = /*#__PURE__*/ make$3(boolean);
/**
* Schema for a TypeScript `void` return value.
*
* **When to use**
*
* Use when you need to model the return value of a function, RPC, or endpoint
* whose result is intentionally ignored.
*
* **Details**
*
* Runtime parsing accepts any present value and discards it, producing
* `undefined`. The public decoded and encoded TypeScript representation remains
* `void`, so typed construction, decoding, and encoding APIs are still modeled
* as `void`.
*
* @see {@link Undefined} for a schema that matches only the exact `undefined` value.
* @stability stable
* @category schemas
* @since 3.10.0
*/
var Void = /*#__PURE__*/ make$3(void_);
function makeStruct(ast, fields) {
	return make$3(ast, {
		fields,
		mapFields(f, options) {
			const fields = f(this.fields);
			return makeStruct(struct(fields, options?.unsafePreserveChecks ? this.ast.checks : void 0), fields);
		}
	});
}
/**
* Defines a struct schema from a map of field schemas.
*
* **Details**
*
* Each field value is a schema. Use {@link optionalKey} or {@link optional} to
* mark fields as optional, and {@link mutableKey} to mark them as mutable.
*
* The resulting schema's `Type` is a readonly object type with the fields'
* decoded types. The `Encoded` form mirrors the field schemas' encoded types.
* Declared fields may be inherited and are copied to own properties in the
* output. The `__proto__` field is accepted only when it is an own property.
* Parsing does not guarantee that output keys retain their input order.
*
* **Example** (Defining a basic struct)
*
* ```ts import.meta.vitest
* import { Schema } from "effect"
*
* const Person = Schema.Struct({
*   name: Schema.String,
*   age: Schema.Number,
*   email: Schema.optionalKey(Schema.String)
* })
*
* // { readonly name: string; readonly age: number; readonly email?: string }
* type Person = typeof Person.Type
*
* Schema.decodeUnknownSync(Person)({ name: "Alice", age: 30 }) // => { name: "Alice", age: 30 }
* ```
*
* @stability stable
* @category constructors
* @since 3.10.0
*/
function Struct(fields) {
	return makeStruct(struct(fields, void 0), fields);
}
/**
* @category constructors
* @since 4.0.0
*/
var ArraySchema = /*#__PURE__*/ lambda((schema) => make$3(new Arrays(false, [], [schema.ast]), { value: schema }));
function makeUnion(ast, members) {
	return make$3(ast, {
		members,
		mapMembers(f, options) {
			const members = f(this.members);
			return makeUnion(union(members, this.ast.options, options?.unsafePreserveChecks ? this.ast.checks : void 0), members);
		}
	});
}
/**
* Creates a union schema from a fixed-length tuple of member schemas. Members
* are tested in order; the first match is returned.
*
* **Details**
*
* Optionally, specify `mode`:
* - `"anyOf"` (default) — matches if any member matches.
* - `"oneOf"` — matches if exactly one member matches.
*
* **Gotchas**
*
* Use an inline tuple or `as const`. Widened arrays, such as `Object.values(...)`
* or `.map(...)` results, and open-ended tuples are unsupported despite being
* accepted by the signature.
*
* **Example** (Defining a string or number union)
*
* ```ts import.meta.vitest
* import { Schema } from "effect"
*
* const schema = Schema.Union([Schema.String, Schema.Number])
*
* Schema.decodeUnknownSync(schema)("hello") // => "hello"
* Schema.decodeUnknownSync(schema)(42) // => 42
* ```
*
* @stability stable
* @category constructors
* @since 3.10.0
*/
function Union(members, options) {
	return makeUnion(union(members, options, void 0), members);
}
/**
* Creates a union schema of `S | null`.
*
* @stability stable
* @category constructors
* @since 3.10.0
*/
var NullOr = /*#__PURE__*/ lambda((self) => Union([self, Null]));
/**
* Intersects a schema's output type with `Brand.Brand<B>` to prevent accidental
* mixing of structurally identical types.
*
* **When to use**
*
* Use to make values decoded by an existing schema nominally distinct when the
* schema already carries the runtime validation you need.
*
* **Gotchas**
*
* - `identifier` must be a single concrete string literal. Widened strings,
*   unions, and open template literal types are rejected.
* - `brand` only narrows the TypeScript output type. It does not change the
*   schema's runtime AST or add runtime checks.
* - Schema representations and generated schema code omit the brand. Reapply
*   `brand` after rebuilding or generating a schema when the nominal type is
*   still required.
*
* @see {@link fromBrand} for applying a Brand constructor's checks along with its branded type
*
* @stability stable
* @category branding
* @since 3.10.0
*/
function brand(identifier) {
	return (schema) => make$3(schema.ast, {
		schema,
		identifier
	});
}
function decodeTo(to, transformation) {
	return (from) => {
		return make$3(decodeTo$1(from.ast, to.ast, transformation ? makeTransformation(transformation) : passthrough()), {
			from,
			to
		});
	};
}
/**
* Attaches a constructor default value to a schema field.
*
* **Details**
*
* Constructor defaults are applied only during `make*`, not during decoding or
* encoding. Failures are represented directly as `SchemaIssue.Issue` values.
*
* **Example** (Defining an optional field with a static default)
*
* ```ts import.meta.vitest
* import { Effect, Schema } from "effect"
*
* const MySchema = Schema.Struct({
*   name: Schema.String.pipe(
*     Schema.optionalKey,
*     Schema.withConstructorDefault(Effect.succeed("anonymous"))
*   )
* })
*
* MySchema.make({}).name // => "anonymous"
* ```
*
* @stability stable
* @category constructors
* @since 3.10.0
*/
function withConstructorDefault(defaultValue) {
	return (schema) => make$3(withConstructorDefault$1(schema.ast, defaultValue), { schema });
}
function toIssueEffect(self) {
	if (effectIsExit(self) && self._tag === "Success") return self;
	return catchCause(self, (cause) => failCauseSync(() => map$2(cause, (error) => error.issue)));
}
/**
* Makes a struct key optional on the `Encoded` side and provides a default
* `Encoded` value when the key is missing during decoding.
*
* **Details**
*
* The key uses `optionalKey` on the encoded side, so it may be absent from the
* input object but **not** `undefined`. The default value is specified in terms
* of the `Encoded` type (before any decoding transformations).
*
* Options:
*
* - `encodingStrategy`:
*   - `"passthrough"` (default): include the value in the encoded output.
*   - `"omit"`: omit the key from the encoded output.
*
* **Example** (Providing a default for a missing struct key)
*
* ```ts import.meta.vitest
* import { Effect, Schema } from "effect"
*
* const MySchema = Schema.Struct({
*   name: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed("anonymous")))
* })
*
* Schema.decodeUnknownSync(MySchema)({}).name // => "anonymous"
* ```
*
* @see {@link withDecodingDefault} for the value-level variant (key absent **or** `undefined`)
* @see {@link withDecodingDefaultTypeKey} for the variant where the default is a `Type` value
* @stability stable
* @category decoding
* @since 4.0.0
*/
function withDecodingDefaultKey(defaultValue, options) {
	const encode = options?.encodingStrategy === "omit" ? omit$1() : passthrough$1();
	return (self) => {
		return optionalKey(toEncoded(self)).pipe(decodeTo(self, {
			decode: withDefault$1(toIssueEffect(defaultValue)),
			encode
		}));
	};
}
/**
* Combines a {@link Literal} schema with {@link withConstructorDefault}, making it ideal
* for discriminator fields in tagged unions. When constructing via `make`, the
* `_tag` field can be omitted and will be filled automatically.
*
* **Example** (Defining a discriminated union tag)
*
* ```ts import.meta.vitest
* import { Schema } from "effect"
*
* const A = Schema.Struct({ _tag: Schema.tag("A"), value: Schema.Number })
*
* // _tag is optional in make, auto-filled to "A"
* const a = A.make({ value: 42 })
* a // => { _tag: "A", value: 42 }
* ```
*
* @see {@link tagDefaultOmit} to also omit the tag during encoding
* @see {@link TaggedStruct} for a shorthand that adds `_tag` automatically
* @stability stable
* @category constructors
* @since 3.10.0
*/
function tag$2(literal) {
	return Literal(literal).pipe(withConstructorDefault(succeed$1(literal)));
}
/**
* Creates a struct schema with an automatically populated `_tag` field.
*
* **When to use**
*
* Use to define a tagged union case from a literal tag and a set of fields.
*
* **Details**
*
* When using the `make` method, the `_tag` field is optional and will be
* added automatically. However, when decoding or encoding, the `_tag` field
* must be present in the input.
*
* **Example** (Defining a tagged struct shorthand)
*
* ```ts import.meta.vitest
* import { Schema } from "effect"
*
* // Defines a struct with a fixed `_tag` field
* const tagged = Schema.TaggedStruct("A", {
*   a: Schema.String
* })
*
* // This is the same as writing:
* const equivalent = Schema.Struct({
*   _tag: Schema.tag("A"),
*   a: Schema.String
* })
* void tagged
* void equivalent
* ```
*
* **Example** (Accessing the literal value of the tag)
*
* ```ts import.meta.vitest
* import { Schema } from "effect"
*
* const tagged = Schema.TaggedStruct("A", {
*   a: Schema.String
* })
*
* tagged.fields._tag.schema.literal // => "A"
* ```
*
* @stability stable
* @category constructors
* @since 3.10.0
*/
function TaggedStruct(value, fields) {
	return Struct({
		_tag: tag$2(value),
		...fields
	});
}
/**
* Augments a {@link Union} of tagged structs or nested unions with utility methods
* and an ordered tuple of discriminant values.
*
* **Gotchas**
*
* - Requires fixed-length member tuples, including in nested unions. Widened arrays
*   and open-ended tuples compile but are unsupported and can lose members from
*   `discriminants`, `cases`, `guards` and match handler types.
* - Throws when multiple members use the same discriminant property key,
*   including members of nested unions. Numeric and string values such as `1`
*   and `"1"` count as duplicates.
*
* **Example** (Adding tagged-union utilities to an existing union)
*
* ```ts import.meta.vitest
* import { Schema } from "effect"
*
* const A = Schema.TaggedStruct("A", { value: Schema.Number })
* const B = Schema.TaggedStruct("B", { name: Schema.String })
*
* const MyUnion = Schema.Union([A, B]).pipe(Schema.toTaggedUnion("_tag"))
*
* // Pattern-match on the union
* const result = MyUnion.match({ _tag: "A", value: 1 }, {
*   A: (a) => `number: ${a.value}`,
*   B: (b) => `name: ${b.name}`
* })
* result // => "number: 1"
* ```
*
* @see {@link TaggedUnion} for a shorthand that builds the union from scratch
* @stability stable
* @category combinators
* @since 4.0.0
*/
function toTaggedUnion(tag) {
	return (self) => {
		const cases = {};
		const discriminants = [];
		const discriminantKeys = /* @__PURE__ */ new Set();
		const guards = {};
		const isAnyOf = (keys) => (value) => keys.includes(value[tag]);
		walk(self);
		return Object.assign(self, {
			tag,
			cases,
			discriminants,
			isAnyOf,
			guards,
			match,
			matchOrElse
		});
		function walk(schema) {
			const ast = schema.ast;
			if (isUnion(ast) && "members" in schema && globalThis.Array.isArray(schema.members) && schema.members.every(isSchema)) return schema.members.forEach(walk);
			const sentinels = collectSentinels(ast);
			if (sentinels.length > 0) {
				const literal = sentinels.find((s) => s.key === tag)?.literal;
				if (isPropertyKey(literal)) {
					const key = typeof literal === "number" ? globalThis.String(literal) : literal;
					if (discriminantKeys.has(key)) throw new globalThis.Error(`Duplicate discriminant: ${globalThis.String(literal)}`);
					discriminantKeys.add(key);
					discriminants.push(literal);
					assignProperty(cases, literal, schema);
					assignProperty(guards, literal, is$1(toType(schema)));
					return;
				}
			}
			throw new globalThis.Error("No literal or unique symbol found");
		}
		function match() {
			if (arguments.length === 1) {
				const cases = arguments[0];
				return function(value) {
					const key = value[tag];
					return (Object.hasOwn(cases, key) ? cases[key] : void 0)(value);
				};
			}
			const value = arguments[0];
			const cases = arguments[1];
			const key = value[tag];
			return (Object.hasOwn(cases, key) ? cases[key] : void 0)(value);
		}
		function matchOrElse() {
			if (arguments.length === 2) {
				const cases = arguments[0];
				const orElse = arguments[1];
				return function(value) {
					const key = value[tag];
					return (Object.hasOwn(cases, key) ? cases[key] ?? orElse : orElse)(value);
				};
			}
			const value = arguments[0];
			const cases = arguments[1];
			const orElse = arguments[2];
			const key = value[tag];
			return (Object.hasOwn(cases, key) ? cases[key] ?? orElse : orElse)(value);
		}
	};
}
/**
* Creates a schema that validates values using `instanceof`.
* Decoding and encoding pass the value through unchanged.
*
* **Example** (Defining a schema for a built-in class)
*
* ```ts import.meta.vitest
* import { Schema } from "effect"
*
* const DateSchema = Schema.instanceOf(Date)
*
* const decoded = Schema.decodeUnknownSync(DateSchema)(new Date("2024-01-01"))
* decoded.toISOString() // => "2024-01-01T00:00:00.000Z"
* ```
*
* @stability stable
* @category constructors
* @since 3.10.0
*/
function instanceOf(constructor, annotations) {
	return declare((u) => u instanceof constructor, annotations);
}
/**
* Constructs an `SchemaAST.Link` that describes how a value of type `T` encodes to and decodes from a `To` schema.
* Used when building low-level AST transformations that bridge two schema types.
*
* @stability stable
* @category transforming
* @since 4.0.0
*/
function link() {
	return (encodeTo, transformation) => {
		return new Link(encodeTo.ast, makeTransformation(transformation));
	};
}
/**
* Creates a custom validation filter from a predicate function.
*
* **Details**
*
* The predicate receives the decoded input value, the schema AST, and parse
* options, and returns a `FilterOutput`. Non-success outputs are normalized into
* schema issues. The `annotations` parameter annotates the filter itself; with
* the default formatter, failures use `message` first, `expected` second, and
* `<filter>` when neither is provided.
*
* When `abort` is `true`, parsing stops after this filter fails instead of
* collecting later check failures.
*
* **Example** (Reporting failure at a nested path)
*
* ```ts import.meta.vitest
* import { Result, Schema } from "effect"
*
* const schema = Schema.Struct({ password: Schema.String, confirmPassword: Schema.String }).check(
*   Schema.makeFilter((o) =>
*     o.password === o.confirmPassword
*       ? undefined
*       : { path: ["password"], issue: "password and confirmPassword must match" }
*   )
* )
*
* const result = Schema.decodeUnknownResult(schema)({ password: "123456", confirmPassword: "1234567" })
* const message = Result.isFailure(result) ? result.failure.message : ""
* message // => "password and confirmPassword must match\n  at [\"password\"]"
* ```
*
* **Example** (Reporting multiple failures at once)
*
* ```ts import.meta.vitest
* import { Result, Schema } from "effect"
*
* const schema = Schema.Struct({ a: Schema.Finite, b: Schema.Finite, c: Schema.Finite }).check(
*   Schema.makeFilter((o) => {
*     const issues: Array<Schema.FilterIssue> = []
*     if (o.a > 0) {
*       if (o.b <= 0) issues.push({ path: ["b"], issue: "b must be greater than 0" })
*       if (o.c <= 0) issues.push({ path: ["c"], issue: "c must be greater than 0" })
*     }
*     return issues
*   })
* )
*
* const result = Schema.decodeUnknownResult(schema)({ a: 1, b: 0, c: 0 })
* const message = Result.isFailure(result) ? result.failure.message : ""
* message // => "b must be greater than 0\n  at [\"b\"]\nc must be greater than 0\n  at [\"c\"]"
* ```
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var makeFilter = makeFilter$1;
/**
* Validates that a string matches the specified regular expression pattern.
*
* **Details**
*
* JSON Schema:
*
* Unless annotations override `toJsonSchema`, JSON Schema receives a `pattern`
* only when the JavaScript RegExp uses the Unicode flag and its other flags are
* `d`, `g`, or `y`. Sticky patterns are anchored at the start of the string.
*
* Arbitrary:
*
* During arbitrary generation, this applies a `patterns`
* constraint to ensure generated strings match the specified RegExp pattern.
*
* @stability stable
* @category validation
* @since 4.0.0
*/
function isPattern(regExp, annotations) {
	const source = regExp.source;
	const flags = regExp.flags;
	const canExport = /^[dg]*uy?$/.test(flags);
	const runtimeRegExp = flags === "" ? `new globalThis.RegExp(${format$1(source)})` : `new globalThis.RegExp(${format$1(source)}, ${format$1(flags)})`;
	return isPattern$1(regExp, {
		toJsonSchema: () => canExport ? { pattern: flags.endsWith("y") ? `^(?:${source})` : source } : [{}, true],
		toCode: () => ({ runtime: `Schema.isPattern(${runtimeRegExp})` }),
		...annotations
	});
}
var getUUIDRegExp = (version) => {
	if (version) return new globalThis.RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
	return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|[fF]{8}-[fF]{4}-[fF]{4}-[fF]{4}-[fF]{12})$/;
};
/**
* Validates that a string is a strict Universally Unique Identifier (UUID).
*
* **When to use**
*
* Use when you need UUID semantics, including version and RFC variant bits,
* rather than only the dashed hexadecimal shape.
*
* **Details**
*
* Without a version argument, this accepts UUID versions 1 through 8, the nil
* UUID (`00000000-0000-0000-0000-000000000000`), and the max UUID
* (`ffffffff-ffff-ffff-ffff-ffffffffffff`). With a version argument, this
* accepts only UUIDs with that version and RFC variant bits; nil and max UUIDs
* are not versioned UUIDs and do not match version-specific checks.
*
* JSON Schema:
*
* This check corresponds to a `pattern` constraint in JSON Schema that matches
* UUID format, and includes a `format: "uuid"` annotation.
*
* Arbitrary:
*
* During arbitrary generation, this applies a `patterns`
* constraint to ensure generated strings match the UUID pattern.
*
* @see {@link isGUID} for shape-only GUID validation.
* @stability stable
* @category validation
* @since 4.0.0
*/
function isUUID(version, annotations) {
	const regExp = getUUIDRegExp(version);
	return isPattern(regExp, {
		expected: version ? `a UUID v${version}` : "a UUID",
		representation: {
			id: "effect/schema/isUUID",
			payload: { version: version ?? null }
		},
		toJsonSchema: () => ({
			pattern: regExp.source,
			format: "uuid"
		}),
		toCode: () => ({ runtime: version === void 0 ? "Schema.isUUID()" : `Schema.isUUID(${version})` }),
		...annotations
	});
}
/**
* Creates a greater-than-or-equal-to (`>=`) check for any ordered type from an
* `Order.Order` instance.
*
* @stability stable
* @category validation
* @since 4.0.0
*/
function makeIsGreaterThanOrEqualTo(options) {
	const gte = isGreaterThanOrEqualTo$1(options.order);
	const formatter = options.formatter ?? format$1;
	return (minimum, annotations) => {
		return makeFilter((input) => gte(input, minimum), {
			expected: `a value greater than or equal to ${formatter(minimum)}`,
			arbitraryConstraint: {
				order: options.order,
				minimum
			},
			...options.annotate?.(minimum),
			...annotations
		});
	};
}
function encodeNumberPayload(number) {
	if (!globalThis.Number.isFinite(number)) throw new globalThis.RangeError(`Expected a finite number, got ${format$1(number)}`);
	return number;
}
/**
* Validates that a number is greater than or equal to the specified value
* (inclusive).
*
* **Details**
*
* JSON Schema:
*
* This check corresponds to the `minimum` constraint in JSON Schema.
*
* Arbitrary:
*
* During arbitrary generation, this applies a `minimum` constraint
* to ensure generated numbers are greater than or equal to the specified value.
*
* @stability stable
* @category validation
* @since 4.0.0
*/
var isGreaterThanOrEqualTo = /*#__PURE__*/ makeIsGreaterThanOrEqualTo({
	order: Number$4,
	annotate: (minimum) => ({
		representation: {
			id: "effect/schema/isGreaterThanOrEqualTo",
			payload: { minimum: encodeNumberPayload(minimum) }
		},
		toJsonSchema: () => ({ minimum }),
		toCode: () => ({ runtime: `Schema.isGreaterThanOrEqualTo(${format$1(minimum)})` })
	})
});
/**
* Validates that a number is a safe integer (within the safe integer range
* that can be exactly represented in JavaScript).
*
* **Details**
*
* JSON Schema:
*
* This check corresponds to `type: "integer"` with `minimum: Number.MIN_SAFE_INTEGER`
* and `maximum: Number.MAX_SAFE_INTEGER` in JSON Schema.
*
* Arbitrary:
*
* During arbitrary generation, this applies an integer constraint.
*
* @stability stable
* @category validation
* @since 4.0.0
*/
function isInt(annotations) {
	return makeFilter((n) => globalThis.Number.isSafeInteger(n), {
		expected: "an integer",
		representation: {
			id: "effect/schema/isInt",
			payload: null
		},
		toJsonSchema: () => ({
			type: "integer",
			minimum: globalThis.Number.MIN_SAFE_INTEGER,
			maximum: globalThis.Number.MAX_SAFE_INTEGER
		}),
		toCode: () => ({ runtime: "Schema.isInt()" }),
		arbitraryConstraint: { number: "integer" },
		...annotations
	});
}
/**
* Schema for integers, rejecting `NaN`, `Infinity`, and `-Infinity`.
*
* @stability stable
* @category schemas
* @since 3.10.0
*/
var Int = /*#__PURE__*/ Number$1.check(/*#__PURE__*/ isInt());
/**
* Validates that a value has at most the specified length. Works with strings
* and arrays.
*
* **Details**
*
* JSON Schema:
*
* The bound must be finite; it is rounded down and clamped to zero. This check
* corresponds to `maxItems` for arrays. Strings use the same bound for
* `maxLength`, which cannot reject a string accepted by this check because a
* string has no more code points than UTF-16 code units.
*
* Arbitrary:
*
* During arbitrary generation, this applies a `maxLength`
* constraint to ensure generated strings or arrays have at most the required
* length.
*
* @stability stable
* @category validation
* @since 4.0.0
*/
function isMaxLength(maxLength, annotations) {
	maxLength = normalizeCardinality(maxLength);
	return makeFilter((input) => input.length <= maxLength, {
		expected: `a value with a length of at most ${maxLength}`,
		representation: {
			id: "effect/schema/isMaxLength",
			payload: { maxLength }
		},
		toJsonSchema: ({ type }) => type === "string" ? maxLength === 0 ? { maxLength } : [{ maxLength }, true] : type === "array" ? { maxItems: maxLength } : type === void 0 ? [{
			maxLength,
			maxItems: maxLength
		}, true] : [{}, true],
		toCode: () => ({ runtime: `Schema.isMaxLength(${maxLength})` }),
		[STRUCTURAL_ANNOTATION_KEY]: true,
		arbitraryConstraint: { maxLength },
		...annotations
	});
}
function normalizeCardinality(value) {
	if (!globalThis.Number.isFinite(value)) throw new globalThis.RangeError(`Expected a finite number, got ${value}`);
	return Math.max(0, Math.floor(value));
}
globalThis.RegExp;
globalThis.URL;
var JsonString = /*#__PURE__*/ String$1.annotate({ expected: "a string that will be decoded as JSON" });
/**
* Returns a schema that decodes a JSON string and then decodes the parsed value
* using the given schema.
*
* **Details**
*
* This is useful when working with JSON-encoded strings where the actual
* structure of the value is known and described by an existing schema.
*
* During decoding, the resulting schema first parses the input string as JSON,
* using `reviver` when provided, and then runs the provided schema on the
* parsed result. During encoding, it first encodes with the provided schema and
* then passes the result to `JSON.stringify` with the optional `replacer` and
* `space`.
*
* **Example** (Formatting encoded JSON)
*
* ```ts import.meta.vitest
* import { Schema } from "effect"
*
* const schema = Schema.Struct({ a: Schema.Number })
* const schemaFromJsonString = Schema.fromJsonString(schema, { space: 2 })
*
* Schema.encodeSync(schemaFromJsonString)({ a: 1 }) // => "{\n  \"a\": 1\n}"
* ```
*
* @stability stable
* @category schemas
* @since 4.0.0
*/
function fromJsonString(schema, options) {
	return JsonString.pipe(decodeTo(schema, fromJsonString$1(options)));
}
globalThis.File;
globalThis.URLSearchParams;
var Base64String = /*#__PURE__*/ String$1.annotate({
	expected: "a base64 encoded string that will be decoded as Uint8Array",
	format: "byte",
	contentEncoding: "base64"
});
/**
* Schema for JavaScript `Uint8Array` objects.
*
* **Details**
*
* Default JSON serializer:
*
* The default JSON serializer encodes Uint8Array as a Base64 encoded string.
*
* @stability stable
* @category schemas
* @since 4.0.0
*/
var Uint8Array$1 = /*#__PURE__*/ instanceOf(globalThis.Uint8Array, {
	representation: {
		id: "effect/schema/Uint8Array",
		payload: null
	},
	toCode: () => ({
		runtime: `Schema.Uint8Array`,
		Type: `globalThis.Uint8Array`
	}),
	expected: "Uint8Array",
	toCodecJson: () => link()(Base64String, uint8ArrayFromBase64String)
});
var immerable = /*#__PURE__*/ globalThis.Symbol.for("immer-draftable");
var payloadToken = {};
function makeClass(Inherited, identifier, struct$1, annotations, proto) {
	const getClassSchema = getClassSchemaFactory(struct$1, identifier, annotations);
	const ClassTypeId = getClassTypeId(identifier);
	const out = class extends Inherited {
		constructor(...[input, options]) {
			const payload = options?.["~payload"];
			const value = payload?.token === payloadToken ? payload.value : struct$1.make(input ?? {}, options);
			super(value, {
				...options,
				disableChecks: true,
				"~payload": {
					token: payloadToken,
					value
				}
			});
		}
		static [TypeId$7] = TypeId$7;
		get [ClassTypeId]() {
			return ClassTypeId;
		}
		static [immerable] = true;
		static identifier = identifier;
		static fields = struct$1.fields;
		static get ast() {
			return getClassSchema(this).ast;
		}
		static pipe() {
			return pipeArguments(this, arguments);
		}
		static rebuild(ast) {
			return getClassSchema(this).rebuild(ast);
		}
		static make(input, options) {
			return makeClassSync(toType$1(getClassSchema(this).ast), input ?? {}, options, (fields) => makeClassTrusted(this, fields));
		}
		static makeOption(input, options) {
			return makeOption(getClassSchema(this))(input ?? {}, options);
		}
		static makeEffect(input, options) {
			return getClassSchema(this).makeEffect(input ?? {}, options);
		}
		static annotate(annotations) {
			return this.rebuild(annotate(this.ast, annotations));
		}
		static annotateKey(annotations) {
			return this.rebuild(annotateKey(this.ast, annotations));
		}
		static check(...checks) {
			return this.rebuild(appendChecks(this.ast, checks));
		}
		static extend(identifier) {
			return (schema, annotations) => {
				const extension = isStruct(schema) ? schema : Struct(schema);
				const fields = {
					...struct$1.fields,
					...extension.fields
				};
				const ast = struct(fields, struct$1.ast.checks, { identifier });
				return makeClass(this, identifier, makeStruct(appendChecks(ast, extension.ast.checks), fields), annotations, proto);
			};
		}
		static mapFields(f, options) {
			return struct$1.mapFields(f, options);
		}
	};
	if (proto !== void 0) Object.assign(out.prototype, proto(identifier));
	return out;
}
/**
* Constructs a class instance from fields that were already validated against
* the class struct, without running the constructor's schema pass.
*
* @internal
*/
function makeClassTrusted(self, fields) {
	return new self(fields, { "~payload": {
		token: payloadToken,
		value: fields
	} });
}
function getClassTransformation(self) {
	return new Transformation(transform$1((input) => makeClassTrusted(self, input)), passthrough$1());
}
function getClassTypeId(identifier) {
	return `~effect/Schema/Class/${identifier}`;
}
function getClassSchemaFactory(from, identifier, annotations) {
	let memo;
	return (self) => {
		if (memo !== void 0) return memo;
		const ClassTypeId = getClassTypeId(identifier);
		const isClassValue = (input) => input instanceof self || hasProperty(input, ClassTypeId);
		const transformation = getClassTransformation(self);
		return memo = decodeTo(make$3(new Declaration([from.ast], () => (input, ast, options) => {
			return isClassValue(input) ? succeed$1(input) : fail$1(new InvalidType(ast, input, options));
		}, {
			identifier,
			[CONSTRUCTOR_ANNOTATION_KEY]: ([from]) => ({
				isConstructed: isClassValue,
				link: new Link(from, transformation)
			}),
			toCodec: ([from]) => new Link(from.ast, transformation),
			toEquivalence: ([from]) => from,
			toFormatter: ([from]) => (t) => `${self.identifier}(${from(t)})`,
			[SENTINELS_ANNOTATION_KEY]: collectSentinels(from.ast),
			...annotations
		})), transformation)(from);
	};
}
function isStruct(schema) {
	return isSchema(schema);
}
/**
* Creates a schema-backed error class that can be used as a typed,
* yieldable error in Effect programs. Combines {@link Class} validation with
* the `YieldableError` interface so instances can be yielded directly inside
* `Effect.gen`.
*
* **Example** (Schema-backed error)
*
* ```ts import.meta.vitest
* import { Effect, Schema } from "effect"
*
* class NotFound extends Schema.Error<NotFound>("NotFound")({
*   id: Schema.Number
* }) {}
*
* const program = Effect.gen(function*() {
*   yield* new NotFound({ id: 1 })
* })
* const error = await Effect.runPromise(Effect.flip(program))
* error.id // => 1
* ```
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var Error$1 = (identifier) => (schema, annotations) => {
	return makeClass(Error$3, identifier, isStruct(schema) ? schema : Struct(schema), annotations, (identifier) => ({ name: identifier }));
};
/**
* Defines a schema-backed yieldable error class with an automatically populated
* `_tag` field.
*
* **When to use**
*
* Use to define typed errors that are schema validated, yielded in `Effect.gen`,
* and matched as tagged union members.
*
* **Example** (Defining a tagged error class)
*
* ```ts import.meta.vitest
* import { Effect, Schema } from "effect"
*
* class NotFound extends Schema.TaggedError<NotFound>()("NotFound", {
*   id: Schema.Number
* }) {}
*
* const program = Effect.gen(function*() {
*   yield* new NotFound({ id: 42 })
* })
* const error = await Effect.runPromise(Effect.flip(program))
* error._tag // => "NotFound"
* error.id // => 42
* ```
*
* @stability stable
* @category constructors
* @since 3.10.0
*/
var TaggedError = (identifier) => {
	return (tagValue, schema, annotations) => {
		const struct = isStruct(schema) ? schema.mapFields((fields) => ({
			_tag: tag$2(tagValue),
			...fields
		}), { unsafePreserveChecks: true }) : TaggedStruct(tagValue, schema);
		return Error$1(identifier ?? tagValue)(struct, annotations);
	};
};
/**
* Returns a JSON Schema document using draft 2020-12.
*
* **When to use**
*
* Use when you need a draft-2020-12 description of the canonical JSON form of a runtime schema.
*
* **Details**
*
* The document describes the encoded side of `Schema.toCodecJson(schema)`.
* Use that codec to decode JSON inputs. For example, it decodes JSON `null`
* to JavaScript `undefined` for a field defined with `Schema.optional(Schema.String)`.
* Decoding the same input with the original schema rejects `null`.
*
* The `options` parameter controls reference extraction and generation details
* such as excess properties and synthesized check descriptions; it does not
* change the draft target. The reference policy receives canonical JSON
* encoded ASTs. By default, anonymous non-recursive candidates remain inline,
* while candidates with resolved identifiers become definitions. Declarations
* are lowered through their `toCodecJson` or `toCodec` annotation when
* available before the representation document is compiled.
*
* The generated document is intended for preliminary validation. JSON Schema
* and Effect checks do not always have identical semantics, so the Effect
* decoder remains the final authority. Passing JSON Schema validation does not
* guarantee that Effect decoding will succeed.
*
* **Gotchas**
*
* JSON Schema generation is best-effort. String length uses Unicode code points
* in JSON Schema and UTF-16 code units in Effect. A generated `pattern` cannot
* retain JavaScript RegExp flags. Object property checks apply to the original
* input in JSON Schema but to the decoded object in Effect. When a `oneOf`
* branch contains a known approximation, the compiler emits `anyOf` so that
* the approximation cannot create a false rejection. Unions with only exact
* branches retain `oneOf`. Custom `toJsonSchema` callbacks return `[schema, true]` for safe,
* looser approximations and are responsible for the semantics they declare. When
* canonical JSON derivation adds an artificial transformation, checks and
* annotations on its source node are not copied to the JSON target, so they do
* not appear in the emitted document. Opaque declarations without a structural
* codec are represented by an unconstrained JSON Schema. The default
* `onExcessProperty: "ignore"` matches the decoder default and leaves
* index-signature keys without exact selectors open. In `"error"` mode, the compiler
* constrains those keys with `propertyNames` and applies a permissive choice of
* candidate index value schemas. The Effect decoder enforces the exact
* key-value association.
*
* **Example** (Decoding JSON with the matching codec)
*
* ```ts import.meta.vitest
* import { Schema } from "effect"
*
* const schema = Schema.Struct({
*   name: Schema.optional(Schema.String)
* })
*
* const document = Schema.toJsonSchemaDocument(schema)
* const jsonCodec = Schema.toCodecJson(schema)
*
* Schema.decodeUnknownResult(schema)({ name: null })._tag // => "Failure"
* Schema.decodeUnknownSync(jsonCodec)({ name: null }) // => { name: undefined }
* Schema.decodeUnknownSync(jsonCodec)({}) // => {}
* Schema.encodeSync(jsonCodec)({ name: undefined }) // => { name: null }
* ```
*
* @see {@link toCodecJson} for decoding and encoding the canonical JSON representation
* @see {@link SchemaRepresentation.toJsonSchemaDocument} for compiling an existing live representation document
*
* @stability stable
* @category converting
* @since 4.0.0
*/
function toJsonSchemaDocument(schema, options) {
	return toJsonSchemaDocument$1(toRepresentation(toCodecJsonAST(schema.ast), options), options);
}
/**
* Derives a canonical JSON codec from a schema. The encoded form is `Json`, and
* decoding produces the schema's `Type`.
*
* **Details**
*
* Derivation does not run transformations. Annotation links may be asynchronous,
* may fail, and may use optional services; the consuming parser chooses the
* execution and failure handling. Because hooks do not widen the returned
* service types, links cannot require services not declared by the input schema.
*
* **Gotchas**
*
* Declarations without a `toCodecJson` or `toCodec` annotation use `Json` as
* their encoded schema. This keeps codec construction total, but encoding or
* decoding can still fail when declaration values are not JSON values. A
* `toCodecJson` callback can return `undefined` when the declaration is already
* in canonical JSON form. When derivation adds an artificial transformation,
* checks and annotations remain on its source node rather than being copied to
* the JSON target. Source checks still run after the transformation.
*
* @stability stable
* @category converting
* @since 4.0.0
*/
var toCodecJson = toCodecJson$1;
/**
* Converts a schema to the StringTree canonical codec, where every leaf value
* becomes a string while preserving the original structure.
*
* **Details**
*
* Derivation does not run transformations. Annotation links may be asynchronous,
* may fail, and may use optional services; the consuming parser chooses the
* execution and failure handling. Links cannot require services not declared by
* the input schema because hooks do not widen the returned service types.
*
* **Gotchas**
*
* Declarations must provide a structural `toCodecStringTree`, `toCodecJson`, or
* `toCodec` encoding. A callback can return `undefined` when the declaration is
* already in canonical StringTree form.
*
* @stability stable
* @category converting
* @since 4.0.0
*/
var toCodecStringTree = toCodecStringTree$1;
/**
* Schema that accepts and validates any immutable JSON-compatible value.
*
* **Example** (Validating a JSON value)
*
* ```ts import.meta.vitest
* import { Option, Schema } from "effect"
*
* Schema.decodeUnknownOption(Schema.Json)({ key: [1, true, null] }) // => Option.some({ key: [1, true, null] })
* ```
*
* @stability stable
* @category schemas
* @since 4.0.0
*/
var Json = /*#__PURE__*/ make$3(/*#__PURE__*/ annotate(Json$1, { toCode: () => ({
	runtime: "Schema.Json",
	Type: "Schema.Json"
}) }));
// ../../packages/worker-api/src/ids.ts
var SessionId = String$1.check(isUUID()).pipe(brand("SessionId"));
/** The parent harness's own session id. */
var ParentSessionId = String$1.pipe(brand("ParentSessionId"));
var QuestionId = String$1.pipe(brand("QuestionId"));
// ../../packages/worker-api/src/parent.ts
var Harnesses = {
	pi: "pi",
	claude: "claude"
};
var Parent = Struct({
	harness: Enum(Harnesses),
	sessionId: ParentSessionId
});
// ../../packages/worker-api/src/entries.ts
var Entry = Union([
	TaggedStruct("prompt", { text: String$1 }),
	TaggedStruct("text", { text: String$1 }),
	TaggedStruct("toolCall", {
		toolCallId: String$1,
		name: String$1,
		arguments: Unknown
	}),
	TaggedStruct("toolResult", {
		toolCallId: String$1,
		output: String$1,
		isError: Boolean$1
	}),
	TaggedStruct("subagentResult", { text: String$1 })
]).pipe(toTaggedUnion("_tag"));
var Settings = Struct({
	provider: String$1,
	model: String$1,
	effort: String$1,
	image: String$1,
	size: String$1,
	lifetime: Int,
	repository: NullOr(Struct({
		url: String$1.check(isPattern(/^https?:\/\/[^/\s]+/, { message: "repository URL must start with https:// (or http://) and name a host" })),
		shallow: Boolean$1
	}))
});
// ../../packages/worker-api/src/session-state.ts
var SessionStatuses = {
	running: "running",
	waiting: "waiting",
	idle: "idle",
	failed: "failed",
	closed: "closed"
};
var SessionStatus = Enum(SessionStatuses);
var Question = Struct({
	id: QuestionId,
	text: String$1
});
var SessionDetails = Struct({
	settings: Settings,
	skills: ArraySchema(String$1),
	agents: ArraySchema(String$1)
});
var SessionState = Union([
	TaggedStruct(SessionStatuses.running, SessionDetails.fields),
	TaggedStruct(SessionStatuses.waiting, {
		...SessionDetails.fields,
		question: Question
	}),
	TaggedStruct(SessionStatuses.idle, {
		...SessionDetails.fields,
		lastEntry: optionalKey(Entry)
	}),
	TaggedStruct(SessionStatuses.failed, {
		...SessionDetails.fields,
		failure: String$1
	}),
	TaggedStruct(SessionStatuses.closed, SessionDetails.fields)
]).pipe(toTaggedUnion("_tag"));
/** The registry's status for a state. */
var statusOf = (state) => SessionState.match(state, {
	running: () => SessionStatuses.running,
	waiting: () => SessionStatuses.waiting,
	idle: () => SessionStatuses.idle,
	failed: () => SessionStatuses.failed,
	closed: () => SessionStatuses.closed
});
/** A session is active while it runs or waits on a question. */
var activeStatuses = [SessionStatuses.running, SessionStatuses.waiting];
SessionState.isAnyOf(activeStatuses);
var SessionRef = Struct({
	sessionId: SessionId,
	name: String$1,
	status: SessionStatus
});
var SessionListing = Struct({
	...SessionRef.fields,
	...SessionDetails.fields
});
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/internal/matcher.js
/** @internal */
var TypeId$6 = "~effect/Match/Matcher";
var TypeMatcherProto = {
	[TypeId$6]: {
		_input: identity,
		_filters: identity,
		_remaining: identity,
		_result: identity,
		_return: identity,
		_args: identity
	},
	_tag: "TypeMatcher",
	add(_case) {
		return makeTypeMatcher(this.select, [...this.cases, _case]);
	},
	pipe() {
		return pipeArguments(this, arguments);
	}
};
function makeTypeMatcher(select, cases) {
	const matcher = Object.create(TypeMatcherProto);
	matcher.select = select;
	matcher.cases = cases;
	return matcher;
}
var ValueMatcherProto = {
	[TypeId$6]: {
		_input: identity,
		_filters: identity,
		_result: identity,
		_return: identity,
		_flavor: identity
	},
	_tag: "ValueMatcher",
	add(_case) {
		if (isSuccess$1(this.value)) return this;
		if (_case._tag === "When" && _case.guard(this.provided) === true) return makeValueMatcher(this.provided, succeed$4(_case.evaluate(this.provided)));
		else if (_case._tag === "Not" && _case.guard(this.provided) === false) return makeValueMatcher(this.provided, succeed$4(_case.evaluate(this.provided)));
		return this;
	},
	pipe() {
		return pipeArguments(this, arguments);
	}
};
function makeValueMatcher(provided, value) {
	const matcher = Object.create(ValueMatcherProto);
	matcher.provided = provided;
	matcher.value = value;
	return matcher;
}
var makeWhen = (guard, evaluate) => ({
	_tag: "When",
	guard,
	evaluate
});
/** @internal */
var type$1 = () => makeTypeMatcher(identity, []);
/** @internal */
var value$1 = (i) => makeValueMatcher(i, fail$4(i));
/** @internal */
var discriminator = (field) => (...pattern) => {
	const f = pattern[pattern.length - 1];
	const values = pattern.slice(0, -1);
	const pred = values.length === 1 ? (_) => _ != null && _[field] === values[0] : (_) => _ != null && values.includes(_[field]);
	return (self) => self.add(makeWhen(pred, f));
};
/** @internal */
var discriminators = (field) => (fields) => {
	const predicate = makeWhen((arg) => arg != null && Object.hasOwn(fields, arg[field]) && fields[arg[field]] !== void 0, (data) => fields[data[field]](data));
	return (self) => self.add(predicate);
};
/** @internal */
var discriminatorsExhaustive = (field) => (fields) => {
	const addCases = discriminators(field)(fields);
	return (matcher) => exhaustive(addCases(matcher));
};
/** @internal */
var tag$1 = /*#__PURE__*/ discriminator("_tag");
/** @internal */
var tagsExhaustive$1 = /*#__PURE__*/ discriminatorsExhaustive("_tag");
/** @internal */
var orElse$1 = (f) => (self) => {
	const toResult = result(self);
	if (isResult(toResult)) return toResult._tag === "Success" ? toResult.success : f(toResult.failure);
	return (...args) => {
		const a = toResult(...args);
		return isSuccess$1(a) ? a.success : f(a.failure, ...args);
	};
};
/** @internal */
var result = (self) => {
	if (self._tag === "ValueMatcher") return self.value;
	const len = self.cases.length;
	if (len === 1) {
		const _case = self.cases[0];
		return (...args) => {
			const input = self.select(...args);
			if (_case._tag === "When" && _case.guard(input) === true) return succeed$4(_case.evaluate(input, ...args));
			else if (_case._tag === "Not" && _case.guard(input) === false) return succeed$4(_case.evaluate(input, ...args));
			return fail$4(input);
		};
	}
	return (...args) => {
		const input = self.select(...args);
		for (let i = 0; i < len; i++) {
			const _case = self.cases[i];
			if (_case._tag === "When" && _case.guard(input) === true) return succeed$4(_case.evaluate(input, ...args));
			else if (_case._tag === "Not" && _case.guard(input) === false) return succeed$4(_case.evaluate(input, ...args));
		}
		return fail$4(input);
	};
};
var getExhaustiveAbsurdErrorMessage = "effect/match/Match/exhaustive: absurd";
/** @internal */
var exhaustive = (self) => {
	const toResult = result(self);
	if (isResult(toResult)) {
		if (isSuccess$1(toResult)) return toResult.success;
		throw new Error(getExhaustiveAbsurdErrorMessage);
	}
	return (...args) => {
		const result = toResult(...args);
		if (isSuccess$1(result)) return result.success;
		throw new Error(getExhaustiveAbsurdErrorMessage);
	};
};
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/Match.js
/**
* Builds pattern matchers for TypeScript values.
*
* `Match` lets you add ordered cases and then finish them with a result,
* fallback, `Option`, or exhaustive check. Use `Match.type` to define a
* reusable matcher for a type, or `Match.value` to match one value immediately.
* Cases can match literal values, predicates, object shapes, tags, negated
* patterns, and common checks such as strings, numbers, records, and class
* instances.
*
* @stability stable
* @since 4.0.0
*/
/**
* Creates a matcher for a specific type.
*
* **When to use**
*
* Use to build a reusable matcher function for values of a known input type.
*
* **Details**
*
* This function defines a `Matcher` that operates on a given type, allowing you
* to specify conditions for handling different cases. Once the matcher is
* created, you can use pattern-matching functions like {@link when} to define
* how different values should be processed.
*
* **Example** (Matching Numbers and Strings)
*
* ```ts import.meta.vitest
* import { Match } from "effect"
*
* // Create a matcher for values that are either strings or numbers
* //
* //      ┌─── (u: string | number) => string
* //      ▼
* const match = Match.type<string | number>().pipe(
*   // Match when the value is a number
*   Match.when(Match.number, (n) => `number: ${n}`),
*   // Match when the value is a string
*   Match.when(Match.string, (s) => `string: ${s}`),
*   // Ensure all possible cases are handled
*   Match.exhaustive
* )
*
* match(0) // => "number: 0"
*
* match("hello") // => "string: hello"
* ```
*
* @see {@link value} for creating a matcher from a specific value.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var type = type$1;
/**
* Creates a matcher from a specific value.
*
* **When to use**
*
* Use to match one concrete input immediately.
*
* **Details**
*
* This function allows you to define a `Matcher` directly from a given value,
* rather than from a type. This is useful when working with known values,
* enabling structured pattern matching on objects, primitives, or any data
* structure.
*
* Once the matcher is created, you can use pattern-matching functions like
* {@link when} to define how different cases should be handled.
*
* **Example** (Matching an Object by Property)
*
* ```ts import.meta.vitest
* import { Match } from "effect"
*
* const input = { name: "John", age: 30 }
*
* // Create a matcher for the specific object
* const result = Match.value(input).pipe(
*   // Match when the 'name' property is "John"
*   Match.when(
*     { name: "John" },
*     (user) => `${user.name} is ${user.age} years old`
*   ),
*   // Provide a fallback if no match is found
*   Match.orElse(() => "Oh, not John")
* )
*
* result // => "John is 30 years old"
* ```
*
* @see {@link type} for creating a matcher from a specific type.
*
* @stability stable
* @category constructors
* @since 4.0.0
*/
var value = value$1;
/**
* Matches discriminated union members by their `_tag` field.
*
* **When to use**
*
* Use to handle one or more `_tag` cases with the same matcher branch.
*
* **Details**
*
* This helper follows the Effect convention that discriminated unions use
* `"_tag"` as their discriminator field. Use {@link discriminator} for a
* different discriminator field.
*
* **Example** (Matching a discriminated union by tag)
*
* ```ts import.meta.vitest
* import { Match } from "effect"
*
* type Event =
*   | { readonly _tag: "fetch" }
*   | { readonly _tag: "success"; readonly data: string }
*   | { readonly _tag: "error"; readonly error: Error }
*   | { readonly _tag: "cancel" }
*
* const match = Match.type<Event>().pipe(
*   // Match either "fetch" or "success"
*   Match.tag("fetch", "success", () => `Ok!`),
*   // Match "error" and extract the error message
*   Match.tag("error", (event) => `Error: ${event.error.message}`),
*   // Match "cancel"
*   Match.tag("cancel", () => "Cancelled"),
*   Match.exhaustive
* )
*
* match({ _tag: "success", data: "Hello" }) // => "Ok!"
*
* match({ _tag: "error", error: new Error("Oops!") }) // => "Error: Oops!"
* ```
*
* @stability stable
* @category defining patterns
* @since 4.0.0
*/
var tag = tag$1;
/**
* Matches values based on their `_tag` field and requires handling of all
* possible cases.
*
* **Details**
*
* This function is designed for **discriminated unions** where every possible
* `_tag` value must have a corresponding handler. Unlike {@link tags}, this
* function ensures **exhaustiveness**, meaning all cases must be explicitly
* handled. If a `_tag` value is missing from the mapping, TypeScript will
* report an error.
*
* **Example** (Handling all tag cases)
*
* ```ts import.meta.vitest
* import { Match, pipe } from "effect"
*
* const match = pipe(
*   Match.type<
*     { _tag: "A"; a: string } | { _tag: "B"; b: number } | {
*       _tag: "C"
*       c: boolean
*     }
*   >(),
*   Match.tagsExhaustive({
*     A: (a) => a.a,
*     B: (b) => b.b,
*     C: (c) => c.c
*   })
* )
* match({ _tag: "B", b: 42 }) // => 42
* ```
*
* @stability stable
* @category defining patterns
* @since 4.0.0
*/
var tagsExhaustive = tagsExhaustive$1;
/**
* Provides a fallback value when no patterns match.
*
* **When to use**
*
* Use to finalize a matcher with a fallback for unmatched input.
*
* **Details**
*
* This function ensures that a matcher always returns a valid result, even if
* no defined patterns match. It acts as a default case, similar to the
* `default` clause in a `switch` statement or the final `else` in an `if-else`
* chain.
*
* **Example** (Providing a default value when no patterns match)
*
* ```ts import.meta.vitest
* import { Match } from "effect"
*
* // Create a matcher for string or number values
* const match = Match.type<string | number>().pipe(
*   // Match when the value is "a"
*   Match.when("a", () => "ok"),
*   // Fallback when no patterns match
*   Match.orElse(() => "fallback")
* )
*
* match("a") // => "ok"
*
* match("b") // => "fallback"
* ```
*
* @see {@link option} for finalizing unmatched input as `Option.none`
* @see {@link result} for returning unmatched input as a `Result` failure
* @see {@link orElseAbsurd} for finalizing when unmatched input should be impossible
*
* @stability stable
* @category completion
* @since 4.0.0
*/
var orElse = orElse$1;
// ../../packages/worker-api/src/errors.ts
var SessionNotFound = class extends TaggedError()("SessionNotFound", { sessionId: SessionId }, { httpApiStatus: 404 }) {};
var QuestionNotWaiting = class extends TaggedError()("QuestionNotWaiting", { questionId: QuestionId }, { httpApiStatus: 409 }) {};
var Unauthorized = class extends TaggedError()("Unauthorized", {}, { httpApiStatus: 401 }) {};
var InvalidArchive = class extends TaggedError()("InvalidArchive", { message: String$1 }, { httpApiStatus: 400 }) {};
/** Every error the API returns; the helper's command result carries it. */
var TentaclesError = Union([
	SessionNotFound,
	QuestionNotWaiting,
	Unauthorized,
	InvalidArchive
]);
var WatchLineJson = fromJsonString(Union([Struct({
	sessionId: SessionId,
	state: SessionState
}), Struct({
	sessionId: SessionId,
	error: SessionNotFound
})]));
/** The endpoint's success, as JSON. */
var Success = TaggedStruct("Success", { result: Unknown });
var Failure = TaggedStruct("Failure", { error: TentaclesError });
/** A failure that is not the Worker's: it did not answer, it answered an unexpected status, or a variable is missing. */
var HelperError = TaggedStruct("HelperError", { message: String$1 });
var CommandResultJson = fromJsonString(Union([
	Success,
	Failure,
	HelperError
]));
// src/core/local-state.ts
/** What the glue stores per harness session: the parent's remote sessions, closed ones included. */
var LocalState = Struct({ sessions: ArraySchema(SessionRef) });
var LocalStateJson = fromJsonString(LocalState);
// src/core/status-line.ts
var isOpen = (session) => session.status !== SessionStatuses.closed;
/** The open sessions as `name: status`, or undefined when none is open so the glue clears the line. */
var renderStatusLine = (sessions) => {
	const open = sessions.filter(isOpen);
	if (open.length === 0) return;
	return open.map((session) => `${session.name}: ${session.status}`).join(" | ");
};
/** Splits a stream's chunks into complete lines; a chunk may end mid-line or hold several lines. */
var createLineSplitter = (onLine) => {
	let buffer = "";
	return (chunk) => {
		buffer += chunk;
		for (let newline = buffer.indexOf("\n"); newline >= 0; newline = buffer.indexOf("\n")) {
			const line = buffer.slice(0, newline);
			buffer = buffer.slice(newline + 1);
			if (line.trim() !== "") onLine(line);
		}
	};
};
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/http/HttpMethod.js
/**
* Defines supported HTTP method names for the unstable HTTP modules.
*
* Values are uppercase string literals such as `"GET"` and `"POST"`, matching
* the method tokens used by HTTP requests and routes. This module also includes
* helpers for checking whether a method can carry a request body and whether an
* unknown value is one of the supported methods.
*
* @stability unstable
* @since 4.0.0
*/
function hasBody(method) {
	return method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && method !== "TRACE";
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/socket/Socket.js
/**
* Runtime type identifier attached to `Socket` services.
*
* @stability unstable
* @category type IDs
* @since 4.0.0
*/
var TypeId$5 = "~effect/socket/Socket";
/**
* Returns `true` when a value is a `Socket`.
*
* @stability unstable
* @category guards
* @since 4.0.0
*/
var isSocket = (u) => hasProperty(u, TypeId$5);
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/http/internal/requestState.js
/**
* Provided by request roots alongside `HttpServerRequest`. It has no default,
* so writes outside a request do not reach shared state.
*
* @internal
*/
var CurrentRequestState = /*#__PURE__*/ Service$1("effect/http/HttpEffect/CurrentRequestState");
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/http/HttpMiddleware.js
/**
* Runs an effect with HTTP response logging disabled for the current server request.
*
* @stability unstable
* @category logging
* @since 4.0.0
*/
var withLoggerDisabled = (self) => withFiber((fiber) => {
	const state = getOrUndefined(fiber.context, CurrentRequestState);
	if (state !== void 0) state.loggerDisabled = true;
	return self;
});
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/http/HttpRouter.js
/**
* Builds server-side routers for Effect HTTP applications.
*
* `HttpRouter` collects routes and middleware while an application layer is
* being built. Once the router is complete, it handles each
* `HttpServerRequest` by finding a matching route and producing an
* `HttpServerResponse`. The module also includes helpers for route definitions,
* prefixes, parameters, request decoding, CORS, and running the router.
*
* @stability unstable
* @since 4.0.0
*/
/**
* Service tag for the HTTP router used while constructing an HTTP application.
* Route and middleware layers require this service to register themselves with
* the router.
*
* @stability unstable
* @category services
* @since 4.0.0
*/
var HttpRouter = /*#__PURE__*/ Service$1("effect/http/HttpRouter");
var removeTrailingSlash = (path) => path.endsWith("/") ? path.slice(0, -1) : path;
/**
* Adds a path prefix to a route path.
*
* **Details**
*
* Trailing slashes are removed from the prefix; `/` becomes the prefix itself and
* `*` becomes a wildcard route under the prefix.
*
* @stability unstable
* @category transforming
* @since 4.0.0
*/
var prefixPath = /*#__PURE__*/ dual(2, (self, prefix) => {
	prefix = removeTrailingSlash(prefix);
	if (self === "*") return `${prefix}/*`;
	else if (self === "/") return prefix;
	return prefix + self;
});
var MiddlewareTypeId = "~effect/http/HttpRouter/Middleware";
/**
* Create a middleware layer that can be used to modify requests and responses.
*
* **Details**
*
* By default, the middleware only affects the routes that it is provided to.
*
* If you want to create a middleware that applies globally to all routes, pass
* the `global` option as `true`.
*
* **Example** (Applying route and global middleware)
*
* ```ts import.meta.vitest
* import { Effect, Layer } from "effect"
* import { HttpRouter, HttpServerResponse } from "effect/http"
*
* const RouteMiddleware = HttpRouter.middleware((httpEffect) =>
*   Effect.map(httpEffect, HttpServerResponse.setHeader("x-route", "route"))
* ).layer
*
* const GlobalMiddleware = HttpRouter.middleware(
*   (httpEffect) => Effect.map(httpEffect, HttpServerResponse.setHeader("x-global", "global")),
*   { global: true }
* )
*
* const Routes = HttpRouter.add("GET", "/hello", HttpServerResponse.text("Hello")).pipe(
*   Layer.provide(RouteMiddleware)
* )
* const App = Layer.mergeAll(Routes, GlobalMiddleware)
*
* const program = Effect.acquireUseRelease(
*   Effect.sync(() => HttpRouter.toWebHandler(App, { disableLogger: true })),
*   ({ handler }) =>
*     Effect.gen(function*() {
*       const response = yield* Effect.promise(() => handler(new Request("http://localhost/hello")))
*       return [response.headers.get("x-route"), response.headers.get("x-global")]
*     }),
*   ({ dispose }) => Effect.promise(dispose)
* )
*
* await Effect.runPromise(program) // => ["route", "global"]
* ```
*
* @stability unstable
* @category middleware
* @since 4.0.0
*/
var middleware = function() {
	if (arguments.length === 0) return makeMiddleware;
	return makeMiddleware(arguments[0], arguments[1]);
};
var makeMiddleware = (middleware, options) => options?.global ? effectDiscard(gen(function* () {
	const router = yield* HttpRouter;
	const fn = isEffect(middleware) ? yield* middleware : middleware;
	yield* router.addGlobalMiddleware(fn);
})) : new MiddlewareImpl(isEffect(middleware) ? effectContext(map$1(middleware, (fn) => makeUnsafe$4(/* @__PURE__ */ new Map([[fnContextKey, fn]])))) : succeedContext(makeUnsafe$4(/* @__PURE__ */ new Map([[fnContextKey, middleware]]))));
var middlewareId = 0;
var fnContextKey = "effect/http/HttpRouter/MiddlewareFn";
var MiddlewareImpl = class MiddlewareImpl {
	[MiddlewareTypeId] = {};
	layerFn;
	dependencies;
	constructor(layerFn, dependencies) {
		this.layerFn = layerFn;
		this.dependencies = dependencies;
		const contextKey = `effect/http/HttpRouter/Middleware-${++middlewareId}`;
		this.layer = effectContext(gen({ self: this }, function* () {
			const context$2 = yield* context();
			const stack = [getOrUndefinedUnsafe(context$2, fnContextKey)];
			if (this.dependencies) {
				const memoMap = yield* CurrentMemoMap;
				const scope = get$1(context$2, Scope);
				const depsContext = yield* buildWithMemoMap(this.dependencies, memoMap, scope);
				stack.push(...getMiddleware(depsContext));
			}
			return makeUnsafe$4(/* @__PURE__ */ new Map([[contextKey, stack]]));
		})).pipe(provide(this.layerFn));
	}
	layer;
	combine(other) {
		return new MiddlewareImpl(this.layerFn, this.dependencies ? provideMerge(this.dependencies, other.layer) : other.layer);
	}
};
var middlewareCache = /*#__PURE__*/ new WeakMap();
var getMiddleware = (context) => {
	let arr = middlewareCache.get(context);
	if (arr) return arr;
	const topLevel = empty$1();
	let maxLength = 0;
	for (const [key, value] of context.mapUnsafe) if (key.startsWith("effect/http/HttpRouter/Middleware-")) {
		topLevel.push(value);
		if (value.length > maxLength) maxLength = value.length;
	}
	if (topLevel.length === 0) arr = [];
	else {
		const middleware = /* @__PURE__ */ new Set();
		for (let i = maxLength - 1; i >= 0; i--) for (const arr of topLevel) if (i < arr.length) middleware.add(arr[i]);
		arr = fromIterable$1(middleware).reverse();
	}
	middlewareCache.set(context, arr);
	return arr;
};
(/*#__PURE__*/ middleware(withLoggerDisabled)).layer;
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/http/HttpStatus.js
/**
* Named HTTP status codes for the unstable HTTP modules.
*
* This module centralizes the mapping from literal names of the known HTTP
* status codes, such as `"OK"` and `"Conflict"`, to their numeric codes. Use
* {@link fromLiteral} to obtain a status code from a literal name instead of
* remembering raw numbers.
*
* @stability unstable
* @since 4.0.0
*/
var codeByLiteral = {
	Continue: 100,
	SwitchingProtocols: 101,
	Processing: 102,
	EarlyHints: 103,
	OK: 200,
	Ok: 200,
	Created: 201,
	Accepted: 202,
	NonAuthoritativeInformation: 203,
	NoContent: 204,
	ResetContent: 205,
	PartialContent: 206,
	MultiStatus: 207,
	AlreadyReported: 208,
	ImUsed: 226,
	MultipleChoices: 300,
	MovedPermanently: 301,
	Found: 302,
	SeeOther: 303,
	NotModified: 304,
	TemporaryRedirect: 307,
	PermanentRedirect: 308,
	BadRequest: 400,
	Unauthorized: 401,
	PaymentRequired: 402,
	Forbidden: 403,
	NotFound: 404,
	MethodNotAllowed: 405,
	NotAcceptable: 406,
	ProxyAuthenticationRequired: 407,
	RequestTimeout: 408,
	Conflict: 409,
	Gone: 410,
	LengthRequired: 411,
	PreconditionFailed: 412,
	PayloadTooLarge: 413,
	UriTooLong: 414,
	UnsupportedMediaType: 415,
	RangeNotSatisfiable: 416,
	ExpectationFailed: 417,
	ImATeapot: 418,
	MisdirectedRequest: 421,
	UnprocessableEntity: 422,
	Locked: 423,
	FailedDependency: 424,
	TooEarly: 425,
	UpgradeRequired: 426,
	PreconditionRequired: 428,
	TooManyRequests: 429,
	RequestHeaderFieldsTooLarge: 431,
	UnavailableForLegalReasons: 451,
	InternalServerError: 500,
	NotImplemented: 501,
	BadGateway: 502,
	ServiceUnavailable: 503,
	GatewayTimeout: 504,
	HttpVersionNotSupported: 505,
	VariantAlsoNegotiates: 506,
	InsufficientStorage: 507,
	LoopDetected: 508,
	NotExtended: 510,
	NetworkAuthenticationRequired: 511
};
/**
* Returns the numeric HTTP status code for a literal name.
*
* **Example** (Obtaining status codes from literal names)
*
* ```ts import.meta.vitest
* import { HttpStatus } from "effect/http"
*
* HttpStatus.fromLiteral("OK") // => 200
* HttpStatus.fromLiteral("Conflict") // => 409
* ```
*
* @stability unstable
* @category constructors
* @since 4.0.0
*/
var fromLiteral = (literal) => codeByLiteral[literal];
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/http-api/internal/mediaType.js
/**
* @internal
*/
function normalize(contentType) {
	const normalized = contentType.toLowerCase().trim();
	const index = normalized.indexOf(";");
	return index === -1 ? normalized : normalized.slice(0, index).trim();
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/http-api/HttpApiSchema.js
var StreamSchemaTypeId = "~effect/http-api/HttpApiSchema/Stream";
/**
* @stability unstable
*/
function status(code) {
	const statusCode = typeof code === "string" ? fromLiteral(code) : code;
	return (self) => findHttpApiStatusAnnotation(self.ast) === void 0 ? self.annotateKey({ httpApiStatus: statusCode }) : self.annotate({ httpApiStatus: statusCode });
}
/**
* Creates a void schema with the given HTTP status code.
* This is used to represent empty responses with a specific status code.
*
* @see {@link NoContent} for the predefined 204 no content schema.
*
* @stability unstable
* @category constructors
* @since 4.0.0
*/
var Empty = (code) => Void.pipe(status(code));
/**
* Schema for empty HTTP responses with status code 204.
*
* @stability unstable
* @category schemas
* @since 4.0.0
*/
var NoContent = /*#__PURE__*/ Empty(204);
/**
* @internal
*/
var isStreamSchema = (u) => isSchema(u) && hasProperty(u, StreamSchemaTypeId);
/**
* @internal
*/
var isStreamSse = (u) => isStreamSchema(u) && u._tag === "StreamSse";
var UpgradeTypeId = "~effect/http-api/HttpApiSchema/Upgrade";
var upgradeSchema = /*#__PURE__*/ declare(isSocket).pipe(/*#__PURE__*/ status(101));
/**
* @internal
*/
var rebuildUpgrade = (protocol, headers) => make$3(upgradeSchema.ast, {
	[UpgradeTypeId]: UpgradeTypeId,
	protocol,
	headers
});
/**
* @internal
*/
var isUpgrade = (u) => isSchema(u) && hasProperty(u, UpgradeTypeId);
/**
* Runtime brand key used to mark `WithHeaders` response schemas.
*
* @stability unstable
* @category type IDs
* @since 4.0.0
*/
var WithHeadersTypeId = "~effect/http-api/HttpApiSchema/WithHeaders";
/**
* Returns `true` when a schema is a `WithHeaders` response schema.
*
* **Example** (Detecting a response headers schema)
*
* ```ts import.meta.vitest
* import { Schema } from "effect"
* import { HttpApiSchema } from "effect/http-api"
*
* const schema = HttpApiSchema.WithHeaders(Schema.String, {
*   "x-request-id": Schema.String
* })
*
* HttpApiSchema.isWithHeaders(schema) // => true
* HttpApiSchema.isWithHeaders(Schema.String) // => false
* ```
*
* @stability unstable
* @category predicates
* @since 4.0.0
*/
var isWithHeaders = (u) => isSchema(u) && hasProperty(u, "~effect/http-api/HttpApiSchema/WithHeaders");
/**
* @internal
*/
function rebuildWithHeaders(self, schema, headers) {
	return make$3(self.ast, {
		[WithHeadersTypeId]: WithHeadersTypeId,
		schema,
		headers
	});
}
function asNonMultipartEncoding(self, options) {
	return self.annotate({ "~httpApiEncoding": {
		_tag: options._tag,
		contentType: options.contentType ?? defaultContentType(options._tag)
	} });
}
function defaultContentType(_tag) {
	switch (_tag) {
		case "Multipart": return "multipart/form-data";
		case "Json": return "application/json";
		case "FormUrlEncoded": return "application/x-www-form-urlencoded";
		case "Uint8Array": return "application/octet-stream";
		case "Text": return "text/plain";
	}
}
/**
* Marks a schema as an `application/x-www-form-urlencoded` payload or response.
*
* **Details**
*
* The schema's encoded side must be a record of strings.
*
* **Gotchas**
*
* Fields are flat on the server. A field that encodes to a nested object is
* sent as bracket keys that the server does not read back; use an explicit
* codec such as `Schema.fromJsonString(...)` for structured values.
*
* @stability unstable
* @category encoding
* @since 4.0.0
*/
function asFormUrlEncoded(options) {
	return (self) => asNonMultipartEncoding(self, {
		_tag: "FormUrlEncoded",
		...options
	});
}
/**
* Returns `true` when a schema AST represents a no-content response.
*
* **Details**
*
* The check succeeds for direct `void` schemas and schemas whose encoded or
* transformation target is `void`.
*
* @stability unstable
* @category predicates
* @since 4.0.0
*/
var isNoContent = (ast) => {
	if (isVoid(ast)) return true;
	if (isVoid(toEncoded$1(ast))) return true;
	const target = ast.encoding?.[0].to;
	if (target === void 0) return false;
	return isVoid(target);
};
var resolveHttpApiEncoding = /*#__PURE__*/ resolveAt("~httpApiEncoding");
/**
* @internal
*/
var getWithHeadersAnnotation = /*#__PURE__*/ resolveAt("~httpApiWithHeaders");
function findHttpApiStatusAnnotation(ast) {
	if (ast.checks) for (let i = ast.checks.length - 1; i >= 0; i--) {
		const check = ast.checks[i];
		if (check.annotations && "httpApiStatus" in check.annotations) return check.annotations;
		if (check._tag === "FilterGroup") {
			const annotations = findHttpApiStatusAnnotation(check);
			if (annotations !== void 0) return annotations;
		}
	}
	const annotations = ast.annotations;
	return annotations && "httpApiStatus" in annotations ? annotations : void 0;
}
function resolveHttpApiStatus(ast) {
	const annotations = findHttpApiStatusAnnotation(ast);
	if (annotations !== void 0) return annotations.httpApiStatus;
	return ast.context?.annotations?.httpApiStatus;
}
var defaultJsonEncoding = {
	_tag: "Json",
	contentType: "application/json"
};
var defaultUrlEncodedEncoding = {
	_tag: "FormUrlEncoded",
	contentType: "application/x-www-form-urlencoded"
};
function getEncoding(ast) {
	return resolveHttpApiEncoding(ast) ?? defaultJsonEncoding;
}
/**
* @internal
*/
function getPayloadEncoding(ast, method) {
	const encoding = resolveHttpApiEncoding(ast);
	if (encoding) return encoding;
	return hasBody(method) ? defaultJsonEncoding : defaultUrlEncodedEncoding;
}
/**
* @internal
*/
function getResponseEncoding(ast) {
	const out = getEncoding(ast);
	if (out._tag === "Multipart") throw new Error("Multipart is not supported in response");
	return out;
}
/**
* @internal
*/
function getStatusSuccess(self) {
	return resolveHttpApiStatus(self) ?? 200;
}
/**
* @internal
*/
function getStatusSuccessSchema(schema) {
	if (isWithHeaders(schema)) return resolveHttpApiStatus(schema.ast) ?? getStatusSuccess(schema.schema.ast);
	return getStatusSuccess(schema.ast);
}
/**
* @internal
*/
function getResponseEncodingSchema(schema) {
	if (isWithHeaders(schema) && resolveHttpApiEncoding(schema.ast) === void 0) return getResponseEncoding(schema.schema.ast);
	return getResponseEncoding(schema.ast);
}
/**
* @internal
*/
function getStatusError(self) {
	return resolveHttpApiStatus(self) ?? 500;
}
/**
* @internal
*/
function getStatusErrorSchema(schema) {
	if (isWithHeaders(schema)) return resolveHttpApiStatus(schema.ast) ?? getStatusError(schema.schema.ast);
	return getStatusError(schema.ast);
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/http-api/internal/toCodecHttpProperties.js
/** @internal */
function toCodecHttpProperties(schema) {
	const codec = toCodecStringTree(schema);
	return codec.rebuild(normalizeProperties(codec.ast));
}
var omitUndefined = /*#__PURE__*/ new Transformation(/*#__PURE__*/ passthrough$1(), /*#__PURE__*/ transformOptional(/*#__PURE__*/ filter(isNotUndefined)));
var present = /*#__PURE__*/ memoize((ast) => {
	if (ast._tag === "Undefined") return new Never(ast.annotations, void 0, void 0, ast.context);
	if (ast._tag === "Suspend") return ast.recur(present);
	if (ast._tag !== "Union") return ast;
	const members = mapOrSame(ast.types, present);
	if (members === ast.types) return ast;
	const types = members.filter((member) => member._tag !== "Never");
	if (types.length === 1 && ast.checks === void 0 && ast.annotations === void 0) return replaceContext(types[0], ast.context);
	return new Union$1(types, ast.options, ast.annotations, ast.checks, void 0, ast.context);
});
var normalizeProperties = /*#__PURE__*/ applyToSelfOrLastLinkEncodingIdempotent((ast) => {
	if (ast._tag === "Union" || ast._tag === "Suspend") return ast.recur(normalizeProperties);
	if (ast._tag !== "Objects") return ast;
	const properties = mapOrSame(ast.propertySignatures, (ps) => {
		const encoded = toEncoded$1(ps.type);
		if (!isOptional(encoded)) return ps;
		const wire = present(encoded);
		return wire === encoded ? ps : new PropertySignature(ps.name, decodeTo$1(wire, ps.type, omitUndefined));
	});
	return properties === ast.propertySignatures ? ast : new Objects(properties, ast.indexSignatures, ast.annotations, ast.checks, void 0, ast.context, ast.encodingChecks);
});
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/http-api/HttpApiEndpoint.js
/**
* Defines endpoint declarations used inside an HTTP API group.
*
* An endpoint records a stable identifier, HTTP method, router path, request schemas,
* response schemas, declared errors, middleware, and annotations. Endpoint
* values are declarations, not handlers: builders use them to decode requests,
* type handler input, encode responses, generate OpenAPI metadata, and derive
* generated-client call signatures. This module also includes HTTP method
* constructors, payload and response schema helpers, and type utilities used by
* builders and generated clients.
*
* **Request variants**
*
* A server needs a distinct method and path per endpoint.
* `HttpApiBuilder.layer` rejects two endpoints that share them, even when their
* query, headers or payload differ. Declare the variants of one operation as a
* single endpoint instead:
*
* - discriminate with a `query` or `headers` field, such as `stream: Schema.Boolean`
* - list several `payload` schemas, chosen by the request `Content-Type`
* - list several `success` schemas with distinct content types or statuses. One
*   of them can be a stream. The server encodes whichever value the handler
*   returns, and the client decodes by the response `Content-Type`
*
* The handler branches on the decoded request, and OpenAPI documents one
* operation with every alternative. The generated client returns the union of
* the success types. Wrap the client method to narrow the result per variant
* when callers need it.
*
* **Example** (Buffered and streaming variants of one operation)
*
* ```ts import.meta.vitest
* import { Effect, Schema, Stream } from "effect"
* import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
*
* const Stats = Schema.Struct({ cpu: Schema.Number })
*
* const Api = HttpApi.make("Docker").add(
*   HttpApiGroup.make("containers").add(
*     // GET /stats?stream=false returns JSON, ?stream=true returns NDJSON
*     HttpApiEndpoint.get("stats", "/stats", {
*       query: { stream: Schema.Boolean },
*       success: [Stats, HttpApiSchema.StreamNdjson({ schema: Stats })]
*     }),
*     // POST /images accepts a JSON pull request or a tar archive
*     HttpApiEndpoint.post("createImage", "/images", {
*       payload: [
*         Schema.Struct({ fromImage: Schema.String }),
*         HttpApiSchema.StreamUint8Array({ contentType: "application/x-tar" })
*       ],
*       success: Schema.String
*     })
*   )
* )
*
* const ContainersLive = HttpApiBuilder.group(Api, "containers", (handlers) =>
*   handlers
*     .handle("stats", ({ query }) =>
*       Effect.succeed(query.stream ? Stream.make({ cpu: 1 }, { cpu: 2 }) : { cpu: 1 })
*     )
*     .handle("createImage", ({ payload }) =>
*       Stream.isStream(payload)
*         ? Effect.as(Stream.runDrain(payload), "imported")
*         : Effect.succeed(`pulled ${payload.fromImage}`)
*     ))
* ```
*
* @stability unstable
* @since 4.0.0
*/
var TypeId$4 = "~effect/http-api/HttpApiEndpoint";
/**
* @internal
*/
function getSuccessSchemas(endpoint) {
	const schemas = Array.from(endpoint.success);
	return isArrayNonEmpty(schemas) ? schemas : [NoContent];
}
/**
* @internal
*/
function getErrorSchemas(endpoint) {
	const schemas = new Set(endpoint.error);
	const transform = endpoint.disableCodecs ? identity : transformResponseSchema;
	for (const middleware of endpoint.middlewares) {
		const key = middleware;
		for (const schema of key.error) schemas.add(transform(schema));
	}
	return Array.from(schemas);
}
var Proto$3 = {
	[TypeId$4]: TypeId$4,
	pipe() {
		return pipeArguments(this, arguments);
	},
	prefix(prefix) {
		return makeProto$2({
			...optionsFromEndpoint(this),
			path: prefixPath(this.path, prefix)
		});
	},
	middleware(middleware) {
		return makeProto$2({
			...optionsFromEndpoint(this),
			middlewares: /* @__PURE__ */ new Set([...this.middlewares, middleware])
		});
	},
	annotate(key, value) {
		return makeProto$2({
			...optionsFromEndpoint(this),
			annotations: add(this.annotations, key, value)
		});
	},
	annotateMerge(annotations) {
		return makeProto$2({
			...optionsFromEndpoint(this),
			annotations: merge(this.annotations, annotations)
		});
	}
};
var optionsFromEndpoint = (endpoint) => ({
	identifier: endpoint.identifier,
	path: endpoint.path,
	method: endpoint.method,
	params: endpoint.params,
	query: endpoint.query,
	headers: endpoint.headers,
	payload: endpoint.payload,
	success: endpoint.success,
	error: endpoint.error,
	annotations: endpoint.annotations,
	middlewares: endpoint.middlewares,
	disableCodecs: endpoint.disableCodecs
});
function makeProto$2(options) {
	function HttpApiEndpoint() {}
	Object.setPrototypeOf(HttpApiEndpoint, Proto$3);
	return Object.assign(HttpApiEndpoint, options);
}
/**
* Creates endpoint constructors for a specific HTTP method. The resulting
* constructor builds an `HttpApiEndpoint` from an identifier, path, and optional request
* and response schemas, applying automatic JSON or string-tree codecs unless
* `disableCodecs` is enabled.
*
* **Gotchas**
*
* URL parameters are flat on the server: each `query` field, each field of a
* no-body `payload` and each field of a form-urlencoded `payload` should encode
* to a string or an array of strings. A field that encodes to a nested object
* is sent as bracket keys (`meta[k]=v`) that the server does not read back, so
* it is dropped, or reported missing when required. Send structured values with
* an explicit codec such as `Schema.fromJsonString(...)`, or declare bracket
* keys literally, for example `"page[size]": Schema.String`.
*
* @stability unstable
* @category constructors
* @since 4.0.0
*/
var make$2 = (method) => (identifier, path, options) => {
	const disableCodecs = options?.disableCodecs ?? false;
	const transformProperties = disableCodecs ? identity : toCodecHttpProperties;
	const payload = getPayload(options?.payload, method, disableCodecs);
	return makeProto$2({
		identifier,
		path,
		method,
		params: ensureStruct(options?.params, transformProperties),
		query: ensureStruct(options?.query, transformProperties),
		headers: ensureStruct(options?.headers, transformProperties),
		payload,
		success: getSuccessResponse(options?.success, method, payload, disableCodecs),
		error: getErrorResponse(options?.error, disableCodecs),
		annotations: empty(),
		middlewares: /* @__PURE__ */ new Set(),
		disableCodecs
	});
};
function ensureStruct(params, transform) {
	if (params === void 0) return void 0;
	if (isSchema(params)) return transform(params);
	return transform(Struct(params));
}
function getPayload(payload, method, disableCodecs) {
	const result = /* @__PURE__ */ new Map();
	if (payload === void 0) return result;
	const schemas = Array.isArray(payload) ? payload : isSchema(payload) ? [payload] : [Struct(payload).pipe(asFormUrlEncoded())];
	const transform = disableCodecs ? identity : transformPayload;
	let hasStream = false;
	for (const schema of schemas) {
		if (isStreamSchema(schema)) {
			if (isStreamSse(schema)) throw new Error("StreamSse is response-only and cannot be used as a payload");
			if (!hasBody(method)) throw new Error(`${method} endpoints cannot declare a streaming payload`);
			if (hasStream) throw new Error("Multiple streaming payloads are not supported");
			hasStream = true;
			for (const declared of schema.contentTypes) {
				const contentType = normalize(declared);
				if (result.has(contentType)) throw new Error(`Cannot combine buffered and streaming payloads for content-type: ${declared}`);
				result.set(contentType, {
					encoding: {
						_tag: "Stream",
						contentType: declared
					},
					schemas: [schema]
				});
			}
			continue;
		}
		const encoding = getPayloadEncoding(schema.ast, method);
		const contentType = normalize(encoding.contentType);
		const existing = result.get(contentType);
		if (existing) {
			if (existing.encoding._tag === "Stream") throw new Error(`Cannot combine buffered and streaming payloads for content-type: ${encoding.contentType}`);
			if (existing.encoding._tag !== encoding._tag) throw new Error(`Multiple payload encodings for content-type: ${encoding.contentType}`);
			if (existing.encoding._tag === "Multipart") throw new Error(`Multiple multipart payloads for content-type: ${encoding.contentType}`);
			existing.schemas.push(transform(schema, method));
		} else result.set(contentType, {
			encoding,
			schemas: [transform(schema, method)]
		});
	}
	return result;
}
var reservedStreamFailureEvent = "effect/http-api/stream/failure";
function getSuccessResponse(success, method, payload, disableCodecs) {
	if (success === void 0) return /* @__PURE__ */ new Set();
	const schemas = ensure(success);
	validateSuccessResponse(schemas, method, payload);
	return new Set(disableCodecs ? schemas : schemas.map(transformResponseSchema));
}
var transformResponseSchema = /*#__PURE__*/ memoize((schema) => {
	if (isStreamSchema(schema)) return schema;
	if (isUpgrade(schema)) return schema.headers === void 0 ? schema : rebuildUpgrade(schema.protocol, toCodecHttpProperties(schema.headers));
	if (isWithHeaders(schema)) return rebuildWithHeaders(schema, isStreamSchema(schema.schema) ? schema.schema : applyResponseEncoding(schema.schema, getResponseEncodingSchema(schema)), toCodecHttpProperties(schema.headers));
	return transformResponse(schema);
});
function getErrorResponse(error, disableCodecs) {
	if (error === void 0) return /* @__PURE__ */ new Set();
	const schemas = ensure(error);
	for (const schema of schemas) {
		const body = isWithHeaders(schema) ? schema.schema : schema;
		if (isStreamSchema(body)) throw new Error("Streaming schemas are not supported in error responses");
		if (isUpgrade(body)) throw new Error("Upgrade schemas are not supported in error responses");
	}
	validateResponseExclusivity(schemas, getStatusErrorSchema);
	return new Set(disableCodecs ? schemas : schemas.map(transformResponseSchema));
}
function validateSuccessResponse(schemas, method, payload) {
	const upgrades = schemas.filter(isUpgrade);
	if (upgrades.length > 1) throw new Error("Cannot declare more than one upgrade");
	const hasUpgrade = upgrades.length === 1;
	if (hasUpgrade) {
		if (method === "HEAD") throw new Error("HEAD endpoints cannot declare an upgrade");
		for (const { encoding } of payload.values()) if (encoding._tag === "Stream" || encoding._tag === "Multipart" && encoding.mode === "stream") throw new Error("Upgrade endpoints cannot declare a streaming payload");
	}
	let hasStream = false;
	const statuses = /* @__PURE__ */ new Map();
	for (const schema of schemas) {
		if (isUpgrade(schema)) continue;
		const inner = isWithHeaders(schema) ? schema.schema : schema;
		const status = getStatusSuccessSchema(schema);
		if (hasUpgrade && status === 101) throw new Error("Cannot combine an upgrade with another success response for status: 101");
		if (isStreamSchema(inner)) {
			if (hasUpgrade) throw new Error("Cannot combine an upgrade with a streaming success response");
			validateStreamSuccess(inner, method);
			if (hasStream) throw new Error("Multiple streaming success responses are not supported");
			hasStream = true;
			const entry = getStatusEntry(statuses, status);
			if (entry.noContent) throw new Error(`Cannot combine no-content and streaming success responses for status: ${status}`);
			for (const declared of inner.contentTypes) if (entry.bufferedContentTypes.has(normalize(declared))) throw new Error(`Cannot combine buffered and streaming success responses for status ${status} and content-type: ${declared}`);
			statuses.set(status, {
				...entry,
				stream: inner
			});
		} else {
			const entry = getStatusEntry(statuses, status);
			const noContent = isNoContent(inner.ast);
			if (entry.stream !== void 0) {
				if (noContent) throw new Error(`Cannot combine no-content and streaming success responses for status: ${status}`);
				const encoding = getResponseEncodingSchema(schema);
				const contentType = normalize(encoding.contentType);
				if (entry.stream.contentTypes.some((declared) => normalize(declared) === contentType)) throw new Error(`Cannot combine buffered and streaming success responses for status ${status} and content-type: ${encoding.contentType}`);
			}
			if (!noContent) entry.bufferedContentTypes.add(normalize(getResponseEncodingSchema(schema).contentType));
			entry.noContent = entry.noContent || noContent;
		}
	}
	validateResponseExclusivity(schemas, getStatusSuccessSchema);
}
function getStatusEntry(statuses, status) {
	let entry = statuses.get(status);
	if (entry === void 0) {
		entry = {
			bufferedContentTypes: /* @__PURE__ */ new Set(),
			noContent: false
		};
		statuses.set(status, entry);
	}
	return entry;
}
function validateResponseExclusivity(schemas, getStatus) {
	const statuses = /* @__PURE__ */ new Map();
	for (const schema of schemas) {
		const status = getStatus(schema);
		const withHeadersAnnotation = getWithHeadersAnnotation(schema.ast);
		const body = isWithHeaders(schema) ? schema.schema : withHeadersAnnotation?.body ?? schema;
		const contentType = isNoContent(body.ast) ? "" : normalize(isStreamSchema(body) ? body.contentType : getResponseEncodingSchema(schema).contentType);
		let entry = statuses.get(status);
		if (entry === void 0) {
			entry = {
				headerContentType: void 0,
				plainContentTypes: /* @__PURE__ */ new Set()
			};
			statuses.set(status, entry);
		}
		const combineError = () => /* @__PURE__ */ new Error(`Cannot combine a response with headers with another response for status ${status} and content-type: ${contentType || "<no content>"}`);
		if (isWithHeaders(schema) || withHeadersAnnotation !== void 0) {
			if (entry.headerContentType !== void 0) throw new Error(`Cannot declare multiple responses with headers for status ${status}`);
			if (entry.plainContentTypes.has(contentType)) throw combineError();
			entry.headerContentType = contentType;
		} else {
			if (entry.headerContentType === contentType) throw combineError();
			entry.plainContentTypes.add(contentType);
		}
	}
}
function validateStreamSuccess(schema, method) {
	if (method === "HEAD") throw new Error("HEAD endpoints cannot declare streaming success responses");
	if (isStreamSse(schema) && hasReservedSseEventName(schema.events.ast)) throw new Error(`SSE event name is reserved: ${reservedStreamFailureEvent}`);
}
function hasReservedSseEventName(ast) {
	return hasReservedEventName(toEncoded$1(ast), /* @__PURE__ */ new Set());
}
function hasReservedEventName(ast, seen) {
	if (seen.has(ast)) return false;
	seen.add(ast);
	if (isUnion(ast)) return ast.types.some((type) => hasReservedEventName(type, seen));
	if (isSuspend(ast)) return hasReservedEventName(ast.thunk(), seen);
	if (!isObjects(ast)) return false;
	const event = ast.propertySignatures.find((ps) => ps.name === "event");
	return event !== void 0 && hasReservedEventLiteral(event.type, seen);
}
function hasReservedEventLiteral(ast, seen) {
	if (seen.has(ast)) return false;
	seen.add(ast);
	const encoded = toEncoded$1(ast);
	if (encoded !== ast) return hasReservedEventLiteral(encoded, seen);
	if (isLiteral(ast)) return ast.literal === reservedStreamFailureEvent;
	if (isUnion(ast)) return ast.types.some((type) => hasReservedEventLiteral(type, seen));
	if (isSuspend(ast)) return hasReservedEventLiteral(ast.thunk(), seen);
	return false;
}
function transformResponse(schema) {
	const encoding = getResponseEncoding(schema.ast);
	const withHeaders = getWithHeadersAnnotation(schema.ast);
	if (withHeaders === void 0) return applyResponseEncoding(schema, encoding);
	return schema.annotate({ "~httpApiWithHeaders": {
		...withHeaders,
		bodyCodec: applyResponseEncoding(withHeaders.body, encoding),
		headersCodec: toCodecHttpProperties(withHeaders.headers)
	} });
}
function applyResponseEncoding(schema, encoding) {
	switch (encoding._tag) {
		case "Json": return toCodecJson(schema);
		case "FormUrlEncoded": return toCodecStringTree(schema);
		case "Text":
		case "Uint8Array": return schema;
	}
}
function transformPayload(schema, method) {
	if (!hasBody(method)) return toCodecHttpProperties(schema);
	switch (getPayloadEncoding(schema.ast, method)._tag) {
		case "Json": return toCodecJson(schema);
		case "FormUrlEncoded": return toCodecStringTree(schema);
		case "Text":
		case "Uint8Array":
		case "Multipart": return schema;
	}
}
/**
* Creates a `GET` endpoint declaration.
*
* @stability unstable
* @category constructors
* @since 4.0.0
*/
var get = /*#__PURE__*/ make$2("GET");
/**
* Creates a `POST` endpoint declaration.
*
* @stability unstable
* @category constructors
* @since 4.0.0
*/
var post = /*#__PURE__*/ make$2("POST");
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/http-api/HttpApi.js
var TypeId$3 = "~effect/http-api/HttpApi";
var Proto$2 = {
	[TypeId$3]: TypeId$3,
	pipe() {
		return pipeArguments(this, arguments);
	},
	add(...toAdd) {
		const groups = { ...this.groups };
		for (const group of toAdd) assignProperty(groups, group.identifier, group);
		return makeProto$1({
			...optionsFromApi(this),
			groups
		});
	},
	addHttpApi(api) {
		const newGroups = { ...this.groups };
		for (const key of Object.keys(api.groups)) {
			const group = api.groups[key];
			assignProperty(newGroups, key, group.annotateMerge(merge(api.annotations, group.annotations)));
		}
		return makeProto$1({
			...optionsFromApi(this),
			groups: newGroups
		});
	},
	prefix(prefix) {
		return makeProto$1({
			...optionsFromApi(this),
			groups: map$5(this.groups, (group) => group.prefix(prefix))
		});
	},
	middleware(tag) {
		return makeProto$1({
			...optionsFromApi(this),
			groups: map$5(this.groups, (group) => group.middleware(tag))
		});
	},
	annotate(key, value) {
		return makeProto$1({
			...optionsFromApi(this),
			annotations: add(this.annotations, key, value)
		});
	},
	annotateMerge(annotations) {
		return makeProto$1({
			...optionsFromApi(this),
			annotations: merge(this.annotations, annotations)
		});
	}
};
var optionsFromApi = (api) => ({
	identifier: api.identifier,
	groups: api.groups,
	annotations: api.annotations
});
var makeProto$1 = (options) => {
	function HttpApi() {}
	Object.setPrototypeOf(HttpApi, Proto$2);
	return Object.assign(HttpApi, options);
};
/**
* Creates an empty `HttpApi` with the supplied identifier.
*
* **When to use**
*
* Use when you need to start defining an HTTP API, add groups with `add` or
* `addHttpApi`, provide endpoint implementations with `HttpApiBuilder.group`,
* and register the API with `HttpApiBuilder.layer`.
*
* @stability unstable
* @category constructors
* @since 4.0.0
*/
var make$1 = (identifier) => makeProto$1({
	identifier,
	groups: {},
	annotations: empty()
});
/**
* Describes the groups and endpoints in an `HttpApi`.
*
* **Details**
*
* The callbacks receive each group or endpoint with merged annotations, endpoint
* middleware, and response schemas grouped by HTTP status.
*
* @stability unstable
* @category reflection
* @since 4.0.0
*/
var reflect = (self, options) => {
	const groups = Object.values(self.groups);
	for (const group of groups) {
		const groupAnnotations = merge(self.annotations, group.annotations);
		options.onGroup({
			group,
			mergedAnnotations: groupAnnotations
		});
		const endpoints = Object.values(group.endpoints);
		for (const endpoint of endpoints) {
			if (options.predicate && !options.predicate({
				endpoint,
				group
			})) continue;
			options.onEndpoint({
				group,
				endpoint,
				middleware: endpoint.middlewares,
				mergedAnnotations: merge(groupAnnotations, endpoint.annotations),
				successes: extractResponseContent(getSuccessSchemas(endpoint), getStatusSuccessSchema),
				errors: extractResponseContent(getErrorSchemas(endpoint), getStatusErrorSchema)
			});
		}
	}
};
var extractResponseContent = (schemas, getStatus) => {
	const map = /* @__PURE__ */ new Map();
	schemas.forEach(add);
	return map;
	function add(schema) {
		const body = isWithHeaders(schema) ? schema.schema : schema;
		if (isStreamSchema(body) || isUpgrade(body)) return;
		const status = getStatus(schema);
		const schemas = map.get(status);
		if (schemas === void 0) map.set(status, [schema]);
		else schemas.push(schema);
	}
};
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/http-api/HttpApiMiddleware.js
var TypeId$2 = "~effect/http-api/HttpApiMiddleware";
var SecurityTypeId = "~effect/http-api/HttpApiMiddleware/Security";
/**
* Creates a `Context.Service` class for an HTTP API middleware implementation.
*
* **When to use**
*
* Use when you need an HTTP API middleware service whose configuration declares
* required services, provided services, typed error schemas, security schemes,
* client errors, or a matching client middleware requirement.
*
* @stability unstable
* @category constructors
* @since 4.0.0
*/
var Service = () => (id, options) => {
	const limit = getStackTraceLimit();
	let creationError;
	if (limit !== 0) {
		setStackTraceLimit(2);
		creationError = new globalThis.Error();
		setStackTraceLimit(limit);
	}
	class Service extends Service$1()(id) {}
	const self = Service;
	Object.defineProperty(Service, "stack", { get() {
		return creationError?.stack;
	} });
	self[TypeId$2] = TypeId$2;
	self.error = getError(options?.error);
	self.requiredForClient = options?.requiredForClient ?? false;
	if (options?.security !== void 0) {
		if (Object.keys(options.security).length === 0) throw new Error("HttpApiMiddleware.Service: security object must not be empty");
		self[SecurityTypeId] = SecurityTypeId;
		self.security = options.security;
	}
	return self;
};
function getError(error) {
	if (error === void 0) return /* @__PURE__ */ new Set();
	return new Set(Array.isArray(error) ? error : [error]);
}
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/http-api/HttpApiGroup.js
var TypeId$1 = "~effect/http-api/HttpApiGroup";
var Proto$1 = {
	[TypeId$1]: TypeId$1,
	add(...toAdd) {
		const endpoints = { ...this.endpoints };
		for (const endpoint of toAdd) assignProperty(endpoints, endpoint.identifier, endpoint);
		return makeProto({
			...optionsFromGroup(this),
			endpoints
		});
	},
	prefix(prefix) {
		return makeProto({
			...optionsFromGroup(this),
			endpoints: map$5(this.endpoints, (endpoint) => endpoint.prefix(prefix))
		});
	},
	middleware(middleware) {
		return makeProto({
			...optionsFromGroup(this),
			endpoints: map$5(this.endpoints, (endpoint) => endpoint.middleware(middleware))
		});
	},
	annotateMerge(annotations) {
		return makeProto({
			...optionsFromGroup(this),
			annotations: merge(this.annotations, annotations)
		});
	},
	annotate(annotation, value) {
		return makeProto({
			...optionsFromGroup(this),
			annotations: add(this.annotations, annotation, value)
		});
	},
	annotateEndpointsMerge(annotations) {
		return makeProto({
			...optionsFromGroup(this),
			endpoints: map$5(this.endpoints, (endpoint) => endpoint.annotateMerge(annotations))
		});
	},
	annotateEndpoints(annotation, value) {
		return makeProto({
			...optionsFromGroup(this),
			endpoints: map$5(this.endpoints, (endpoint) => endpoint.annotate(annotation, value))
		});
	},
	pipe() {
		return pipeArguments(this, arguments);
	}
};
var optionsFromGroup = (group) => ({
	identifier: group.identifier,
	topLevel: group.topLevel,
	endpoints: group.endpoints,
	annotations: group.annotations
});
var makeProto = (options) => {
	function HttpApiGroup() {}
	Object.setPrototypeOf(HttpApiGroup, Proto$1);
	HttpApiGroup.key = `effect/http-api/HttpApiGroup/${options.identifier}`;
	return Object.assign(HttpApiGroup, options);
};
/**
* Creates an empty `HttpApiGroup` with the supplied identifier.
*
* **Details**
*
* Add endpoints with `add`, provide implementations with `HttpApiBuilder.group`,
* and set `topLevel` when the generated client should expose endpoint methods
* directly instead of nesting them under the group identifier.
*
* @stability unstable
* @category constructors
* @since 4.0.0
*/
var make = (identifier, options) => makeProto({
	identifier,
	topLevel: options?.topLevel ?? false,
	endpoints: {},
	annotations: empty()
});
// ../../node_modules/.pnpm/effect@4.1.3/node_modules/effect/dist/http-api/HttpApiSecurity.js
/**
* Defines security scheme declarations for declarative HTTP APIs.
*
* Security schemes describe where credentials are read from and which credential
* type is passed to security middleware. They are consumed by
* `HttpApiMiddleware.Service`, `HttpApiBuilder`, generated clients, and OpenAPI
* generation, but they do not authenticate requests by themselves.
*
* @stability unstable
* @since 4.0.0
*/
var TypeId = "~effect/http-api/HttpApiSecurity";
var Proto = {
	[TypeId]: TypeId,
	pipe() {
		return pipeArguments(this, arguments);
	}
};
/**
* Creates a Http token security scheme.
*
* **When to use**
*
* Use to require `Authorization: scheme ...` credentials for an HTTP API group
* or endpoint.
*
* **Details**
*
* Use `HttpApiMiddleware.Service` with a `security` option to implement API
* middleware for this security scheme.
*
* @see {@link apiKey} for an API-key security scheme
* @see {@link basic} for an HTTP Basic security scheme
* @stability unstable
* @category constructors
* @since 4.0.0
*/
var http = (options) => Object.assign(Object.create(Proto), {
	_tag: "Http",
	scheme: options.scheme,
	schemeLength: options.scheme.length,
	annotations: empty()
});
/**
* Creates a Bearer token security scheme.
*
* **When to use**
*
* Use to require `Authorization: Bearer ...` credentials for an HTTP API group
* or endpoint.
*
* **Details**
*
* Use `HttpApiMiddleware.Service` with a `security` option to implement API
* middleware for this security scheme.
*
* @see {@link apiKey} for an API-key security scheme
* @see {@link basic} for an HTTP Basic security scheme
* @stability unstable
* @category constructors
* @since 4.0.0
*/
var bearer = /*#__PURE__*/ http({ scheme: "Bearer" });
// ../../packages/worker-api/src/archive-kinds.ts
/**
* The kinds of archive a create request carries. `expandsInto` is where the workspace container
* expands the kind's archive; a null one is read by the Worker only and never reaches the container.
*/
var archiveKinds = {
	skills: {
		heading: "Skills",
		expandsInto: "/skills"
	},
	agents: {
		heading: "Agents",
		expandsInto: null
	},
	context: {
		heading: "Context",
		expandsInto: "/context"
	}
};
keys(archiveKinds).flatMap((kind) => {
	const { expandsInto } = archiveKinds[kind];
	return expandsInto == null ? [] : [{
		kind,
		directory: expandsInto
	}];
});
// ../../packages/worker-api/src/middleware.ts
/** Every request carries the API key as a bearer token; a provider checks it against its secret. */
var ApiKey = class extends Service()("tentacles/ApiKey", {
	security: { bearer },
	error: Unauthorized
}) {};
var PromptMode = Enum({
	followUp: "followUp",
	steer: "steer"
});
var Archive = Uint8Array$1.check(isMaxLength(5242880));
var CreateSession = Struct({
	name: String$1,
	parent: Parent,
	settings: Settings,
	prompt: String$1,
	...map$5(archiveKinds, () => optionalKey(Archive))
});
var Prompt = Struct({
	text: String$1,
	mode: PromptMode
});
var Answer = Struct({
	questionId: QuestionId,
	text: String$1
});
var sessionParams = { sessionId: SessionId };
var MessageCount = Int.check(isGreaterThanOrEqualTo(1));
var SessionsGroup = class extends make("sessions").add(post("create", "/sessions", {
	payload: CreateSession,
	success: Struct({ sessionId: SessionId }),
	error: InvalidArchive
}), post("prompt", "/sessions/:sessionId/prompt", {
	params: sessionParams,
	payload: Prompt,
	success: NoContent,
	error: SessionNotFound
}), post("answer", "/sessions/:sessionId/answer", {
	params: sessionParams,
	payload: Answer,
	success: NoContent,
	error: [SessionNotFound, QuestionNotWaiting]
}), post("close", "/sessions/:sessionId/close", {
	params: sessionParams,
	success: NoContent,
	error: SessionNotFound
}), get("messages", "/sessions/:sessionId/messages", {
	params: sessionParams,
	query: { count: MessageCount.pipe(withDecodingDefaultKey(succeed$1(1))) },
	success: ArraySchema(Entry),
	error: SessionNotFound
}), get("status", "/sessions/:sessionId/status", {
	params: sessionParams,
	success: SessionState,
	error: SessionNotFound
}), get("list", "/sessions", {
	query: Parent.fields,
	success: ArraySchema(SessionListing)
}), get("socket", "/sessions/:sessionId/socket", {
	params: sessionParams,
	success: Empty(101),
	error: SessionNotFound
})).middleware(ApiKey) {};
// ../../packages/worker-api/src/api.ts
var TentaclesApi = class extends make$1("tentacles").add(SessionsGroup).prefix("/api") {};
// src/core/endpoint-arguments.ts
var argumentsOf$1 = (part) => {
	const decoded = toJsonSchemaDocument(toType(part));
	const wire = toJsonSchemaDocument(part);
	return {
		properties: decoded.schema.properties ?? {},
		required: wire.schema.required ?? [],
		definitions: {
			...decoded.definitions,
			...wire.definitions
		}
	};
};
/** One endpoint tool's arguments: its path params with its payload or query, as one JSON Schema object. */
var endpointArguments = (name) => {
	const parts = [];
	reflect(TentaclesApi, {
		predicate: ({ endpoint }) => endpoint.identifier === name,
		onGroup: () => void 0,
		onEndpoint: ({ endpoint }) => {
			const payloads = [...endpoint.payload.values()].flatMap((payload) => payload.schemas);
			parts.push(...[
				endpoint.params,
				endpoint.query,
				payloads[0]
			].filter((part) => part != null));
		}
	});
	const merged = parts.map(argumentsOf$1);
	return {
		type: "object",
		properties: Object.assign({}, ...merged.map((part) => part.properties)),
		required: merged.flatMap((part) => part.required),
		$defs: Object.assign({}, ...merged.map((part) => part.definitions))
	};
};
/** What the agent sends to spawn: the glue fills the parent. */
var SpawnArguments = CreateSession.mapFields((fields) => ({
	...omit(fields, [
		"skills",
		"agents",
		"context"
	]),
	settings: optionalKey(Settings.mapFields(map(optionalKey))),
	skills: optionalKey(ArraySchema(String$1).annotate({ description: "Paths of skill folders on this machine, each holding a SKILL.md." })),
	agents: optionalKey(ArraySchema(String$1).annotate({ description: "Paths of agent definition files on this machine." })),
	context: optionalKey(ArraySchema(String$1).annotate({ description: "Paths of files or folders on this machine; the remote agent finds them in /context, each under its own name." }))
})).mapFields(omit(["parent"]));
// src/core/tool-table.ts
var ToolNames = {
	spawn: "spawn",
	prompt: "prompt",
	messages: "messages",
	wait: "wait",
	list: "list",
	close: "close",
	answer: "answer"
};
var ToolEntry = taggedEnum();
var bothHarnesses = [Harnesses.pi, Harnesses.claude];
var spawnDocument = toJsonSchemaDocument(SpawnArguments);
/** The only list of tools: the helper's commands and both glues' registrations read it. */
var ToolTable = {
	spawn: ToolEntry.Endpoint({
		name: ToolNames.spawn,
		description: "Start a remote agent with a name, a first prompt and optional settings. The settings left out come from the plugin's defaults. Optionally takes the paths of skill folders and agent definition files, and the paths of context files or folders the remote agent finds in /context, which stay fixed for the session. Answers with the new session's id.",
		endpoint: "create",
		harnesses: bothHarnesses,
		arguments: {
			...spawnDocument.schema,
			$defs: spawnDocument.definitions
		}
	}),
	prompt: ToolEntry.Endpoint({
		name: ToolNames.prompt,
		description: "Send a remote agent a follow-up, which waits for its current run to end, or a steer, which reaches it at its next step. Prompting a closed session reopens it.",
		endpoint: "prompt",
		harnesses: bothHarnesses,
		arguments: endpointArguments("prompt")
	}),
	messages: ToolEntry.Endpoint({
		name: ToolNames.messages,
		description: "Read the last entries of a remote agent's conversation, the last one by default.",
		endpoint: "messages",
		harnesses: bothHarnesses,
		arguments: endpointArguments("messages")
	}),
	wait: ToolEntry.WatchOnly({
		name: ToolNames.wait,
		description: "Block until a remote agent asks a question, finishes or fails, and answer with what it needs from you.",
		harnesses: [Harnesses.pi]
	}),
	list: ToolEntry.Endpoint({
		name: ToolNames.list,
		description: "List the remote agents started from this session, closed ones included, with their status.",
		endpoint: "list",
		harnesses: bothHarnesses,
		arguments: {
			type: "object",
			properties: {}
		}
	}),
	close: ToolEntry.Endpoint({
		name: ToolNames.close,
		description: "Close a remote agent once you have its result. It stays in list, and a prompt reopens it.",
		endpoint: "close",
		harnesses: bothHarnesses,
		arguments: endpointArguments("close")
	}),
	answer: ToolEntry.Endpoint({
		name: ToolNames.answer,
		description: "Answer the question a remote agent waits on, passing the question's id.",
		endpoint: "answer",
		harnesses: bothHarnesses,
		arguments: endpointArguments("answer")
	})
};
var toolsFor = (harness) => Object.values(ToolTable).filter((tool) => tool.harnesses.includes(harness));
// src/core/wake-texts.ts
var agentOf = (session) => `Remote agent "${session.name}" (session ${session.sessionId})`;
var entryText = type().pipe(tagsExhaustive({
	prompt: (entry) => entry.text,
	text: (entry) => entry.text,
	toolCall: (entry) => `a call to ${entry.name}`,
	toolResult: (entry) => entry.output,
	subagentResult: (entry) => entry.text
}));
var questionWake = (session, question) => `${agentOf(session)} asks (question ${question.id}):\n${question.text}\n\nAnswer it with the answer tool, passing session ${session.sessionId} and question ${question.id}.`;
var finishWake = (session, lastEntry) => lastEntry == null ? `${agentOf(session)} finished. Read its last message with the messages tool.` : `${agentOf(session)} finished. Its last message:\n${entryText(lastEntry)}`;
var failureWake = (session, failure) => `${agentOf(session)} failed: ${failure}`;
// src/core/controller.ts
var SessionArguments = Struct({ sessionId: SessionId });
var SpawnResult = Struct({ sessionId: SessionId });
var NamedArguments = Struct({ name: String$1 });
var SessionRefs = ArraySchema(SessionRef);
var targetOf = (args) => map$7(decodeUnknownOption(SessionArguments)(args), (decoded) => decoded.sessionId);
var ignoreSuccess = () => void 0;
var passArguments = (args) => args;
var decodeCommandResult = decodeUnknownOption(CommandResultJson);
var decodeWatchLine = decodeUnknownOption(WatchLineJson);
var failureText = type().pipe(tagsExhaustive({
	SessionNotFound: (error) => `SessionNotFound: session ${error.sessionId} does not exist.`,
	QuestionNotWaiting: (error) => `QuestionNotWaiting: question ${error.questionId} is no longer waiting.`,
	Unauthorized: () => "Unauthorized: the Worker refused the API key in TENTACLES_API_KEY.",
	InvalidArchive: (error) => error.message
}));
var wakeKeyOf = (state) => value(state).pipe(tag(SessionStatuses.waiting, (waiting) => `${SessionStatuses.waiting}:${waiting.question.id}`), orElse(statusOf));
/** Holds the local-state transitions, which states wake the parent and when the watch restarts; both glues run it. */
var createController = (glue, harness) => {
	let parent;
	let isInteractive = false;
	let sessions = [];
	let watchProcess;
	let waiters = [];
	const wakeKeys = /* @__PURE__ */ new Map();
	const unwaited = /* @__PURE__ */ new Map();
	const save = (next) => {
		sessions = next;
		glue.status(renderStatusLine(sessions));
		glue.writeState(LocalState.make({ sessions })).catch(() => void 0);
	};
	const setStatus = (sessionId, status) => {
		if (sessions.some((session) => session.sessionId === sessionId && session.status === status)) return;
		save(sessions.map((session) => session.sessionId === sessionId ? {
			...session,
			status
		} : session));
	};
	const drop = (sessionId) => {
		wakeKeys.delete(sessionId);
		unwaited.delete(sessionId);
		save(sessions.filter((session) => session.sessionId !== sessionId));
	};
	const deliver = (sessionId, text) => {
		if (waiters.length === 0) {
			unwaited.delete(sessionId);
			unwaited.set(sessionId, text);
			glue.wake(text);
			return;
		}
		const woken = waiters;
		waiters = [];
		woken.forEach((resolve) => resolve(text));
	};
	const onStateLine = (sessionId, state) => {
		const session = sessions.find((candidate) => candidate.sessionId === sessionId);
		if (session == null) return;
		setStatus(sessionId, statusOf(state));
		const key = wakeKeyOf(state);
		if (wakeKeys.get(sessionId) === key) return;
		wakeKeys.set(sessionId, key);
		const text = value(state).pipe(tag(SessionStatuses.waiting, (waiting) => questionWake(session, waiting.question)), tag(SessionStatuses.idle, (idle) => finishWake(session, idle.lastEntry)), tag(SessionStatuses.failed, (failed) => failureWake(session, failed.failure)), orElse(() => void 0));
		if (text == null) {
			unwaited.delete(sessionId);
			return;
		}
		deliver(sessionId, text);
	};
	const onWatchLine = (line) => {
		if ("error" in line) {
			drop(line.sessionId);
			return;
		}
		onStateLine(line.sessionId, line.state);
	};
	const restartWatch = () => {
		watchProcess?.stop();
		watchProcess = void 0;
		const open = sessions.filter(isOpen);
		if (!isInteractive || open.length === 0) return;
		const onOutput = createLineSplitter((raw) => {
			map$7(decodeWatchLine(raw), onWatchLine);
		});
		watchProcess = glue.watch(open.map((session) => session.sessionId), onOutput);
	};
	const runCommand = async (name, args) => {
		const printed = await glue.runHelper([name, JSON.stringify(args)]).catch(String);
		return getOrElse(decodeCommandResult(printed.trim().split("\n").at(-1) ?? ""), () => HelperError.make({ message: `The helper printed no result: ${printed.trim() || "nothing"}` }));
	};
	const afterSuccess = {
		spawn: (args, success) => {
			const created = decodeUnknownSync(SpawnResult)(success.result);
			const { name } = decodeUnknownSync(NamedArguments)(args);
			wakeKeys.set(created.sessionId, SessionStatuses.running);
			save([...sessions, SessionRef.make({
				sessionId: created.sessionId,
				name,
				status: SessionStatuses.running
			})]);
			restartWatch();
		},
		close: (args) => {
			map$7(targetOf(args), (sessionId) => {
				unwaited.delete(sessionId);
				setStatus(sessionId, SessionStatuses.closed);
				restartWatch();
			});
		},
		prompt: (args) => {
			map$7(filter(targetOf(args), (sessionId) => sessions.some((session) => session.sessionId === sessionId && session.status === SessionStatuses.closed)), (sessionId) => {
				wakeKeys.set(sessionId, SessionStatuses.running);
				setStatus(sessionId, SessionStatuses.running);
				restartWatch();
			});
		},
		messages: ignoreSuccess,
		list: ignoreSuccess,
		answer: ignoreSuccess
	};
	const requestOf = {
		spawn: (args, current) => Object.assign({}, args, { parent: current }),
		list: (_args, current) => ({ parent: current }),
		prompt: passArguments,
		messages: passArguments,
		close: passArguments,
		answer: passArguments
	};
	const runEndpoint = async (tool, args) => {
		const current = parent;
		if (current == null) return {
			isError: true,
			text: "The tentacles plugin has not started for this session yet."
		};
		return value(await runCommand(tool.name, requestOf[tool.name](args, current))).pipe(tagsExhaustive({
			Success: (success) => {
				afterSuccess[tool.name](args, success);
				return {
					isError: false,
					text: JSON.stringify(success.result ?? "Done.")
				};
			},
			Failure: (failure) => {
				if (isTagged(failure.error, "SessionNotFound")) {
					drop(failure.error.sessionId);
					restartWatch();
				}
				return {
					isError: true,
					text: failureText(failure.error)
				};
			},
			HelperError: (error) => ({
				isError: true,
				text: error.message
			})
		}));
	};
	const runWait = (_args, signal) => {
		if (!sessions.some(isOpen) || !isInteractive) return Promise.resolve({
			isError: false,
			text: "No remote agent is open, so there is nothing to wait for."
		});
		const [pending] = unwaited;
		if (pending != null) {
			const [sessionId, text] = pending;
			unwaited.delete(sessionId);
			return Promise.resolve({
				isError: false,
				text
			});
		}
		return new Promise((resolve) => {
			const waiter = (text) => resolve({
				isError: false,
				text
			});
			waiters.push(waiter);
			signal?.addEventListener("abort", () => {
				waiters = waiters.filter((candidate) => candidate !== waiter);
				resolve({
					isError: true,
					text: "The wait was cancelled."
				});
			});
		});
	};
	for (const tool of toolsFor(harness)) glue.registerTool(tool, ToolEntry.$match(tool, {
		Endpoint: (endpoint) => (args) => runEndpoint(endpoint, args),
		WatchOnly: () => runWait
	}));
	return {
		start: async (options) => {
			parent = {
				harness,
				sessionId: ParentSessionId.make(options.parentSessionId)
			};
			waiters = [];
			wakeKeys.clear();
			unwaited.clear();
			isInteractive = options.isInteractive;
			sessions = (await glue.readState()).sessions;
			sessions.forEach((session) => wakeKeys.set(session.sessionId, session.status));
			if (sessions.length > 0) {
				const listed = await runCommand(ToolNames.list, { parent });
				if (isTagged(listed, "Success")) sessions = decodeUnknownSync(SessionRefs)(listed.result);
				save(sessions);
			}
			glue.status(renderStatusLine(sessions));
			restartWatch();
		},
		stop: () => {
			watchProcess?.stop();
			watchProcess = void 0;
			glue.status(void 0);
		}
	};
};
// src/claude/state-file.ts
var decodeState = decodeUnknownOption(LocalStateJson);
var encodeState = encodeSync(LocalStateJson);
/** The state file of one Claude session, under the plugin's data folder. */
async function stateFilePath($, sessionId) {
	return `${await $.env.get("CLAUDE_PLUGIN_DATA") ?? `${await $.env.get("HOME") ?? ""}/.claude/plugins/data/tentacles`}/sessions/${sessionId}.json`;
}
async function readStateFile($, path) {
	return getOrElse(decodeState(await $.fs.read(path).catch(() => "")), () => LocalState.make({ sessions: [] }));
}
async function writeStateFile($, path, state) {
	await $.fs.write(path, encodeState(state));
}
// src/claude/wake-queue.ts
/**
* Serializes wakes into prompts. A submitted prompt cannot be withdrawn and
* waits for the session to go idle, so while one is in flight every later
* wake folds into the next prompt instead of queueing a turn of its own.
*/
var createWakeQueue = (submit) => {
	let pending = [];
	let isInFlight = false;
	const flush = async () => {
		if (isInFlight || pending.length === 0) return;
		const text = pending.join("\n\n");
		isInFlight = true;
		pending = [];
		await submit(text).catch(() => void 0);
		isInFlight = false;
		flush();
	};
	return (text) => {
		pending.push(text);
		flush();
	};
};
// src/claude/register.ts
var helperTimeoutMs = 6e5;
function isJson(value) {
	return is(Json)(value);
}
async function helperOf($) {
	return await $.env.get("TENTACLES_HELPER") ?? `${$.plugin.root}/bin/tentacles-helper`;
}
function watchOf($, helper) {
	return (sessionIds, onOutput) => {
		const stream = $.process.spawn({ argv: [
			helper,
			"watch",
			...sessionIds
		] })[Symbol.asyncIterator]();
		(async () => {
			for (let next = await stream.next(); next.done !== true; next = await stream.next()) if (next.value.stream === "stdout") onOutput(next.value.text);
		})().catch(() => void 0);
		return { stop: () => void stream.return?.() };
	};
}
function glueOf($, helper, statePath, runs) {
	return {
		readState: () => readStateFile($, statePath),
		writeState: (state) => writeStateFile($, statePath, state),
		status: (line) => $.ui.status(line),
		wake: createWakeQueue(async (text) => {
			await $.prompt.submit({ text });
		}),
		registerTool: (tool, run) => void $.tool.register({
			name: tool.name,
			description: tool.description,
			inputSchema: ToolEntry.$match(tool, {
				Endpoint: (endpoint) => endpoint.arguments,
				WatchOnly: () => ({
					type: "object",
					properties: {}
				})
			}),
			isDeferred: false
		}).then((registered) => runs.set(registered.tool, run)).catch((error) => $.ui.log(`tentacles: the ${tool.name} tool is not available (${error.message})`)),
		runHelper: async (argv) => {
			const { stdout, stderr } = await $.process.run([helper, ...argv], { timeoutMs: helperTimeoutMs });
			return stdout === "" ? stderr : stdout;
		},
		watch: watchOf($, helper)
	};
}
function argumentsOf(event) {
	const { tool: _tool, tool_use_id: _toolUseId, agentId: _agentId, requestMeta: _requestMeta, ...args } = event;
	return Object.fromEntries(Object.entries(args).filter((entry) => entry[1] != null && isJson(entry[1])));
}
function register(on) {
	const runs = /* @__PURE__ */ new Map();
	let controller;
	on("session.start", async ($, event, next) => {
		const started = await next(event);
		const [sessionId, helper] = await Promise.all([$.session.id(), helperOf($)]);
		const statePath = await stateFilePath($, sessionId);
		controller?.stop();
		runs.clear();
		controller = createController(glueOf($, helper, statePath, runs), Harnesses.claude);
		controller.start({
			parentSessionId: sessionId,
			isInteractive: event.isInteractive
		}).catch(() => void 0);
		return started;
	});
	on("session.end", async (_$, event, next) => {
		controller?.stop();
		controller = void 0;
		return next(event);
	});
	on("tool.call", async (_$, event, next) => {
		const run = runs.get(event.tool);
		if (run == null) return next(event);
		const outcome = await run(argumentsOf(event));
		return outcome.isError ? { deny: outcome.text } : { result: outcome.text };
	}).catch((_$, event, next) => next.called ? next(event) : { deny: "The tentacles tool failed." });
}
export { register };
