import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

import { bundleDir, compatibility } from "./test/bundle-worker.ts";
import { lifetimeSessionId, testSecrets } from "./test/secrets.ts";

const workerName = "tentacles";

// Every outbound request the Worker makes ends here, answered with what it received, so a test
// reads the forwarded request from the response.
const echo = async (request: Request) =>
  Response.json({
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers),
  });

// Workers AI through the gateway, as the model of every test session: one streamed answer that
// ends the run without a tool call.
interface CompletionChunk {
  readonly id: string;
  readonly object: string;
  readonly choices: ReadonlyArray<{
    readonly index: number;
    readonly delta: { readonly role?: string; readonly content?: string };
    readonly finish_reason: string | null;
  }>;
  readonly usage?: {
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
    readonly total_tokens: number;
  };
}

const chunk = (body: CompletionChunk) => `data: ${JSON.stringify(body)}\n\n`;

const model = async () =>
  new Response(
    [
      chunk({
        id: "test",
        object: "chat.completion.chunk",
        choices: [{ index: 0, delta: { role: "assistant", content: "done" }, finish_reason: null }],
      }),
      chunk({
        id: "test",
        object: "chat.completion.chunk",
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
      "data: [DONE]\n\n",
    ].join(""),
    { headers: { "content-type": "text/event-stream" } },
  );

const objects = ["SessionObject", "RegistryObject", "ClaudeObject"] as const;

// The Worker runs as its own Miniflare worker, from the bundle Alchemy would upload, and the tests
// reach it through bindings. Inside the test runner the plugin wraps Durable Objects in a class
// that answers RPC only for methods their prototype declares, while Alchemy's objects answer
// every method through a Proxy.
export default defineConfig({
  plugins: [
    cloudflareTest(({ inject }) => ({
      miniflare: {
        compatibilityDate: compatibility.date,
        // The cron test calls the Worker's scheduled handler through its service binding.
        compatibilityFlags: [...compatibility.flags, "service_binding_extra_handlers"],
        serviceBindings: {
          TENTACLES: workerName,
          // The containers' loopback to the Worker, with a session's egress props.
          LIFETIME: { name: workerName, props: { sessionId: lifetimeSessionId } },
        },
        durableObjects: Object.fromEntries(
          objects.map((name) => [name, { className: name, scriptName: workerName }]),
        ),
        workers: [
          {
            name: workerName,
            modules: inject("workerModules"),
            modulesRoot: bundleDir,
            compatibilityDate: compatibility.date,
            compatibilityFlags: compatibility.flags,
            bindings: testSecrets,
            durableObjects: Object.fromEntries(
              objects.map((name) => [name, { className: name, useSQLite: true }]),
            ),
            serviceBindings: { AI: model, BROWSER: echo },
            outboundService: echo,
          },
        ],
      },
    })),
  ],
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
  },
});
