# Changelog

## Unreleased

- Fall back to plain file copies when Linux network mounts reject the platform copy operation. This covers shared atomic writes and copying images into HTML and Markdown document asset folders.
- Improve DOCX compatibility with custom XML wrappers, literal dollar sequences in list labels and shape text, and images inserted into headers and footers.

- Add draft translations of all 27 help topics in Mongolian Cyrillic and traditional Mongolian script.

- Add desktop installers for the latest stable GitHub release and installation instructions in Mongolian, English, and Korean.

- Show the TodOffice project license first in the About notices.

- Name the Linux AppImage `todoffice-<version>.AppImage` and match the installation help.

- Carry the Vermilion identity into document, menu and attachment icons.

- Adopt the Vermilion wordmark and symbol for the sidebar, application icons and AI entry points.

- Consolidate the shipped TodOffice CLI skill source under `.agents/skills/todoffice/`.

- Add shared A2A delegation and upstream maintenance skills and a repeatable Agent Skills validation command.

- Move release guidance into the shared TodOffice skill and distinguish local packaging from public distribution.

- Add repository verification and QERA skills and an optional A2A 1.0 peer adapter for project agent sessions.

- Promote the app checkout to the repository root, retain Git history and local changes, and relocate workspace-only reports and analysis under ignored `.agents/`.
- Wait for fonts and the visible pagination layout before measuring vertical text in the native regression check.

- Start new Mongol bichig Docs drafts in true vertical section layout and retain that direction in saved DOCX files; keep existing-file direction unchanged.

- Keep Bold, Italic, Underline and other formatting glyphs upright inside the Mongol bichig interface.
- Reduce editor rails to 192px, or 172px in narrow windows; correctly reclaim the panel width when collapsed.
- Standardize icon controls and split Paste sizing, compact Home cards and fix vertical filter-chip and logo overflow.

- Regularize Mongol bichig home tiles, ribbon rails and Settings cards; keep inputs and paths inside their controls.
- Use English-sound Mongol bichig spellings for specialist menu names instead of forced literal translations.
- Add 229 contextual traditional-script translation drafts for primary interface names, with separate draft coverage and pinned spelling provenance in distribution notices.

- Add separate Mongolian Cyrillic and Mongol bichig interface previews with source-backed terms, visible English fallbacks and a strict missing-translation inventory.
- Add vertical Mongol bichig application chrome while keeping document writing direction a separate setting.
- Add explicit Docs section direction, frame/cell support and bundled Noto Sans Mongolian with Unicode-control and supplementary birga preservation checks.
- Validate script-specific help content and show explicit horizontal English fallback for untranslated manuals.

- Rebrand the desktop app, installers, icons, CLI, MCP registrations, agent skill and local data paths as TodOffice.
- Disable upstream product service links and update feeds until TodOffice endpoints are configured.
- Preserve upstream license notices and internal namespaces for selective synchronization.
- Build local DEB/RPM packages without advertising a fabricated or upstream homepage.
