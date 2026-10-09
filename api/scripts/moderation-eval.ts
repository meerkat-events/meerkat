/**
 * Evaluates automatic question moderation against labeled case files.
 *
 * Every case goes through `classifyQuestion` exactly as the create route sends
 * it (designs/002-question-moderation.md). Per case file, the report shows how
 * many questions that must be hidden were hidden, how many that must stay
 * visible were hidden, a threshold table, the misses, latency and cost. The
 * process exits with code 1 when a file misses its gates or a request fails,
 * so the eval guards every change to the model, the criteria, the threshold
 * or a conference's moderation config.
 *
 * Usage, in api/:
 *   node --env-file=.env scripts/moderation-eval.ts [case files...]
 *     [--threshold 0.6] [--out results.json] [--baseline results.json]
 *
 * Without files it runs scripts/moderation-cases.json. Private case files,
 * such as labeled production questions, use the same format and stay outside
 * the repository; so do their --out files, which contain the questions:
 * write them to ../.backups/moderation/.
 *
 * Case file format:
 *   {
 *     "moderation": { "context": "...", "instructions"?: "...", "criteria"?: {...} },
 *     "gates"?: { "minHideRecall": 0.8, "maxFalseHideRate": 0.01 },
 *     "cases": [{ "expect": "hide" | "allow" | "either", "category"?, "note"?,
 *                 "conference"?, "talk": "...", "question": "..." }]
 *   }
 * `moderation` has the format of conferences.moderation; a case's own
 * `conference` replaces only its context.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import zod from "zod";
import { type Classification, classifyQuestion } from "../classifier.ts";
import {
  conferenceModerationSchema,
  HIDE_THRESHOLD,
  MODERATION_CATEGORIES,
  MODERATION_MODEL,
  MODERATION_TIMEOUT_MS,
} from "../moderation.ts";

const apiKey = process.env["OPENROUTER_API_KEY"];
if (!apiKey) {
  throw new Error("OPENROUTER_API_KEY is required (run with --env-file=.env)");
}

// The eval waits longer than production so slow calls are measured instead of
// counted as failures; the report shows how many exceeded the production
// timeout.
const EVAL_TIMEOUT_MS = 10_000;
const CONCURRENCY = 8;
const REPORT_THRESHOLDS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
const BASELINE_TOLERANCE = 0.01;

const caseSchema = zod.object({
  expect: zod.enum(["hide", "allow", "either"]),
  category: zod.enum(MODERATION_CATEGORIES).exclude(["none"]).optional(),
  note: zod.string().optional(),
  conference: zod.string().min(1).optional(),
  talk: zod.string().min(1),
  question: zod.string().min(1),
});
type Case = zod.infer<typeof caseSchema>;

const caseFileSchema = zod.object({
  $comment: zod.string().optional(),
  moderation: conferenceModerationSchema,
  gates: zod.object({
    minHideRecall: zod.number().min(0).max(1),
    maxFalseHideRate: zod.number().min(0).max(1),
  }).default({ minHideRecall: 0.8, maxFalseHideRate: 0.01 }),
  cases: zod.array(caseSchema).min(1),
});
type CaseFile = zod.infer<typeof caseFileSchema>;

type Result = Case & {
  file: string;
  durationMs: number;
  classification?: Classification;
  error?: string;
};

async function evaluate(file: string, caseFile: CaseFile, item: Case) {
  const moderation = item.conference
    ? { ...caseFile.moderation, context: item.conference }
    : caseFile.moderation;
  const started = performance.now();
  const result = await classifyQuestion(
    { question: item.question, talkTitle: item.talk, moderation },
    { apiKey: apiKey!, model: MODERATION_MODEL, timeoutMs: EVAL_TIMEOUT_MS },
  );
  const durationMs = performance.now() - started;
  return "error" in result
    ? { ...item, file, durationMs, error: result.error }
    : { ...item, file, durationMs, classification: result };
}

/** Runs `work` over `items` with at most `limit` in flight, keeping order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

/** Identifies a case across runs, independent of its position in the file. */
function caseKey(result: { talk: string; question: string }) {
  return `${result.talk}\n${result.question}`;
}

