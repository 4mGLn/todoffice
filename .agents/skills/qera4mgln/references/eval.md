# A/B evaluation harness

`scripts/qera_eval.py` compares a direct answer (`vanilla`) with QERA arms (`draft`, `adaptive`, `full`) on the same tasks, scored by an LLM rubric judge. Same transport and model for every arm; the only difference is the pipeline.

## Task file
```json
{"tasks":[{"id":"t1","conversation":{"messages":[{"role":"user","content":"..."}]},
           "rubrics":["The answer states ...","The answer excludes ..."]}]}
```
Solved = every rubric passes (CL-bench style). Write rubrics from the user's real requirements, ideally including implicit ones (corrections, exclusions, totals), since that is where the paper reports the gain. Example: `examples/eval/tasks.example.json` (one toy task, for smoke tests only).

## Run
```bash
export QERA_API_BASE=... QERA_MODEL=... QERA_API_KEY=...                 # generator
export QERA_JUDGE_API_BASE=... QERA_JUDGE_MODEL=... QERA_JUDGE_API_KEY=... # judge (use a different model)
python3 scripts/qera_eval.py run --tasks tasks.json --results out/r.jsonl --arms vanilla,draft,full
python3 scripts/qera_eval.py report --tasks tasks.json --results out/r.jsonl --arms vanilla,draft,full
```
Add `--repeats N` (default 1) to both `run` and `report` to run each task/arm N independent times; use the same N for `report`.
`run` is resumable: finished task/arm/repeat triples are skipped **only when their evaluation identity matches**; raising N later only runs the missing repeats. Each result binds the conversation (including any authenticated request boundary) and rubrics to a SHA-256 fingerprint and records generator/judge models, endpoints, temperature, `--judge-context`, and a fingerprint of the runner, audit/guard implementation and effective prompts. API keys are never part of this metadata. Report bootstrap seed, timeout and repeat count do not invalidate the identity.

Before making calls, `run` checks the existing file for changed task inputs, changed configuration or mixed configurations. A mismatch exits with code 2 and leaves the results untouched; choose a **new `--results` path** for the changed experiment. `report` also rejects changed task inputs, stale implementation/prompts, mixed configurations and invalid rubric-result counts. It uses the recorded model configuration, requires no provider environment or network calls, and prints the recorded model names; use the same `--judge-context` flag as the run.

Result lines carry a `repeat` index; a missing index is still read as repeat 0. **Legacy results without evaluation fingerprints cannot be resumed or reported by this version.** Keep those files for inspection or report them using their original code and task inputs; rerun into a new file to obtain results with provenance. A fingerprint records local inputs/configuration, not provider weights: a provider can change the backend behind an unchanged model name.

Results hold full answers, so the file is created 0600. Custom in-process adapters must expose `model` and `url`; their `temperature` defaults to 0 when absent, and any custom behavior beyond these fields must be reflected in a distinct model identity.

