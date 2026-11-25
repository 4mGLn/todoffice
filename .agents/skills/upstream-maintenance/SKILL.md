---
name: upstream-maintenance
description: Use when selecting GenOffice changes or importing an external skill, tool, or document asset into TodOffice. Covers provenance, local adaptations and compatibility checks.
---

# Bring an upstream change into TodOffice

Read the upstream section of `docs/operations.md` and the destination module’s AGENTS.md. Identify the source revision, relevant files and user-visible behavior. Inspect the local diff first, including untracked files in the destination.

- Compare existing implementations and select the smallest change that supplies the required behavior. Preserve local product identity, persisted format identifiers and existing project rules for document-engine changes.
- For copied material, inspect the license at the selected revision. Keep the required notices and record source path, revision, local destination and local adaptations beside the imported material or in its existing provenance record.
- Run the upstream regression case through the local entry point and the closest local compatibility test. For a shared skill, run `npm run check:agent-skills`; for an upstream product change, also run `npm run check:no-genspark` as prescribed by operations.
- Report the selected revision, the local behavior tested, and any differences requiring a native application or release build to verify.
