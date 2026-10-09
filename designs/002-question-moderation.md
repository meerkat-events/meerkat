# Automatic question moderation

- **Target:** `api/` (Hono routes, Drizzle schema, React Router frontend) and `packages/react/`, based on `feat/selected-question-endpoint` at `5172963`.
- **Goal:** Questions that are harassment, hate speech, discrimination, phishing, scams or obvious shilling never reach the stage screen or other attendees. The author still sees their own question, so there is nothing to argue about or retry. Organizers get the last word later through a separate admin view.
- **Success criteria:**
  - S1: With moderation configured for a conference, a question the classifier flags is stored but absent from every public list, Realtime payload and the presenter view, while the author's Q&A page shows it like any other question.
  - S2: Without configuration, without an API key, or when the classifier errors or times out, questions are stored and shown exactly as today (fail open).
  - S3: The eval exits 0 on both case files with their own gates: the committed cases at least 80 % of must-hide cases hidden and at most 1 % of must-allow cases; the private labeled set from the Bangkok and Buenos Aires dumps at least 10 of 13 violations hidden and at most 0.1 % of the 5,640 kept questions.
  - S4: Policy and context can be changed per conference in the database without a deploy, and the eval can check a conference's config before it is enabled.

## Current state

- `POST /api/v1/events/:uid/questions` (`api/routes/events.ts:215`) checks ban and rate limits, inserts via `createQuestion`, broadcasts, and returns the raw row. Nothing inspects the text beyond the 200-character limit. `eventMiddleware` (`events.ts:62`) loads only the event.
- Visibility lives in `getQuestions` (callers: list route, event route, live-event route, `getSelectedQuestion`) and `getAllQuestions` (unauthenticated `GET /api/v1/questions`): skip deleted rows and banned users' rows.
- The list route is unauthenticated. The Q&A page reads it through `useQuestions` from `@meerkat-events/react`, whose `createFetcher` sends no token. `MeerkatProvider` is mounted above `UserProvider` in `api/app/layouts/app.tsx`, so it cannot see the session today. After posting, the footer calls the page's `refresh()`, which refetches the list.
- The moderation page subscribes to `postgres_changes` INSERT on `public.questions` with the anon key (`app/hooks/use-all-questions.ts`), under a Realtime SELECT policy of `USING (true)` (`api/scripts/supabase-policies.sql`). Every inserted row is delivered to any subscribed browser.
- Organizer deletions are not usable labels: in 5,675 prod questions, most of the 337 deletions are tests, duplicates, jokes and meta complaints, and some violations were never deleted. A hand-labeled set sits in `.backups/moderation/eval.jsonl` (gitignored), with `borderline` flags where the policy owner should decide. These questions contain personal data (self-identifying social handles, named third parties), so they never go into the repository.
- An eval already exists, untracked: `api/scripts/moderation-eval.ts` and 106 invented cases in `api/scripts/moderation-cases.json` (see Eval below).
- Question mutation responses in `api/routes/questions.ts` (upvote, select, mark-as-answered, delete) spread the full row minus `id` and `userId`, so new columns would be returned as-is.
- Hono's `jwk()` middleware and `verifyWithJwks` fetch Supabase's key set on every verification; only mutations pay that today.
- `api/env.ts` holds all environment variables and logs `redactedEnv` at startup. `api/logger.ts` is plain pino; Sentry is initialized in `api/instrumentation.ts` but caught errors are not reported unless code calls it.
- Migrations run in Fly's `release_command` before rollout, so new columns must be ignorable by the old code for a few minutes.

## Proposed change