function percent(part: number, whole: number) {
  return whole === 0 ? "n/a" : `${(100 * part / whole).toFixed(1)} %`;
}

function percentile(sorted: number[], fraction: number) {
  return sorted[Math.floor(fraction * (sorted.length - 1))] ?? 0;
}

function describe(result: Result) {
  const score = result.classification?.flagged.toFixed(2) ?? "  - ";
  const predicted = result.classification?.category ?? "-";
  const expected = result.category ?? result.note ?? "";
  const question = result.question.replace(/\s+/g, " ").slice(0, 90);
  return `  ${score}  ${predicted.padEnd(14)} ${expected.padEnd(22)} ${question}`;
}

/** Prints the report for one case file and returns whether its gates pass. */
function report(
  file: string,
  caseFile: CaseFile,
  results: Result[],
  threshold: number,
  baseline: Map<string, number> | null,
) {
  const scored = results.filter((result) => result.classification);
  const failed = results.filter((result) => result.error !== undefined);
  const isHidden = (result: Result, at = threshold) =>
    (result.classification?.flagged ?? 0) >= at;

  const mustHide = scored.filter((result) => result.expect === "hide");
  const mustAllow = scored.filter((result) => result.expect === "allow");
  const either = scored.filter((result) => result.expect === "either");
  const hidden = mustHide.filter((result) => isHidden(result));
  const falseHides = mustAllow.filter((result) => isHidden(result));
  const recall = mustHide.length === 0 ? 1 : hidden.length / mustHide.length;
  const falseHideRate = mustAllow.length === 0
    ? 0
    : falseHides.length / mustAllow.length;

  const models = [
    ...new Set(scored.map((result) => result.classification!.model)),
  ];
  console.log(`\n=== ${file}`);
  console.log(`${results.length} cases, model ${models.join(", ") || MODERATION_MODEL}, hide threshold ${threshold}\n`);

  console.log("Must hide, by category:");
  for (const category of MODERATION_CATEGORIES) {
    if (category === "none") continue;
    const inCategory = mustHide.filter((result) => result.category === category);
    if (inCategory.length === 0) continue;
    const caught = inCategory.filter((result) => isHidden(result)).length;
    console.log(`  ${category.padEnd(15)} ${caught} of ${inCategory.length}`);
  }
  console.log(`  ${"all".padEnd(15)} ${hidden.length} of ${mustHide.length} (${percent(hidden.length, mustHide.length)})`);
  console.log(`Must allow: ${falseHides.length} of ${mustAllow.length} hidden (${percent(falseHides.length, mustAllow.length)})`);
  console.log(`Either: ${either.filter((result) => isHidden(result)).length} of ${either.length} hidden\n`);

  console.log("Threshold  must hide hidden  must allow hidden  either hidden");
  for (const at of REPORT_THRESHOLDS) {
    console.log([
      at.toFixed(1).padStart(9),
      `${mustHide.filter((result) => isHidden(result, at)).length}/${mustHide.length}`.padStart(17),
      `${mustAllow.filter((result) => isHidden(result, at)).length}/${mustAllow.length}`.padStart(18),
      `${either.filter((result) => isHidden(result, at)).length}/${either.length}`.padStart(14),
    ].join(""));
  }

  const byScore = (a: Result, b: Result) =>
    (b.classification?.flagged ?? 0) - (a.classification?.flagged ?? 0);
  const sections: [string, Result[]][] = [
    ["Missed (must hide, not hidden)", mustHide.filter((result) => !isHidden(result))],
    ["False hides (must allow, hidden)", falseHides],
    ["Either", either],
  ];
  for (const [title, list] of sections) {
    if (list.length === 0) continue;
    console.log(`\n${title}:`);
    for (const result of list.sort(byScore)) console.log(describe(result));
  }

  if (baseline) {
    const changed = scored.filter((result) => {
      const before = baseline.get(caseKey(result));
      return before !== undefined &&
        Math.abs(before - result.classification!.flagged) > BASELINE_TOLERANCE;
    });
    const unmatched = scored.filter((result) => !baseline.has(caseKey(result)));
    console.log(`\nBaseline: ${changed.length} scores changed by more than ${BASELINE_TOLERANCE}, ${unmatched.length} cases not in the baseline`);
    for (const result of changed.slice(0, 20)) {
      const before = baseline.get(caseKey(result))!;
      console.log(`  ${before.toFixed(2)} -> ${result.classification!.flagged.toFixed(2)}  ${result.question.replace(/\s+/g, " ").slice(0, 90)}`);
    }
  }

  const durations = scored.map((result) => result.durationMs).sort((a, b) => a - b);
  const slow = durations.filter((ms) => ms > MODERATION_TIMEOUT_MS).length;
  const cost = scored.reduce((sum, result) => sum + result.classification!.usage.cost, 0);
  const tokens = scored.reduce((sum, result) => sum + result.classification!.usage.inputTokens, 0);
  console.log(
    `\nLatency p50 ${Math.round(percentile(durations, 0.5))} ms, p95 ${Math.round(percentile(durations, 0.95))} ms, ` +
      `max ${Math.round(percentile(durations, 1))} ms; ${slow} over the ${MODERATION_TIMEOUT_MS} ms production timeout`,
  );
  console.log(`Cost $${cost.toFixed(4)}, ${Math.round(tokens / Math.max(scored.length, 1))} input tokens per question`);
  for (const result of failed) {
    console.log(`ERROR ${result.question.replace(/\s+/g, " ").slice(0, 60)}: ${result.error}`);
  }

  const { minHideRecall, maxFalseHideRate } = caseFile.gates;
  const gates = [
    { name: `hide recall >= ${minHideRecall}`, passed: recall >= minHideRecall },
    { name: `false hide rate <= ${maxFalseHideRate}`, passed: falseHideRate <= maxFalseHideRate },
    { name: "no request errors", passed: failed.length === 0 },
  ];
  console.log("");
  for (const gate of gates) {
    console.log(`${gate.passed ? "PASS" : "FAIL"} ${gate.name}`);
  }
  return gates.every((gate) => gate.passed);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    threshold: { type: "string" },
    out: { type: "string" },
    baseline: { type: "string" },
  },
});

