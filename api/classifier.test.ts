import assert from "node:assert/strict";
import { describe, it, type TestContext } from "node:test";
import {
  buildDecisionsRequest,
  type ClassificationResult,
  classifyQuestion,
} from "./classifier.ts";
import {
  conferenceModerationSchema,
  DEFAULT_CRITERIA,
  MODERATION_CATEGORIES,
} from "./moderation.ts";

const config = { apiKey: "test-key", model: "test/model", timeoutMs: 1000 };
const input = {
  question: "Buy $ZORPX now",
  talkTitle: "Scaling Ethereum",
  moderation: { context: "Devcon, an Ethereum developer conference." },
};

function probabilities(overrides: Record<string, number>) {
  const result: Record<string, number> = {};
  for (const category of MODERATION_CATEGORIES) result[category] = 0;
  return { ...result, ...overrides };
}

function decisionsResponse(answerProbabilities: Record<string, number>) {
  return Response.json({
    id: "gen-dec-1",
    model: "test/model-20261006",
    answers: {
      category: {
        type: "choice",
        choice: "none",
        confidence: 0.1,
        probabilities: answerProbabilities,
      },
    },
    usage: { input_tokens: 460, output_tokens: 0, cost: 0.000046 },
  });
}

function stubFetch(t: TestContext, respond: () => Response | Promise<Response>) {
  const requests: { url: string; body: unknown }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    requests.push({ url, body: JSON.parse(String(init.body)) });
    return respond();
  });
  return requests;
}

function assertError(result: ClassificationResult) {
  assert.ok("error" in result, `expected an error, got ${JSON.stringify(result)}`);
}

describe("classifyQuestion", () => {
  it("sums harmful options even when the API's choice is none", async (t) => {
    stubFetch(t, () =>
      decisionsResponse(
        probabilities({ none: 0.35, harassment: 0.3, shilling: 0.35 }),
      ));

    const result = await classifyQuestion(input, config);

    assert.ok(!("error" in result));
    assert.equal(result.category, "shilling");
    assert.equal(result.flagged.toFixed(2), "0.65");
    assert.equal(result.model, "test/model-20261006");
    assert.equal(result.id, "gen-dec-1");
    assert.deepEqual(result.usage, { inputTokens: 460, cost: 0.000046 });
  });

  it("fails when an option has no probability, instead of treating it as 0", async (t) => {
    const { none: _none, ...withoutNone } = probabilities({ shilling: 0.2 });
    stubFetch(t, () => decisionsResponse(withoutNone));

    assertError(await classifyQuestion(input, config));
  });

  it("fails on a rate limit", async (t) => {
    stubFetch(t, () => new Response("Rate limit exceeded", { status: 429 }));

    assertError(await classifyQuestion(input, config));
  });

  it("fails on an HTML error page from the edge", async (t) => {
    stubFetch(t, () => new Response("<html>timeout</html>", { status: 524 }));

    assertError(await classifyQuestion(input, config));
  });

  it("fails on a successful status with a body that is not JSON", async (t) => {
    stubFetch(t, () => new Response("<html>oops</html>", { status: 200 }));

    assertError(await classifyQuestion(input, config));
  });

  it("fails when the API does not answer within the timeout", async (t) => {
    t.mock.method(globalThis, "fetch", (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      }));

    const result = await classifyQuestion(input, { ...config, timeoutMs: 20 });

    assertError(result);
  });

  it("sends the conference context, the talk title and the question", async (t) => {
    const requests = stubFetch(t, () => decisionsResponse(probabilities({ none: 1 })));

    await classifyQuestion(input, config);

    assert.equal(requests.length, 1);
    assert.equal(requests[0]!.url, "https://openrouter.ai/api/alpha/decisions");
    assert.deepEqual(requests[0]!.body, buildDecisionsRequest(input, "test/model"));
    assert.deepEqual(buildDecisionsRequest(input, "test/model").state, {
      conference: "Devcon, an Ethereum developer conference.",
      talk: { title: "Scaling Ethereum" },
      question: "Buy $ZORPX now",
    });
  });
});

describe("buildDecisionsRequest", () => {
  it("replaces only the overridden criteria and keeps none first", () => {
    const request = buildDecisionsRequest({
      ...input,
      moderation: {
        context: "A memecoin meetup.",
        instructions: "Custom instructions.",
        criteria: { shilling: "Only promotion of scams counts." },
      },
    }, "test/model");

    const { criteria, instructions } = request.questions.category;
    assert.equal(instructions, "Custom instructions.");
    assert.equal(criteria.shilling, "Only promotion of scams counts.");
    assert.equal(criteria.none, DEFAULT_CRITERIA.none);
    assert.deepEqual(Object.keys(criteria), [...MODERATION_CATEGORIES]);
  });
});

describe("conferenceModerationSchema", () => {
  it("accepts a context with optional overrides", () => {
    assert.ok(conferenceModerationSchema.safeParse({
      context: "Devcon",
      criteria: { shilling: "Promotion of unrelated tokens." },
    }).success);
  });

  it("rejects an empty criteria text, which would blank out an option", () => {
    assert.ok(!conferenceModerationSchema.safeParse({
      context: "Devcon",
      criteria: { none: "" },
    }).success);
  });

  it("rejects unknown options and keys", () => {
    assert.ok(!conferenceModerationSchema.safeParse({
      context: "Devcon",
      criteria: { spam: "Anything repetitive." },
    }).success);
    assert.ok(!conferenceModerationSchema.safeParse({
      context: "Devcon",
      policy: "Old field",
    }).success);
  });

  it("requires a context", () => {
    assert.ok(!conferenceModerationSchema.safeParse({}).success);
  });
});