- **Behavior/approach:** The create route classifies the question inline, before the insert, with a hard timeout. A flagged question is inserted with `hidden_at` set and skips the broadcast. Public queries exclude hidden rows unless they belong to the viewer, so the list route includes the author's own hidden questions when the request carries their token. The Realtime policy excludes hidden rows. Moderation is configured per conference in one JSON column holding the context and optional overrides of the question text; no configuration means no moderation. The classifier calls OpenRouter's Decisions API with the pinned snapshot `openai/gpt-6-luna-decisions-20261006` through `fetch`, asking one `choice` question whose options are the categories plus `none`. The API returns a validated typed answer with a probability per option, so there is no prompt to build and no text to parse. A question is hidden when the probability that it is not `none` reaches `HIDE_THRESHOLD` (0.6). The model sees only the conference's written context, the talk title and the question. The eval is the gate for every change to the model, the criteria, the threshold or a conference's config.
- **Scope:** schema and migration, Realtime policy, classifier and its tests, the eval wired to the production classifier, create route, visibility filter with optional viewer, cached key set for JWT checks, mutation responses without moderation fields, a token-aware question list hook for the Q&A page, one environment variable, CLAUDE.md.
- **Non-goals:** admin or organizer endpoints and UI (restore meanwhile is `UPDATE questions SET hidden_at = NULL`), a global policy table, the TypeSafe or OpenRouter SDKs, deterministic filters, user escalation, privacy notice, a job queue or worker, and changes to the react package: embedding sites never ask questions, so they never need to see hidden ones.
- **Effort/outcome:** Roughly ten files plus one migration, no new dependency, one new secret. Classification costs about $0.05 per 1,000 questions and a full private eval about $0.27. Inline classification needs no worker because volume is tens of questions per minute at peak and failures fail open. Letting the server include the viewer's own rows keeps ordering, vote counts and the question counter correct without any client merge.