const threshold = values.threshold === undefined
  ? HIDE_THRESHOLD
  : Number(values.threshold);
if (!(threshold > 0 && threshold < 1)) {
  throw new Error(`--threshold must be between 0 and 1, got ${values.threshold}`);
}

/** Scores by case from an earlier --out file, in this or the earlier format. */
function readBaseline(path: string) {
  const entries = JSON.parse(readFileSync(path, "utf8")) as {
    talk: string;
    question: string;
    classification?: { flagged: number };
    verdict?: { flagged: number };
  }[];
  const scores = new Map<string, number>();
  for (const entry of entries) {
    const flagged = entry.classification?.flagged ?? entry.verdict?.flagged;
    if (flagged !== undefined) scores.set(caseKey(entry), flagged);
  }
  return scores;
}

const baseline = values.baseline ? readBaseline(values.baseline) : null;

const files = positionals.length > 0
  ? positionals
  : [new URL("./moderation-cases.json", import.meta.url).pathname];

// Parse every file before calling the API, so a bad config costs nothing.
const caseFiles = files.map((file) => ({
  file,
  caseFile: caseFileSchema.parse(JSON.parse(readFileSync(file, "utf8"))),
}));

const allResults: Result[] = [];
let allPassed = true;
for (const { file, caseFile } of caseFiles) {
  const results = await mapWithConcurrency(
    caseFile.cases,
    CONCURRENCY,
    (item) => evaluate(file, caseFile, item),
  );
  allResults.push(...results);
  allPassed = report(file, caseFile, results, threshold, baseline) && allPassed;
}

if (values.out) {
  writeFileSync(values.out, JSON.stringify(allResults, null, 2) + "\n");
}

if (!allPassed) {
  process.exitCode = 1;
}