## Reading the report
- Reported only over tasks scored for **all** requested arms **and all N repeats** (paired).
- Per-arm `solve`: mean of the per-repeat solving rates over the paired tasks, with `SD` = sample SD (n-1) of those N per-repeat rates (shown only when N >= 2). The SD measures generation + judge noise only (both are re-sampled each repeat); it says nothing about which tasks were chosen.
- The statistical unit is the **task**. Per task and arm, solve = mean over repeats of "all rubrics passed" (in [0,1]); the arm difference is the per-task difference of these means.
- `solving_ci95`/`rubric_ci95`: paired bootstrap, 10,000 resamples **of tasks**, on the repeat-averaged per-task differences. Repeats are never treated as extra tasks: that would shrink the CI by ignoring that repeats of one task are correlated (task difficulty).
- `p`: exact two-sided sign test on the sign of the per-task mean difference (ties dropped), so n is at most the number of tasks. `majority W/L`/`p`: same test on per-task majority outcomes (solved in strictly more than half the repeats); coarser, more robust to a single noisy repeat.
- Repeats make the estimate of each task's solve probability less noisy; they cannot create new tasks. Significance still scales with the number of tasks.
- `~tok` is chars/4, not provider usage; use it for relative cost only.
- Generation or judge errors are counted, never silently replaced by a fallback answer. A task with a judge error is excluded from pairing.
- Under 30 paired tasks the report warns: treat as anecdotal.
- Default is a single run, which gives no variance estimate. temperature=0 does not make hosted APIs deterministic (OpenAI's documentation states determinism is not guaranteed even with `seed`; mixed-precision/batching/backend changes cause drift), so repeats are meaningful even at temperature 0. With N=1 the SD is not computed.
- No `--temperature` option: the CLI uses `qera_run.ChatAdapter.temperature = 0` in the payload. The effective adapter temperature is recorded in the evaluation identity. CLI repeats therefore sample only the provider's residual nondeterminism, not deliberate sampling diversity.

## Limits
Judge bias (use a different, ideally stronger model; self-judging favors the generator), small samples, rubric quality, and one model per run. Agentic tool tasks are out of scope: the harness measures text answers only.

## Rubric design
- Paper (arXiv 2610.35083v2, section 3.1 / Appendix F): a rubric is *explicit* when at least 60% of its content words occur in the final request, else *implicit*; 82% of CL-bench Life rubrics are implicit; QERA's gain is reported on implicit rubrics, with ties on explicit ones. A task set with few implicit rubrics therefore has little room to show an advantage.
- Lint your tasks first: `python3 scripts/qera_rubric_lint.py tasks.json -v`. It prints the implicit share per set and per task and warns below 50% (our threshold: below half, the set is dominated by the category where the paper sees no gain). The tokenization, stopword and boilerplate choices are our assumptions where the paper is silent (see the script docstring); the lint is a proxy and is not validated against the paper's data.
- Keep the final user turn short and put corrections, exclusions, totals and committed verdicts earlier in the conversation, so rubrics about them share few words with the request. Example: `examples/eval/tasks.implicit.example.json` (synthetic).
- Scope: the harness never executes tools; only the final text answer is judged. Tasks whose success depends on side effects (files written, commands run, API calls, state changes) or on tool-call correctness are mis-scored: a text claim of success passes, the real effect is never checked.

## CL-bench-Life data
`python3 scripts/clbench_convert.py CL-bench-Life.jsonl -o tasks.json [--subset TEXT] [--limit N]` converts the public JSONL (`messages`, `rubrics`, `metadata`) into this harness's format. The schema was verified from the dataset card, repo README and the official `eval.py`, but the converter has only run on synthetic fixtures, never on a real CL-bench-Life file; check a few converted tasks by hand first. The dataset (`tencent/CL-bench-Life` on Hugging Face) carries an evaluation-only license: no training, fine-tuning or distillation. The official judge (gpt-5.1) sees only rubrics and the model output; sources disagree on rubrics per task (README ~10.7, card/paper ~13.2).

## Security notes (fixed after HTTP-path testing)
The adapter does not follow redirects (so keys and conversations are not replayed to another host), wraps timeouts/connection errors as clean errors, and never puts the key in error text. The judge key is reused from the generator only for the same endpoint. Judge verdicts must be unambiguous booleans or clear yes/no strings; anything else is retried once, then recorded as a judge error. Not covered: streaming, `tool_calls` content, 429/5xx retries, HTTPS/TLS, proxy env vars.

## `<|TASK|>` split and lint calibration (checked on real CL-bench-Life)
- Every one of the 405 tasks contains `<|TASK|>` (context before it, request after). `clbench_convert.py` now adds `conversation.authenticated_user_requests` (per user message, the text after the last delimiter; `--no-split` disables it). QERA arms then ground requirements only in those words, so pasted context cannot create "user" requirements. Median user text shrinks from ~43k to ~650 chars. The `vanilla` arm receives only `messages`, never this field, so the baseline gets no extra structure. This mirrors, but is not identical to, the paper's rule (messages over 4,000 chars: last 2,000 chars read as the request); the paper's rule was not reproduced exactly.
- `qera_rubric_lint.py` takes the request as the text after the last delimiter (`--request-mode full` for the whole message). On the real data: whole message 1,978 explicit / 3,356 implicit (63% implicit); after the delimiter 938 / 4,396 / 14 left out (82.4%); the paper reports 981 / 4,352 / 15 (82%). A ~1% residual (43 rubrics) remains; its cause is unknown. Calibration used these three aggregate numbers only, so do not read it as a validated reimplementation.

## Judge input
By default the judge receives only the rubrics and the response (as the official CL-bench `eval.py` does), not the conversation; this cut the estimated input for 5 tasks x `vanilla,draft` from ~710k to ~430k tokens (chars/4 estimate, not measured). Pass `--judge-context` if your rubrics depend on the conversation text.