| Area/files or contract | Planned change | Dependencies/compatibility |
| --- | --- | --- |
| `api/schema.ts`, new `api/drizzle/00xx_*.sql` | `questions.hidden_at timestamp` (null = visible); `questions.moderation jsonb` holding `{ category, flagged, model, id? }` when classified, where `flagged` is the probability of not `none`, `model` the dated snapshot from the response and `id` the OpenRouter generation id; `conferences.moderation jsonb` holding `{ context, instructions?, criteria? }`, null = off, typed with `$type` derived from the zod schema in `api/moderation.ts` so the two never diverge. Plain `pnpm generate` output. | Additive; old code ignores the columns. |
| `api/scripts/supabase-policies.sql` | Questions Realtime policy becomes `USING (hidden_at IS NULL)`. | Idempotent; run after the migration. |
| `api/moderation.ts` | Add the category list with `none` first, the default question (`DEFAULT_INSTRUCTIONS` and `DEFAULT_CRITERIA`, one text per category), `MODERATION_MODEL = "openai/gpt-6-luna-decisions-20261006"`, `MODERATION_TIMEOUT_MS` (1500), `HIDE_THRESHOLD` (0.6), and the zod schema for `conferences.moderation`: `context` a non-empty string, `instructions` an optional non-empty string, `criteria` a strict object over the seven known keys, each an optional non-empty string. | Constants. Values come from the eval runs below; changing any of them, or the criteria, requires a passing eval. |
| `api/classifier.ts` | `classifyQuestion(input, { apiKey, model, timeoutMs })`. Input: question text, conference moderation config and event title; speaker, track and description are deliberately not sent. `POST https://openrouter.ai/api/alpha/decisions` with `model`, `state` = `{ conference: context, talk: { title }, question }`, and one question `category` of type `choice` whose criteria are `{ ...DEFAULT_CRITERIA, ...overrides }`, so an override can replace text but never remove `none` or add an option. No `user`, `session_id`, `trace` or `provider` fields. Validates the response with zod: `answers.category.probabilities` must be a record of numbers in 0 to 1 that contains every option, otherwise `{ error }`; `id` is optional. Returns `{ category, flagged, model, id, usage: { inputTokens, cost } }`, where `flagged` is `1 - probabilities.none` and `category` is the highest-probability option other than `none` (not `choice`, which can be `none` while the harmful options together outweigh it). Imports neither `env.ts` nor `db.ts`. | `fetch`, `AbortSignal.timeout`, zod (existing). The endpoint is alpha: a changed response shape fails validation and fails open. A missing `none` probability is an error, never 0. |
| `api/scripts/moderation-eval.ts`, `api/scripts/moderation-cases.json` (exist, untracked) | Import `MODERATION_MODEL`, `HIDE_THRESHOLD`, `MODERATION_TIMEOUT_MS` and `classifyQuestion` instead of the script's own copies, and count a returned `{ error }` as a failed request. A case file's top-level `conference` string becomes `moderation`, an object in the `conferences.moderation` format parsed with the same zod schema, so an organizer's context and overrides are checked exactly as production will use them; a case's own `conference` string still replaces only `moderation.context`. A case file may set `gates: { minHideRecall, maxFalseHideRate }`, default 0.8 and 0.01. `--baseline <results.json>` lists cases whose `flagged` changed by more than 0.01. `--out` is documented to point into `.backups/moderation/`, because results of private files contain real questions. The environment check moves to the top of the script. Both files are committed with this change. | Real attendee questions only in gitignored case files. |
| `api/classifier.test.ts` | `node:test` with a stubbed `globalThis.fetch` returning the documented response shape. Cases: a spread distribution where `choice` is `none` but harmful options sum past the threshold yields the top harmful category; probabilities without `none` yield `{ error }`; a 429 and a non-JSON 524 body yield `{ error }`; a timeout yields `{ error }`; criteria overrides replace one text and keep the other options. Config parsing: `{ criteria: { none: "" } }` and unknown keys are rejected. | Runs without `.env`. |
| `api/env.ts`, `api/.env.example`, `README.md` | Optional `OPENROUTER_API_KEY`; added to `redactedEnv`; startup log line when unset; listed in the README's optional variables with a pointer to the setup steps below. | One key for local, dev and prod. On Fly it is a secret like `DATABASE_URL` and `PRIVATE_KEY`, not in the template or workflow. |
| `api/routes/events.ts` create route | Load the conference in the existing `Promise.all` with the rate-limit queries. When it has `moderation` and the key is set, parse the config with `safeParse`; an invalid config logs a warning and counts as off. Classify, and hide when `flagged >= HIDE_THRESHOLD`. Skip the broadcast for hidden rows. `logger.info` per hide with category and `flagged`. `logger.warn` per failure, and `Sentry.captureException` at most once per five minutes so a dead key or exhausted credits do not flood Sentry. No retry within the timeout. Respond with `{ data: { uid, question, createdAt } }`, keeping today's envelope; the client ignores the body. | Author's footer already refreshes after posting. |
| `api/middlewares/jwt.ts` | Cache Supabase's key set in the module, fetched on first use and refreshed after 10 minutes, and pass it as `keys` to both `jwt()` and a new `optionalJwt()`. `optionalJwt()` verifies a Bearer token when present and sets `jwtPayload`; on a missing, expired or invalid token it continues anonymously. | `verifyWithJwks` from `hono/jwt` (hono 4.13.7). Without the cache every authenticated list refetch would add a round trip to Supabase. `jwk({ allow_anon })` is not enough because it still rejects expired tokens. |
| `api/models/questions.ts` | `getQuestions` gains an optional `viewerId`; the hidden filter is `hidden_at IS NULL OR user_id = viewerId`, or `hidden_at IS NULL` without a viewer. `getAllQuestions` filters `hidden_at IS NULL`. `createQuestion` accepts `hiddenAt` and `moderation`. | Other `getQuestions` callers pass no viewer and see no hidden rows. |
| `api/routes/events.ts` list route | Add `optionalJwt()`; pass the optional `jwtPayload?.sub` as `viewerId`. | Unauthenticated callers unchanged. |
| `api/routes/questions.ts` | Upvote, select, mark-as-answered and delete responses also drop `hiddenAt` and `moderation`. | Upvote is reachable by the author of a hidden question. |
| `api/app/hooks/use-event-questions.ts`, `api/app/routes/QnA.tsx` | The Q&A page reads its list through a new app hook instead of the package's `useQuestions`: SWR with the app fetcher, key `[endpoint, accessToken]` so a new or refreshed session refetches, and the package's `useEventSource` for live updates. | `@meerkat-events/react` stays unchanged; only `QnA.tsx` used `useQuestions` in the app. |
| `CLAUDE.md` | Moderation domain rule, fail-open, per-conference config, Realtime filter, new secret. | — |

**Sequence:** schema and migration, then the Realtime policy; constants and classifier with tests; visibility filter and optional JWT; create route; react package and layout; eval run on the labeled set; docs; validation.

**Eval:** `api/scripts/moderation-eval.ts` runs labeled case files through the Decisions API and exits with code 1 when a gate fails: too few must-hide cases hidden, too many must-allow cases hidden, or any request error. Gates are per case file: the committed cases use the defaults (at least 80 % hidden, at most 1 % wrongly hidden); the private set, with only 13 violations, uses at least 10 of 13 and at most 0.1 %. It prints per-category results, a threshold table, misses, false hides, latency and cost. `api/scripts/moderation-cases.json` holds 106 invented cases (57 allow, 41 hide across all six categories, 8 either) in English, Spanish, Portuguese and Thai; none is copied or paraphrased from real questions, checked by word overlap against the private set. The labeled production questions run through the same script from the gitignored `.backups/moderation/prod-cases.json`. The model returned identical scores on repeated runs, so a changed result means a changed input, criteria or model, which makes the eval a dependable regression check; `--baseline` shows which scores moved.

