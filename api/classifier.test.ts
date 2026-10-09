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
  POLITICS_QUESTION,
  shouldHide,
  WAR_QUESTION,
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

function decisionsResponse(
  answerProbabilities: Record<string, number>,
  topics: { politics?: number; war?: number } = {},
) {
  const answers: Record<string, unknown> = {
    category: {
      type: "choice",
      choice: "none",
      confidence: 0.1,
      probabilities: answerProbabilities,
    },
  };
  if (topics.politics !== undefined) {
    answers["politics"] = { type: "noul", noul: topics.politics };
  }
  if (topics.war !== undefined) {
    answers["war"] = { type: "noul", noul: topics.war };
  }
  return Response.json({
    id: "gen-dec-1",
    model: "test/model-20261006",
    answers,
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
        { politics: 0.1, war: 0.02 },
      ));

    const result = await classifyQuestion(input, config);

    assert.ok(!("error" in result));
    assert.equal(result.category, "shilling");
    assert.equal(result.flagged.toFixed(2), "0.65");
    assert.equal(result.model, "test/model-20261006");
    assert.equal(result.id, "gen-dec-1");
    assert.deepEqual(result.usage, { inputTokens: 460, cost: 0.000046 });
    assert.equal(result.politics, 0.1);
    assert.equal(result.war, 0.02);
  });

  it("fails when a topic answer is missing", async (t) => {
    stubFetch(t, () =>
      decisionsResponse(probabilities({ none: 1 }), { politics: 0.1 }));

    assertError(await classifyQuestion(input, config));
  });

  it("fails when an option has no probability, instead of treating it as 0", async (t) => {
    const { none: _none, ...withoutNone } = probabilities({ shilling: 0.2 });
    stubFetch(t, () => decisionsResponse(withoutNone, { politics: 0, war: 0 }));

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
    const requests = stubFetch(t, () =>
      decisionsResponse(probabilities({ none: 1 }), { politics: 0, war: 0 }));

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

describe("questions", () => {
  it("asks the category question and both topic questions", () => {
    const { questions } = buildDecisionsRequest(input, "test/model");
    assert.deepEqual(Object.keys(questions), ["category", "politics", "war"]);
    assert.equal(questions.politics, POLITICS_QUESTION);
    assert.equal(questions.war, WAR_QUESTION);
  });
});

describe("shouldHide", () => {
  it("hides on any of the three scores", () => {
    assert.ok(shouldHide({ flagged: 0.6, politics: 0, war: 0 }));
    assert.ok(shouldHide({ flagged: 0, politics: 0.7, war: 0 }));
    assert.ok(shouldHide({ flagged: 0, politics: 0, war: 0.7 }));
  });

  it("shows a question below every threshold", () => {
    assert.ok(!shouldHide({ flagged: 0.59, politics: 0.69, war: 0.69 }));
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
