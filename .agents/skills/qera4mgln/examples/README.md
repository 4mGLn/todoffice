# Offline deterministic demonstration

Run from a project with the skill installed:

```sh
python3 .agents/skills/qera4mgln/scripts/qera.py demo
```

The fixture intentionally contains an *ungrounded* requirement `R-BAD`, which the filter drops. The draft has a TPS arithmetic error (100 instead of 104). The audit reports requirement gaps and recalculates (520 / 5 = 104). The guard accepts the local repaired answer. The example does **not** call a model or actually execute PostgreSQL queries.

Caution: a sourced quote can establish where numbers appeared, not that a model correctly transformed them into delta values; that semantic link still requires review.