```bash
cd api
node --env-file=.env scripts/moderation-eval.ts                                       # committed cases, ~$0.005
node --env-file=.env scripts/moderation-eval.ts ../.backups/moderation/prod-cases.json \
  --baseline ../.backups/moderation/prod-results.json --out ../.backups/moderation/prod-results-new.json  # 5,674 real questions, ~$0.27
```

**Results, 2026-10-09** (`openai/gpt-6-luna-decisions-20261006`, written conference context and talk title):

| Threshold | Committed: hide / allow hidden | Production: hide / allow hidden |
| --- | --- | --- |
| 0.4 | 41 of 41 / 0 of 57 | 10 of 13 / 6 of 5,640 |
| 0.5 | 41 of 41 / 0 of 57 | 10 of 13 / 3 of 5,640 |
| 0.6 | 41 of 41 / 0 of 57 | 10 of 13 / 0 of 5,640 |
| 0.7 | 39 of 41 / 0 of 57 | 7 of 13 / 0 of 5,640 |

- At 0.6 the production misses are a question about a speaker's gym strength, a request for where to buy an unrelated token, and a Spanish conspiracy joke about a well-known figure; all three are debatable, which is why the private set's recall gate is 10 of 13 rather than 80 %. Talk-related questions asking for a ticker or a token launch date all score under 0.15.
- p50 latency 142 ms, p95 279 ms; one call of 5,674 took 1,031 ms and the first call of a cold run 517 ms, so the timeout is 1.5 s.
- Context ablation on the same 531 questions: adding speaker, track, type and the talk description lowered scores on clear violations (one dropped from 0.96 to 0.48) and raised jokes into the middle range; invented per-category examples in the criteria did not help and raised p95 latency (one call took 1.5 s). Only the written conference context and the talk title are sent, and the criteria stay plain text.
- Without any conference context, on the 4,733 Devcon 7 and Devconnect ARG questions at 0.6: 5 of 12 violations hidden instead of 9 of 12, and 2 kept questions wrongly hidden instead of none. Scores barely move for ordinary questions (median change 0.00) but drop on borderline violations, so the context stays.
- On ten hand-picked questions, `typesafe/jev-1.13`, the only other decisions model, scored mild harassment higher but otherwise agreed.
- Organizers' deletions missed real violations: the model found three among kept questions (a token pump, a remark on a speaker's looks, a call for a bounty on a named person).
- Every response carried a probability for every option, `confidence`, the dated `model` and `usage.cost`; there were no errors in about 9,000 calls.

## Decisions taken

| ID | Choice | Rationale / alternatives rejected |
| --- | --- | --- |
| D1 | Classify inline before insert with a hard timeout; fail open. | No pending state, worker or queue, and the question never appears on stage. Async worker rejected as complexity without visible gain at this volume. |
| D2 | `hidden_at` timestamp rather than a status enum. | Matches `selectedAt`, `answeredAt`, `deletedAt`; restore sets it null. |
| D3 | Per-conference `conferences.moderation` JSON with `context` and optional `instructions` and `criteria` overrides; code defaults otherwise; null = off. | Editable in the database without a deploy, with no new table or row-level security entry. Changing the default for every conference takes a deploy. A global policy table was rejected as extra schema for one text value. |
| D4 | Shadow-hide through the server: list queries include hidden rows only for their author. | Ordering, votes and counter stay correct with no client merge. A separate endpoint plus client merge was rejected as more code and more failure modes. |
| D5 | One `choice` question over `none` plus the six categories; hide when `1 - P(none) >= 0.6`. | Decisions models return probabilities per option that sum to 1, so a threshold is meaningful, and summing every harmful option catches questions split between two categories. `confidence` only measures how concentrated the distribution is. Separate yes/no questions per category were rejected as more answers to combine. 0.6 is the lowest threshold with no false hides on the 5,640 kept questions; 0.5 hid three, 0.7 lost three violations. |
| D6 | OpenRouter Decisions API via `fetch` with the dated snapshot `openai/gpt-6-luna-decisions-20261006`; model, timeout and threshold as constants; key as the only environment variable. | Requested. Returns validated typed answers, so no prompt or JSON schema is needed. Pinning the snapshot (accepted by the API, probed 2026-10-09) keeps behavior equal to the eval; the undated alias would follow OpenAI's updates silently. `typesafe/jev-1.13` is the only other decisions model and was not chosen. The SDKs were rejected because one `fetch` call is enough. |
| D7 | Feedback, thanks, compliments, jokes, blunt criticism, politics without hate, tests and duplicates are allowed. | Requested; organizers handle the rest manually. |
| D8 | No admin or organizer operations in this change. | Requested; another person builds the admin view. |
| D9 | Send only the conference's written context, the talk title and the question; criteria in plain text without examples. | Measured: speaker, track, type and description lowered scores on clear violations and raised jokes toward the threshold; examples raised latency without better results. Less data also leaves the system. |
| D10 | The eval gates every change to model, criteria, threshold or a conference's config; committed cases are invented, real ones stay private. | The model is deterministic, so differences are real. The repository is public and real questions contain personal data. |

