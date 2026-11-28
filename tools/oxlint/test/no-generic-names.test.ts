import { describe, it } from "vitest";
import { RuleTester } from "oxlint/plugins-dev";

import { noGenericNamesRule } from "../tentacles/rules/no-generic-names.ts";

RuleTester.describe = describe;

RuleTester.it = it;

const tester = new RuleTester();

const filename = "/repo/packages/core/src/naming.ts";

tester.run("no-generic-names", noGenericNamesRule, {
  valid: [
    { code: "const owner = 1;", filename },
    { code: "const { data } = await fetchJson();", filename },
    { code: "const { response = null } = reply;", filename },
    { code: "const { body: requestBody } = reply;", filename },
    { code: "const [first, second] = pair;", filename },
    { code: "const dataset = load();", filename },
    { code: "const rowCount = rows.length;", filename },
    { code: "function load(sessionId: string) { return sessionId; }", filename },
    { code: "const load = (sessionId: string) => sessionId;", filename },
    { code: "class Store { constructor(private readonly archive: string) {} }", filename },
    { code: "type Handler = (input: string) => void;", filename },
    { code: "interface Api { run(input: string): void; }", filename },
    { code: "declare function run(input: string): void;", filename },
    { code: "declare const result: string;", filename },
    { code: "const config = { data: 1, result: 2 };", filename },
    {
      code: "const read = () => { try { return 1; } catch (failure) { return failure; } };",
      filename,
    },
    { code: "const sessionsByCallId = new Map<string, string>();", filename },
    { code: "const lastSeenByOwnerId = new WeakMap<object, string>();", filename },
    { code: "const known = new Set<string>();", filename },
    { code: "const sessions = new Set<string>();", filename },
    { code: "const parsed = value;", filename },
    { code: "const parsed = JSON;", filename },
    { code: "const decodedPayload = parse(text);", filename },
    { code: "const shared = flag ? read() : null;", filename },
    { code: "const status = await read();", filename },
    { code: "const [done, rest] = await read();", filename },
    { code: "const { settled = await read() } = reply;", filename },
    {
      code: 'import { createServer } from "node:http";\ncreateServer((request, response) => { respond(request, response); });',
      filename,
    },
    {
      code: 'import http from "node:http";\nhttp.createServer((request, response) => { respond(request, response); });',
      filename,
    },
    {
      code: 'import { HttpApiBuilder } from "effect/unstable/httpapi";\nHttpApiBuilder.group(Api, "sessions", (handlers) => handlers);',
      filename,
    },
    {
      code: 'import * as Effect from "effect/Effect";\nconst total = Effect.map(effect, (result) => result);',
      filename,
    },
    {
      code: 'import * as Effect from "effect/Effect";\nconst total = source.pipe(Effect.map((result) => result));',
      filename,
    },
    {
      code: 'import { service } from "alchemy";\nservice("a").build(function (state) { return state; });',
      filename,
    },
    {
      code: 'import type { ServerResponse } from "node:http";\nconst respond = (response: ServerResponse) => response.end();',
      filename,
    },
    {
      code: 'import type { ServerResponse } from "node:http";\nconst respond = (response: ServerResponse | null) => response;',
      filename,
    },
    {
      code: 'import type { ServerResponse } from "node:http";\nfunction respond(response: ServerResponse) { return response; }',
      filename,
    },
    {
      code: 'import { type ServerResponse } from "node:http";\nconst respond = (code: number, response: ServerResponse = fallback) => response;',
      filename,
    },
    {
      code: 'import type * as http from "node:http";\nconst respond = (response: http.ServerResponse) => response;',
      filename,
    },
    {
      code: 'import type { ServerResponse } from "node:http";\nconst respond = ({ first: response }: ServerResponse) => response;',
      filename,
    },
    { code: "const load = (state: DurableObjectState) => state;", filename },
    { code: "const load = (state?: DurableObjectState) => state;", filename },
    { code: "const load = (...rest: Array<string>) => handlers;", filename },
    { code: "const load = (response: Response) => response;", filename },
    {
      code: "class Store { constructor(private readonly state: DurableObjectState) {} }",
      filename,
    },
    {
      code: 'import type { Response } from "undici";\nconst response: Response = build();',
      filename,
    },
    { code: "const response: Response = build();", filename },
    { code: "const githubFetch: typeof fetch = async (input, init) => input;", filename },
    {
      code: "const githubFetch: typeof fetch = async function (input, init) { return input; };",
      filename,
    },
    {
      code: 'import type { Handler } from "node:events";\nconst listener: Handler = (input) => input;',
      filename,
    },
    {
      code: 'import type * as Cloudflare from "alchemy/cloudflare";\nconst loopback = (state: Cloudflare.DurableObjectState["Service"]) => state;',
      filename,
    },
    { code: "function isJson(value: unknown): value is Json { return true; }", filename },
    { code: "const isJson = (value: unknown): value is Json => true;", filename },
    { code: "const assertJson = function (value: unknown): asserts value is Json {};", filename },
    { code: "const seed = await read();", filename },
    { code: "const need = await read();", filename },
    { code: "const speed = await read();", filename },
    { code: "const feed = await read();", filename },
    { code: "const bed = await read();", filename },
    { code: "const red = await read();", filename },
    { code: "const shed = await read();", filename },
    { code: "const bleed = await read();", filename },
    { code: "const breed = await read();", filename },
    { code: "const embed = await read();", filename },
    { code: "const exceed = await read();", filename },
    { code: "const proceed = await read();", filename },
    { code: "const succeed = await read();", filename },
    { code: "const indeed = await read();", filename },
  ],
  invalid: [
    {
      code: "const data = 1;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "data" } }],
    },
    {
      code: "let result;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "result" } }],
    },
    {
      code: "const { first: value } = pair;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "value" } }],
    },
    {
      code: "const { first: { second: item } } = pair;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "item" } }],
    },
    {
      code: "const [rows, other] = pair;",
      filename,
      errors: [
        { messageId: "deniedName", data: { name: "rows" } },
        { messageId: "deniedName", data: { name: "other" } },
      ],
    },
    {
      code: "const [first, ...items] = pair;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "items" } }],
    },
    {
      code: "const { ...state } = reply;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "state" } }],
    },
    {
      code: 'const { first: body = "" } = reply;',
      filename,
      errors: [{ messageId: "deniedName", data: { name: "body" } }],
    },
    {
      code: "function handle() {}",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "handle" } }],
    },
    {
      code: "const process = () => 1;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "process" } }],
    },
    {
      code: "function load(input: string) { return input; }",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "input" } }],
    },
    {
      code: "const load = (response: string, last = 1) => response;",
      filename,
      errors: [
        { messageId: "deniedName", data: { name: "response" } },
        { messageId: "deniedName", data: { name: "last" } },
      ],
    },
    {
      code: "interface Pair { first: string }\nconst load = ({ first: page }: Pair) => page;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "page" } }],
    },
    {
      code: "const load = (...handlers: Array<string>) => handlers;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "handlers" } }],
    },
    {
      code: "class Store { constructor(private readonly rows: Array<string>) {} }",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "rows" } }],
    },
    {
      code: "const read = () => { try { return 1; } catch (info) { return info; } };",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "info" } }],
    },
    {
      code: "const read = function collect() {};",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "collect" } }],
    },
    {
      code: "for (const pending of queue) { send(pending); }",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "pending" } }],
    },
    {
      code: "const saved = 1, tree = 2;",
      filename,
      errors: [
        { messageId: "deniedName", data: { name: "saved" } },
        { messageId: "deniedName", data: { name: "tree" } },
      ],
    },
    {
      code: "const sessions = new Map<string, string>();",
      filename,
      errors: [{ messageId: "collectionName", data: { name: "sessions" } }],
    },
    {
      code: "const cache = new WeakMap();",
      filename,
      errors: [{ messageId: "collectionName", data: { name: "cache" } }],
    },
    {
      code: "const created = createConversation(args);",
      filename,
      errors: [{ messageId: "participleName", data: { name: "created" } }],
    },
    {
      code: "const created = await createConversation(args);",
      filename,
      errors: [{ messageId: "participleName", data: { name: "created" } }],
    },
    {
      code: "const checked = (await checkSkills(sources)) as Checked;",
      filename,
      errors: [{ messageId: "participleName", data: { name: "checked" } }],
    },
    {
      code: 'import { track } from "./track.ts";\ntrack((response) => response);',
      filename,
      errors: [{ messageId: "deniedName", data: { name: "response" } }],
    },
    {
      code: 'import { track } from "@tentacles/core";\ntrack((response) => response);',
      filename,
      errors: [{ messageId: "deniedName", data: { name: "response" } }],
    },
    {
      code: "local((input) => input);",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "input" } }],
    },
    {
      code: 'import { createServer } from "node:http";\ncreateServer(wrap((response) => response));',
      filename,
      errors: [{ messageId: "deniedName", data: { name: "response" } }],
    },
    {
      code: 'import { createServer } from "node:http";\nconst listener = (response) => response;\ncreateServer(listener);',
      filename,
      errors: [{ messageId: "deniedName", data: { name: "response" } }],
    },
    {
      code: 'import { createServer } from "node:http";\ncreateServer(options, (request) => request, local((input) => input));',
      filename,
      errors: [{ messageId: "deniedName", data: { name: "input" } }],
    },
    {
      code: 'import { run } from "node:test";\nrun(() => { const data = 1; });',
      filename,
      errors: [{ messageId: "deniedName", data: { name: "data" } }],
    },
    {
      code: "interface Reply { ok: boolean }\nconst respond = (response: Reply) => response;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "response" } }],
    },
    {
      code: "type Reply = { ok: boolean };\nconst respond = (response: Reply | null) => response;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "response" } }],
    },
    {
      code: 'import type { Reply } from "./reply.ts";\nconst respond = (response: Reply) => response;',
      filename,
      errors: [{ messageId: "deniedName", data: { name: "response" } }],
    },
    {
      code: 'import type { Reply } from "@tentacles/contracts";\nconst respond = (response: Reply) => response;',
      filename,
      errors: [{ messageId: "deniedName", data: { name: "response" } }],
    },
    {
      code: "class Reply {}\nconst respond = (response: Reply) => response;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "response" } }],
    },
    {
      code: "const load = (rows: ReadonlyArray<string>) => rows;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "rows" } }],
    },
    {
      code: "const load = (items: Array<ServerResponse>) => items;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "items" } }],
    },
    {
      code: "const load = (rows: Map<string, string>) => rows;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "rows" } }],
    },
    {
      code: "const load = <Item>(value: Item) => value;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "value" } }],
    },
    {
      code: "const load = (response: string) => response;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "response" } }],
    },
    {
      code: "const load = (response: { ok: boolean }) => response;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "response" } }],
    },
    {
      code: "const load = (response) => response;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "response" } }],
    },
    {
      code: "interface LocalState { id: string }\nconst state: LocalState = build();",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "state" } }],
    },
    {
      code: "type LocalFetch = (input: string) => string;\nconst localFetch: LocalFetch = (input) => input;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "input" } }],
    },
    {
      code: "const localFetch = (url: string) => url;\nconst wrapped: typeof localFetch = (input) => input;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "input" } }],
    },
    {
      code: 'import type { ServerResponse } from "node:http";\nconst respond = (response: ServerResponse) => { const data = 1; return data; };',
      filename,
      errors: [{ messageId: "deniedName", data: { name: "data" } }],
    },
    {
      code: "function parse(value: unknown): Json { return value; }",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "value" } }],
    },
    {
      code: "const parse = (value: unknown): boolean => true;",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "value" } }],
    },
    {
      code: "function handle(value: unknown): value is Json { return true; }",
      filename,
      errors: [{ messageId: "deniedName", data: { name: "handle" } }],
    },
    {
      code: "const seeded = await read();",
      filename,
      errors: [{ messageId: "participleName", data: { name: "seeded" } }],
    },
    {
      code: "const needed = read();",
      filename,
      errors: [{ messageId: "participleName", data: { name: "needed" } }],
    },
    {
      code: "const speeded = read();",
      filename,
      errors: [{ messageId: "participleName", data: { name: "speeded" } }],
    },
  ],
});
