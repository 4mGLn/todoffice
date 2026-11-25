---
name: verify-work
description: Verify a TodOffice change before reporting completion. Use for fixes, feature additions, or claims about generated documents and native editor behavior.
---

Read the affected module's AGENTS.md. Identify the public entry point and the observable outcome requested. Run the closest regression test with the current working tree. For document writes, reopen the output and check the changed content. For a UI claim, exercise the interaction in the named runtime or record the missing runtime check. Record the command, result and evidence boundary. After a repair rerun the affected check and review the diff for unrelated changes.