## Risks and recovery

| Risk / failure mode | Impact | Mitigation and validation | Residual uncertainty |
| --- | --- | --- | --- |
| Legitimate question hidden | Lost until restored by SQL | Threshold chosen on all 5,640 kept questions, `none` criteria spelled out, log line per hide, verdict stored on the row | A new conference's written context or overrides can shift results; check them with the eval before enabling |
| OpenRouter or OpenAI slow or down | Posting up to 1.5 s slower, then unmoderated | Timeout, fail open, warn log per failure, throttled Sentry report | The model has a single provider, so there is no fallback |
| Dead key or exhausted credits | Every question fails open | Throttled Sentry report names the status (401, 402) | Moderation is off until someone tops up |
| Alpha endpoint changes its contract | Every question fails open | Zod validation turns a changed shape into an error, which is logged and reported | Moderation is off until the code is updated |
| Manipulative question text | Wrong category | The model returns only option probabilities, the question is a field in `state`, the verdict only hides and never reaches clients | An attacker can at most hide or pass their own question |
| Hidden row reaches another client | Breaks S1 | Viewer filter in SQL, Realtime policy, moderation fields stripped from every response, `getAllQuestions` filtered | Future endpoints must reuse the filtered queries |
| Expired token on the list request | List must still load | `optionalJwt` falls back to anonymous instead of 401 | Author misses their hidden rows until the session refreshes, which changes the SWR key and refetches |
| JWKS fetch per list request | Extra latency and load on Supabase for every phone on every update | Module-level key cache shared by `jwt()` and `optionalJwt()` | A key rotation is picked up within 10 minutes |
| Non-English questions | Misses or false hides | Policy covers any language; committed eval has Spanish, Portuguese and Thai cases, all classified correctly | The one real non-English violation, a Spanish joke, was missed |
| Model snapshot retired | Requests fail and moderation fails open | Throttled Sentry report; upgrading means a new constant and a passing eval | OpenRouter's retirement policy for alpha models is unknown |

## Environment setup

All environments use the same OpenRouter key. Commands that change Fly, Supabase or OpenRouter are run by a maintainer; `<dev-app>`, `<prod-app>` and connection strings are placeholders because the repository is public.

**OpenRouter, once:**

1. Use the existing key. In the OpenRouter dashboard, give it a credit limit that covers a conference's traffic and eval runs with margin; a full Devcon is about $0.25 and a private eval run $0.27.
2. Keep the account topped up. An empty balance answers 402, every question then fails open, and Sentry reports it at most every five minutes.
3. Usage cannot be split by environment with one key; separate keys per environment remain possible later without code changes.

**Local and worktrees:**

1. `OPENROUTER_API_KEY=<key>` in `api/.env` (already present in the main checkout). New worktrees get it through `.worktreeinclude`; existing worktrees need it copied by hand.
2. `pnpm migrate` in `api/`, coordinated with other worktrees because they share one database, then `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f api/scripts/supabase-policies.sql`.
3. Enable moderation for a test conference: `UPDATE conferences SET moderation = '{"context": "<written context>"}' WHERE id = <id>;`
4. `node --env-file=.env scripts/moderation-eval.ts` in `api/` must pass.

