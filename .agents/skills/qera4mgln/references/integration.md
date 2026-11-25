# Integration with any Agent Skills-compatible host

## Project installation

The repository keeps the skill at `skills/qera4mgln/`. Install it with the repo's `install.sh` (see the repository README), which copies it into `~/.claude/skills/` and `~/.agents/skills/` or into a project. Hosts that index Agent Skills can discover the metadata and read the skill when relevant.

```bash
./install.sh --project /path/to/my-project   # -> .claude/skills and .agents/skills in the project
./install.sh                                  # user level: ~/.claude/skills and ~/.agents/skills
```

The installer refuses to overwrite an existing skill. For hosts without automatic `.agents/skills/` discovery, copy the skill directory to the host's documented skills path or point the host to `SKILL.md`. The skill **format** is portable; automatic discovery location varies by platform/version.

## Optional text-only API driver

```bash
SKILL=/path/to/my-project/.agents/skills/qera4mgln
export QERA_API_BASE='https://provider.example/v1'
export QERA_MODEL='provider-model-name'
export QERA_API_KEY='your-secret-in-environment'
python3 "$SKILL/scripts/qera.py" run --conversation "$SKILL/examples/conversation.json" --mode draft
```

- Provider must offer an OpenAI-compatible chat/completions endpoint; this is a protocol assumption, not a claim of compatibility with every model.
- `--mode draft` uses two model calls; `full` uses ASK + ANSWER + CHECK + conditional REPAIR; `adaptive` checks on complex list/count/compute/summary/classification/timeline tasks.
- Input JSON may contain private information. Do not send it to an untrusted provider. CLI doesn't execute tools.

## PAI / orchestration integration (illustrative)

```
user -> memory/retrieval -> QERA ASK -> scope/policy review -> planner
                                        |                   |
                                        +--- contract ------+-> host tools
                                        |                       |
                                        +-> evidence audit <----+-> observations
                                                          -> final deliverables
```

Suggested normalized events:

```json
{
  "task_id": "task-001",
  "requirements": [{"id": "R1", "user_quote": "...", "description": "..."}],
  "information_needs": [{"id": "N1", "type": "enumerate", "requirement_ids": ["R1"]}],
  "execution": [{"action": "run tests", "authorized": true, "result": "exit=0"}],
  "evidence": [{"need_id": "N1", "source": "verified-tool-result", "location": "..."}],
  "artifact_checks": [{"path": "...", "exists": true, "sha256": "..."}]
}
```

PAI tool authorization, provenance validation, memory access, resource budgets, Agent handoffs and approval workflows remain outside the scope of this skill. Do not infer implementation completeness from this diagram.

## Portable path choices

- Codex and other `.agents/skills`-aware clients: `.agents/skills/qera4mgln`.
- Claude Code: may use `.claude/skills/qera4mgln` if `.agents/skills` is not discovered in your version.
- Other clients: consult actual installed host documentation and copy or reference the same directory; do not duplicate divergent skill sources.

## Offline operation

`demo`, `filter`, `measure`, `audit`, `guard` and unit tests run offline with Python 3.10+. The `run` command only works when you configure a supported model endpoint and networking is available.
