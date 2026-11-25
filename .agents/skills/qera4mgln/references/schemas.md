# Data contracts and CLI schemas

## Conversation

```json
{
  "messages": [
    {"role": "user", "content": "Report all production incidents for October."},
    {"role": "assistant", "content": "..."},
    {"role": "user", "content": "Include corrected severity levels and make a CSV."}
  ]
}
```

For mixed user requests with pasted untrusted sources, the host may add `"authenticated_user_requests": ["exact actual user instruction", ...]` at the top level; the faithfulness filter then grounds requirements **only** in those host-extracted instructions instead of the full user-message contents. This does not validate the boundary itself: the host must correctly separate requests from quoted materials.

This is **data** supplied to the optional text pipeline, not a tool-permission format. The host must maintain instruction precedence. For project files, add relevant excerpts to this JSON or have the host agent gather them directly. No implicit connector, retrieval or long-term memory is provided.

## Ask output / filtered contract

```json
{
  "requirements": [
    {"id": "R1", "user_quote": "make a CSV", "description": "Create a CSV of October production incidents", "kind": "artifact", "scope": "October, production incidents", "required_literals": [], "exclusions": [], "format": "csv", "format_quote": "make a CSV"},
    {"id": "R2", "user_quote": "corrected severity levels", "description": "Use latest corrected severities", "kind": "list", "scope": "incidents and all revisions", "required_literals": [], "exclusions": [], "format": "unspecified"}
  ],
  "information_needs": [
    {"id": "N1", "description": "All matching incident identifiers, timestamps, severities and later corrections", "type": "enumerate", "requirement_ids": ["R1", "R2"], "where": "incident log and correction threads"}
  ]
}
```

`user_quote` must occur literally (NFKC normalization, casefold and whitespace folding) in **some actual user turn**. User quotes provide mechanical grounding only; human/agent semantic review remains required. `required_literals` are dropped if absent from user text. Exclusions require objects `{ "term": "x", "user_quote": "exclude x" }`, with the quoted phrase in user text. Unrequested output formats and word limits are dropped unless `format_quote` / `max_words_quote` are grounded. A list/count/compute/summary/classification/timeline request receives an extra need if coverage is missing.

## Check output

```json
{
  "requirement_checks": [
    {"id": "R1", "status": "partial", "draft_quote": "", "problem": "CSV was never generated", "fix": "Create and verify actual file"},
    {"id": "R2", "status": "unknown", "draft_quote": "", "problem": "Corrected severities have not been fully verified", "fix": ""}
  ],
  "need_checks": [
    {"id": "N1", "status": "partial", "findings": [
      {"item_id": "INC-42", "value": "sev2", "quote": "INC-42 corrected severity: sev2", "location": "corrections.txt:14"}
    ], "stated_count": null, "calculation": null}
  ],
  "unsupported": [], "latent_gaps": [], "format_issues": [],
  "repair_plan": ["Include INC-42 with sev2"], "preserve": []
}
```

`audit` confirms a quote is present in the supplied conversation text; it cannot verify the meaning, authority or age of that quote. Audit recognizes `count`, `enumerate`, and arithmetic `sum`, `mean`, `average`, `count`, `difference`, `ratio`. For compute checks, each input has `value` and `quote`; recalculation requires that quotes appear in source text.

Audit returns `check_complete`, `missing_requirement_ids` and `missing_need_ids`. Every filtered requirement and information need must have one valid check entry. Missing entries, duplicate/unknown IDs, invalid status values or malformed collections produce warnings and make the check incomplete. Need entries must include a `findings` list (which can be empty). `unknown` is a valid status: `check_complete` means coverage of the check schema, **not** that the answer is correct or every need is resolved. Quote/evidence warnings remain separate from coverage.

The API runner returns `stage: "check_incomplete"` and preserves the draft when CHECK is incomplete; it does not request a repair from incomplete evidence. Deterministic measurement issues remain visible under `audit.actionable`. With complete coverage, `checked` remains a stage label, not a success verdict. These guarantees apply only to the filtered ASK contract; they do not prove ASK found every user requirement.

## CLI usage

The main entry is `scripts/qera.py`:

- `filter --conversation X --contract Y [--output Z]`
- `measure --draft FILE [--contract FILE] [--output FILE]`
- `audit --conversation X --contract Y --draft TXT --check JSON [--output Z]`
- `guard --conversation X --contract Y --draft TXT --candidate TXT [--open-world] [--output Z]`
- `demo [--output Z]`
- `run --conversation X --mode draft|adaptive|full [--api-base BASE] [--model MODEL] [--output Z]`

The CLI returns JSON, with process exit code 2 for invalid input/provider errors. By default, stdout contains the result; `--output` writes a private (0600 on creation) JSON file. When using `--output` on an existing file, review its existing permissions; avoid sharing raw private transcripts.

## Guard policy

Guard rejects an empty repair, disproportionate loss of prior answer text/number tokens, introduced years not present in supplied source when in `closed_world` mode, and newly broken required literal/exclusion/format constraints. It is intentionally conservative, incomplete and **not** an execution safety mechanism.

A grounded `min_words` constraint is enforced independently of draft character length or the presence of `max_words`: a repair cannot introduce a minimum-word violation or shorten an already under-length draft. Improving an already under-length draft is allowed, but does not establish that it now meets the minimum; `measure` reports any remaining violation. Word counts use the helper's Unicode word-token regex, not a language-specific tokenizer.