**Dev and prod on Fly.** Run each step for `<dev-app>` first. Repeat for `<prod-app>` only after dev is verified.

1. Stage the secret from `api/.env`, so the key never lands in shell history; it takes effect with the next deploy:
   ```bash
   grep '^OPENROUTER_API_KEY=' api/.env | fly secrets import --app <dev-app> --stage
   ```
   Order does not matter: without the secret the new code simply does not moderate, and the old code ignores it.
2. Deploy: merging to `master` deploys dev and a GitHub release deploys prod. The `release_command` runs the additive migration before the rollout.
3. Apply the Realtime filter to that environment's Supabase project:
   ```bash
   psql "<environment DATABASE_URL>" -v ON_ERROR_STOP=1 -f api/scripts/supabase-policies.sql
   ```
4. Check the startup log (`fly logs --app <dev-app>`): no "moderation disabled" line means the key is present.
5. Per conference: write its context, run the eval with a copy of the committed cases whose `moderation` is that config (V7), then set it with the `UPDATE` above. On dev, post a shill question and a normal one and check V5. Before the first production conference, the maintainer decides the open `borderline` labels and the three debatable misses in the private set.

**Switching off and rollback:**

- One conference, instantly and without a deploy: `UPDATE conferences SET moderation = NULL WHERE id = <id>;`
- All conferences: `fly secrets unset OPENROUTER_API_KEY --app <app>`, which restarts the machines.
- Show a wrongly hidden question: `UPDATE questions SET hidden_at = NULL WHERE uid = '<uid>';`
- Code rollback: deploy the previous version; hidden rows then become visible to everyone. The migration needs no rollback.

## Validation

| Check | Command/procedure and cwd/environment | Expected result / criterion covered |
| --- | --- | --- |
| V1 | `pnpm --dir packages/react build && pnpm --dir api typecheck && pnpm --dir api lint` (repo root) | Pass |
| V2 | `node --test classifier.test.ts` in `api/`, without `.env` | All cases pass (S2) |
| V3 | Docker build and HTTP 200 per CLAUDE.md | Pass |
| V4 | In `api/`: `node --env-file=.env scripts/moderation-eval.ts`, then the private file with `--baseline ../.backups/moderation/prod-results.json`, after T9 | Both runs exit 0 with their own gates; the baseline lists no changed scores; p95 latency well under the timeout (S3) |
| V7 | In `api/`: run the eval on a scratch copy of the committed cases whose `moderation` sets a written context and one `criteria` override; then on a copy with `{ "criteria": { "none": "" } }` | First run exits 0 and the request carries the override; second run stops with a schema error before any API call (S4) |
| V5 | Manual, local dev server: conference with `moderation` set; phone A posts a shill question and a normal one; check phone A, phone B, `/e/:uid` and the moderation page; reload phone A; upvote the hidden question on phone A and inspect the response | Shill question visible only on phone A, also after reload; normal one everywhere; no `hiddenAt` or `moderation` in any response (S1) |
| V6 | Manual: key unset, then conference config null; post questions | Behaves as today (S2) |

- **Prerequisites:** an OpenRouter key in `api/.env` for V4 and V5; migrated local database, coordinated because worktrees share it; `supabase-policies.sql` applied locally.
- **Coverage limitations:** no route-level test harness exists, so S1 is checked by hand. The private labels are proposals: the `borderline` rows and the three debatable misses need the maintainer's decision, and with 13 violations one label change moves recall by about 8 points. The committed set is easier than real traffic, so it guards against regressions rather than measuring quality.

## Assumptions and constraints

- An OpenRouter account and key exist or will be created; the key is never committed.
- Hidden questions remain reachable by uid for select, answer and delete, which is inert until organizers can see them.
- Question text, the conference's written context and the talk title are sent to OpenRouter and OpenAI; no user id, session id or other attendee data is sent.
- Real attendee questions, including quotes and paraphrases, never enter the repository; committed eval cases are invented.
- The Decisions API is alpha; its shape is taken from the OpenAPI spec and live responses on 2026-10-09.

## Evidence

