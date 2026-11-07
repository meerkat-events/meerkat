# Automatic question moderation

> **Historical design record** (October 2026, PR #50 and its follow-ups). It
> records why moderation works the way it does; it does not describe the
> current code. Since then, browsers no longer use Supabase Realtime (live
> updates are SSE from the API, `api/realtime/`; migration
> `0014_drop_realtime_policies.sql` removed the Realtime policies and
> `api/scripts/supabase-policies.sql` is gone), the single `HIDE_THRESHOLD`
> became `MODERATION_THRESHOLDS`, and organizers and moderators now see the
> relevance score. For the current behavior see the code (`api/moderation.ts`,
> `api/classifier.ts`, `api/moderate-question.ts`) and CLAUDE.md
> ("Automatic moderation"). The sections on the state before the change, the
> implementation plan, the environment setup, the validation plan and the
> TODO list were removed; earlier versions of this file still have them.

- **Goal:** Questions that are harassment, hate speech, discrimination, phishing, scams or obvious shilling, politics with no relation to crypto outside talks about politics, current wars and genocide, threats, doxxing or explicit sexual content never reach the stage screen or other attendees. The author still sees their own question, so there is nothing to argue about or retry. Organizers get the last word later through a separate admin view.
- **Success criteria:**
  - S1: With moderation configured for a conference, a question the classifier flags is stored but absent from every public list, Realtime payload and the presenter view, while the author's Q&A page shows it like any other question.
  - S2: Without configuration, without an API key, or when the classifier errors or times out, questions are stored and shown exactly as today (fail open).
  - S3: The eval exits 0 on both case files with their own gates: the committed cases at least 80 % of must-hide cases hidden and at most 1 % of must-allow cases; the private labeled set from the Bangkok and Buenos Aires dumps at least 10 of 13 violations hidden and at most 0.1 % of the 5,640 kept questions.
  - S4: Policy and context can be changed per conference in the database without a deploy, and the eval can check a conference's config before it is enabled.

## Eval results

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
- Politics and war questions (added 2026-10-09, private set relabeled by the new rule): 15 of 18 violations hidden, including all 5 political ones, 0 of 5,635 kept questions hidden, category scores unchanged; invented cases 48 of 49 hidden (the miss: an election question in a talk on Latin American crypto regulation), 0 of 62 wrongly hidden. Requests are about twice as long (about 1,040 input tokens); p95 latency stayed at 337 ms.
- Safety question, refusals and fit score (added 2026-10-09): real questions 15 of 18 hidden, 1 of 5,635 wrongly hidden (the one refusal), category scores unchanged; invented cases 53 of 54 and 0 of 64, the 5 invented threat, doxxing and explicit cases refused or caught. Fit means: must hide 0.84, kept 2.45; picked by an MC 2.58, not picked 2.38. About 1,600 input tokens per request; p95 latency 345 ms, 2 of 5,674 calls over 1.5 s.
- Self-harm question, relevance rename, compliments allowed and hide threshold 0.5 (2026-10-10): real questions 12 of 15 hidden, 1 of 5,638 wrongly hidden (the refusal); invented cases 54 of 55 and 0 of 69, both self-harm cases caught, none of the compliment, banter, burnout or figure-of-speech cases hidden. About 1,820 input tokens per request; p95 latency 620 ms, 22 of 5,674 calls over 1.5 s.
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
| D5 | One `choice` question over `none` plus the six categories; hide when `1 - P(none) >= 0.5`. | Decisions models return probabilities per option that sum to 1, so a threshold is meaningful, and summing every harmful option catches questions split between two categories. `confidence` only measures how concentrated the distribution is. Separate yes/no questions per category were rejected as more answers to combine. The threshold was 0.6 until compliments became allowed (D15); the reworded harassment option moved two token shills to 0.57 and 0.58, and 0.5 again hides 12 of 15 real violations with no kept question hidden. |
| D6 | OpenRouter Decisions API via `fetch` with the dated snapshot `openai/gpt-6-luna-decisions-20261006`; model, timeout and threshold as constants; key as the only environment variable. | Requested. Returns validated typed answers, so no prompt or JSON schema is needed. Pinning the snapshot (accepted by the API, probed 2026-10-09) keeps behavior equal to the eval; the undated alias would follow OpenAI's updates silently. `typesafe/jev-1.13` is the only other decisions model and was not chosen. The SDKs were rejected because one `fetch` call is enough. |
| D7 | Feedback, thanks, compliments, jokes, blunt criticism, tests and duplicates are allowed; so are politics related to crypto and political questions in talks about politics. Politics unrelated to crypto elsewhere, and current wars, armed conflicts and genocide in any talk, are hidden. | Requested. Talks at these conferences are not about wars, so those questions never fit. |
| D11 | Politics and war are separate yes/no questions in the same request, with their own threshold of 0.7, not extra options of the category question. | Measured: a seventh option shifted probability away from the other categories and lost three violations; the separate questions left all 5,674 category scores unchanged. A single politics question either missed the target question in an ethics talk or hid on-topic questions in political talks; splitting off wars and genocide fixed both. |
| D12 | Threats, doxxing of third people and explicit sexual content are a third yes/no question (`safety`), not more text in the harassment description. | Measured: the longer harassment text lost two violations and hid two jokes; the separate question caught all invented cases and only the real bounty threat, with category scores unchanged. |
| D13 | A provider refusal ("refused to answer") hides the question and stores `{ refused: true }`; every other error still fails open. | OpenAI refuses only very harmful text, which fail-open would show. One real question in 5,674 was refused (a question about de-anonymizing child abusers). |
| D14 | A `relevance` score (0 to 4) for the conference, topic and speaker is asked in the same request and stored in `questions.moderation`, unused and unexposed. Each verdict also stores `decision`: hide, review or show. | Requested. Picked-by-MC rate rises from 22 % (relevance 0-1) to 36 % (3-4); tests, meme raids and solicitation score about 1 or lower. Speaker and description are given to this question only, keeping the other answers unchanged. A 0-10 or 0-100 scale would add no information: the score is already a continuous weighted average. A sentiment score was considered and left out: tone does not separate harm. The review band follows how other platforms moderate (approval queues, graded filters). |
| D15 | Compliments, including about looks, are allowed; harassment covers insults about looks, sexual remarks or advances and personal attacks. | Decided 2026-10-10. The three compliment questions in the private set are relabeled as allowed. |
| D16 | Categories stay as they are, plus a self-harm yes/no question; a redesigned taxonomy (merged categories, a short `none`, "Not:" boundaries per option, separate privacy and self-harm questions) was tested and rejected. | On real questions the redesign hid 9 of 18 violations and 10 kept questions, against 15 of 18 and 1 for this design; every taxonomy variant looked fine on the invented cases. Further wording rounds on 18 real violations would overfit; the next step is labeled data from the next conference. |
| D8 | No admin or organizer operations in this change. | Requested; another person builds the admin view. |
| D17 | Follow-up (2026-10-10, PR #40's management pages are the admin view): organizers see hidden questions with a summary of the verdict (decision, reasons that reached the review threshold, relevance; no raw scores), filter by auto-hidden and review, sort by relevance, and restore a question (`POST /api/v1/questions/:uid/restore`, `hidden_at` back to null, verdict kept). A hidden question can't be selected for the stage. Analytics shows hidden, review, restored and refused counts, hide reasons, and relevance per session and as a distribution. | Restoring by SQL (D8) doesn't scale to a conference week; keeping the verdict on restore makes "hide without `hidden_at`" the restored count, without a new column. Relevance is averaged over questions attendees saw, so spam doesn't drag it down. |
| D9 | Send only the conference's written context, the talk title and the question; criteria in plain text without examples. | Measured: speaker, track, type and description lowered scores on clear violations and raised jokes toward the threshold; examples raised latency without better results. Less data also leaves the system. |
| D10 | The eval gates every change to model, criteria, threshold or a conference's config; committed cases are invented, real ones stay private. | The model is deterministic, so differences are real. The repository is public and real questions contain personal data. |

## Risks and recovery

| Risk / failure mode | Impact | Mitigation and validation | Residual uncertainty |
| --- | --- | --- | --- |
| Legitimate question hidden | Lost until restored by SQL | Threshold chosen on all 5,640 kept questions, `none` criteria spelled out, log line per hide, verdict stored on the row | A new conference's written context or overrides can shift results; check them with the eval before enabling |
| OpenRouter or OpenAI slow or down | Posting up to 1.5 s slower, then unmoderated | Timeout, fail open, warn log per failure | The model has a single provider, so there is no fallback |
| Dead key or exhausted credits | Every question fails open | The warn log per question names the status (`HTTP 401`, `HTTP 402`) | Moderation is off until someone tops up |
| Alpha endpoint changes its contract | Every question fails open | Zod validation turns a changed shape into an error, which is logged and reported | Moderation is off until the code is updated |
| Manipulative question text | Wrong category | The model returns only option probabilities, the question is a field in `state`, the verdict only hides and never reaches clients | An attacker can at most hide or pass their own question |
| Hidden row reaches another client | Breaks S1 | Viewer filter in SQL, Realtime policy, moderation fields stripped from every response, `getAllQuestions` filtered | Future endpoints must reuse the filtered queries |
| Expired token on the list request | List must still load | `optionalJwt` falls back to anonymous instead of 401 | Author misses their hidden rows until the session refreshes, which changes the SWR key and refetches |
| JWKS fetch per list request | Extra latency and load on Supabase for every phone on every update | Module-level key cache shared by `jwt()` and `optionalJwt()` | A key rotation is picked up within 10 minutes |
| Non-English questions | Misses or false hides | Policy covers any language; committed eval has Spanish, Portuguese and Thai cases, all classified correctly | The one real non-English violation, a Spanish joke, was missed |
| Model snapshot retired | Requests fail and moderation fails open | Warn log per question; upgrading means a new constant and a passing eval | OpenRouter's retirement policy for alpha models is unknown |

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
| `harassment` | Insults, sexual remarks or advances, or personal attacks aimed at a speaker, attendee or named person, including insults about their looks, body or relationships. Compliments are not harassment. |
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

Yes/no ("noul") questions:

| Question | Instructions | Yes means |
| --- | --- | --- |
| `politics` | Does this audience question bring politics into a talk where it does not belong: party politics, elections, politicians, governments, wars or armed conflicts that have nothing to do with crypto or blockchains and nothing to do with the topic of the talk? | Political opinions or debates with no link to crypto, asked in a talk that is not about politics or society; framing it as ethics does not change this. No: crypto-related law, regulation, taxes or policy, and political questions in talks about politics, geopolitics, governance or society. |
| `safety` | Does this audience question threaten someone, expose a third person's private information, or contain explicit sexual content? | Threats or calls for violence, including implied ones; sharing or demanding a third person's private information (doxxing); explicit sexual content or propositions. No: these as topics, asking speakers about their own accounts, flirting without explicit content. |
| `self_harm` | Does this audience question express an intent to harm oneself or encourage someone else to? | Says the writer intends to hurt or kill themselves, or urges or instructs anyone to self-harm. No: burnout, stress or mental health as a topic, figures of speech, untargeted dark jokes. |
| `war` | Does this audience question bring up a current war, armed conflict or genocide? | Raises, debates or takes sides in an ongoing or recent war, armed conflict or genocide, or refers to its victims, in any talk and framing. No: historical wars as analogies, war-room exercises, hacks, and using crypto to help people affected by a conflict. |

Relevance question (`buildRelevanceQuestion`), a score from 0 to 4: "How relevant is this audience question to the conference, the talk's topic and its speaker?", followed by the speaker and up to 500 characters of the talk description. Levels: unrelated; loosely related to the conference; related to the talk's topic; specific to this talk or speaker; excellent.

Example `conferences.moderation`: `{ "context": "Devconnect ARG 2025 in Buenos Aires, an Ethereum developer conference. Talks are in English and Spanish. Speakers are often well-known people in the Ethereum ecosystem." }`