- Create, list and middleware: `api/routes/events.ts:62-75, 192-266`; visibility and ordering: `api/models/questions.ts:26-70`.
- Ask flow refresh: `api/app/components/QnA/Footer.tsx:52-62`; provider placement: `api/app/layouts/app.tsx:57-78`; package fetcher: `packages/react/src/fetcher.ts`.
- Realtime path: `api/app/hooks/use-all-questions.ts:50-66`, `api/scripts/supabase-policies.sql`.
- `verifyWithJwks`: `hono/jwt` in hono 4.13.7.
- Dumps and labels: `.backups/*.dump`, `.backups/moderation/{parse,label}.mjs`, `eval.jsonl`.
- Decisions API (request, response, errors): https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-request. The path overrides the server to `https://openrouter.ai`, so the URL is `https://openrouter.ai/api/alpha/decisions`; probed 2026-10-09, it answers 401 without a key.
- Snapshot pinning: `openai/gpt-6-luna-decisions-20261006` accepted and served as requested (probe, 2026-10-09).
- Jev tutorial (answer fields, thresholds): https://openrouter.ai/docs/guides/community/jev-tutorial. `openai/gpt-6-luna-decisions` (snapshot `20261006`) has one provider, OpenAI, at $0.10 per million input tokens and is not listed in the public model index; `typesafe/jev-1.13` is the only other decisions model (models endpoint, 2026-10-09).
- Eval: `api/scripts/moderation-eval.ts`, `api/scripts/moderation-cases.json`; private set and results: `.backups/moderation/prod-cases.json`, `prod-results.json`; context ablation: `.backups/moderation/eval.mjs` and `luna-*.jsonl`.

## Default question (`DEFAULT_INSTRUCTIONS`, `DEFAULT_CRITERIA`)

`instructions`:

```
Classify this audience question from a conference Q&A session. Questions are
short (at most 200 characters), typed on phones, often informal, and may be in
any language. Almost all questions belong in "none". Use the conference
context and the talk to judge what is on topic.
```

`criteria`:

| Option | Text |
| --- | --- |
| `none` | Any ordinary question or comment: blunt or critical questions about the talk, the speaker's work or the ecosystem; jokes and memes; feedback, thanks and compliments; questions about tokens, prices or launches related to the talk; political or controversial topics without hate; tests, duplicates and off-topic remarks. |
| `harassment` | Insults, sexual remarks or advances, or personal attacks aimed at a speaker, attendee or named person, including about looks, body or relationships. |
| `hate` | Slurs or hostile, dehumanizing statements about people because of ethnicity, nationality, religion, gender, sexuality, disability or similar. |
| `discrimination` | Calls to exclude people or treat them worse because of such group membership. |
| `phishing` | Attempts to get people to open a link, scan a code, connect a wallet, or share a seed phrase or credentials. |
| `scam` | Promises of money, prizes, airdrops or rewards in return for an action such as upvoting, sending funds or signing up; impersonation; vote buying. |
| `shilling` | Promotion of a token, ticker, product, project, referral code or link that is unrelated to the talk, including calls to buy or pump. |

Request body for one question:

```json
{
  "model": "openai/gpt-6-luna-decisions-20261006",
  "state": {
    "conference": "Devconnect ARG 2025 in Buenos Aires, an Ethereum developer conference. Talks are in English and Spanish.",
    "talk": { "title": "Ethereum (Roadmap in 30min)" },
    "question": "Buy $XYZ before it moons, link in bio"
  },
  "questions": {
    "category": { "type": "choice", "instructions": "<DEFAULT_INSTRUCTIONS>", "criteria": { "none": "…", "harassment": "…", "hate": "…", "discrimination": "…", "phishing": "…", "scam": "…", "shilling": "…" } }
  }
}
```

Example `conferences.moderation`: `{ "context": "Devconnect ARG 2025 in Buenos Aires, an Ethereum developer conference. Talks are in English and Spanish. Speakers are often well-known people in the Ethereum ecosystem." }`

## TODO

- [x] T1 — `api/schema.ts` and migration: `questions.hidden_at`, `questions.moderation`, `conferences.moderation`; `pnpm generate` reviewed with no `auth.users` DDL; `pnpm migrate` run locally after coordinating. (0008_special_guardian: three nullable columns, applied to the shared dev database.)
- [x] T2 — `api/scripts/supabase-policies.sql`: questions Realtime policy `USING (hidden_at IS NULL)`; applied locally; rollout note to run it on dev and prod after the migrating deploy. Depends on T1. (Policy now reads `USING (hidden_at IS NULL)` in the local database.)
- [x] T3 — `api/moderation.ts`: categories with `none` first, `DEFAULT_INSTRUCTIONS`, `DEFAULT_CRITERIA`, `MODERATION_MODEL`, `MODERATION_TIMEOUT_MS`, `HIDE_THRESHOLD`, and the zod schema for `conferences.moderation` that `api/schema.ts` uses for its `$type`. `api/env.ts`, `api/.env.example`: optional `OPENROUTER_API_KEY`, redacted, and a startup line "OPENROUTER_API_KEY not set, moderation disabled" when unset.
- [x] T4 — `api/classifier.ts` and `api/classifier.test.ts`: Decisions API call, criteria merge, response validation with every option required, `flagged`, top category and `usage`; all listed test cases pass (V2). Depends on T3. (12 tests pass without `.env`.)
- [x] T14 — `api/models/conferences.ts`, `api/routes/conferences.ts`, `api/routes/events.ts`: public conference responses omit `moderation` via `toApiConference`, so attendees cannot read a conference's context and criteria. Depends on T1. (Conference list, event and live-event responses.)
- [x] T5 — `api/middlewares/jwt.ts`: module-level JWKS cache with a 10-minute refresh used by `jwt()`; `optionalJwt()` that never rejects.
- [x] T6 — `api/models/questions.ts` and the list route: viewer-aware hidden filter in `getQuestions`, hidden filter in `getAllQuestions`, `createQuestion` fields, `optionalJwt()` on the list route. `api/routes/questions.ts`: drop `hiddenAt` and `moderation` from the four mutation responses. Depends on T1, T5.
- [x] T7 — `api/routes/events.ts` create route: conference lookup, config `safeParse`, classify when configured, insert, skip broadcast when hidden, info and warn logs, Sentry at most every five minutes, `{ data: { uid, question, createdAt } }` response. Depends on T4, T6. (Response uses `toPublicQuestion`, the same shape as the other question routes, without ids or moderation fields.)
- [x] T8 — `api/app/hooks/use-event-questions.ts` and `api/app/routes/QnA.tsx`: token-aware list hook for the Q&A page, live over SSE; the react package and the layout stay unchanged. Depends on T6. (Typecheck and lint clean.)
- [x] T9 — `api/scripts/moderation-eval.ts`: imports from `api/moderation.ts` and `classifyQuestion`, `{ error }` counted as a failure, case-file `moderation` replacing `conference`, per-file `gates`, `--baseline`, environment check first, `--out` guidance; convert `moderation-cases.json` and the private `prod-cases.json` (gates 10 of 13 and 0.001) to the new format; run V4 and V7. Depends on T4. (Committed cases exit 0; private set exits 0 with 10 of 13 hidden, 0 of 5,640 wrongly hidden, and all 5,674 scores identical to the baseline; V7 override run exits 0 with 40 of 41 and 0 of 57, an empty `none` text stops with a schema error before any API call.)
- [x] T12 — `README.md`: `OPENROUTER_API_KEY` in the optional variables table and a short "How do I enable moderation for a conference?" FAQ entry pointing to this plan's setup steps. Depends on T3.
- [x] T10 — `CLAUDE.md`: moderation rule, fail-open, per-conference config, Realtime filter, new secret; the eval as the gate for model, criteria, threshold and conference config changes; real attendee data never in the repository (Ground rules).
- [x] T11 — Run V1, V3, V5, V6 on the integrated change, with `api/scripts/moderation-eval.ts` and `moderation-cases.json` staged by path; scan the staged diff for secrets per CLAUDE.md. Depends on all above. (V1, V3 and the scans as before. V5 against a local server and a throwaway conference: 12 of 12 checks pass, including author-only visibility, presenter view, moderation page, clean upvote response and the anon-key Realtime policy. V6: without the key and with a null config, questions are stored unclassified and shown to everyone. Test conference, talk, questions and anonymous users deleted afterwards. The Q&A page itself was not checked in a browser.)
- [x] T13 — Hand the maintainer the environment setup commands for dev, then prod, with placeholders filled in locally only; these Fly, Supabase and OpenRouter changes are outside this implementation and need separate go-ahead. Depends on T11. (Commands handed over in the conversation, with real app names, not in the repository.)
