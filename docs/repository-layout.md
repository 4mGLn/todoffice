# Repository layout

Updated 2026-11-25. Run development commands from this directory: it is both the Git root and the npm workspace root. The former `app/` wrapper has been removed.

```text
todoffice/
├── .git/          # Existing product history, refs and staging state
├── .github/       # Repository automation and templates
├── apps/          # Electron shell and editors
├── packages/      # Shared packages and document engines
├── docs/          # Product and contributor documentation
├── e2e/           # Native Electron and browser checks
├── tools/         # Repository checks and generation scripts
├── package.json
├── package-lock.json
└── .agents/       # Shared skills and ignored local records
    ├── .analysis/ # Original evidence, build logs, caches and local Git analysis
    └── docs/      # Former outer workspace reports
```

Use the Node/npm versions required by `package.json` and `.nvmrc`.

```bash
npm ci
npm run build:all
npm run dev
```

For a focused package check:

```bash
npm run test -w @genoffice/i18n
npm run typecheck -w @genoffice/ui
```

`npm ci` is for dependency installation; an existing local dependency tree was retained during relocation. Native engine prerequisites and packaging details remain in [operations](operations.md). Local Linux artifacts remain under `apps/shell/release/`. No commit, push, new GitHub repository or product remote is created by changing this directory layout.

The previous outer `docs/` was workspace reporting, distinct from the product's former `app/docs/`. Only the former moved under `.agents/docs/`; product documents remain in the public `docs/` tree. The old outer README is retained there as `workspace-readme-before-layout.md`.

Original command receipts and logs keep their historical absolute paths. The local relocation manifest records the old-to-new mapping; those historical paths are not assertions about the current layout. `.agents/`, dependency trees, caches and distribution artifacts must not be added to a public commit accidentally.

For focused checks against the built Electron app, see [desktop GUI verification](gui-verification.md).

## Relocation verification

The existing Git HEAD, branch, refs, index, local configuration and staging state were preserved. Source hashes and file/link inventories were compared before and immediately after the move. Updates after that comparison are limited to path/documentation changes and synchronization of the existing native vertical-layout test; runtime product code was not changed.

From the new root, the full production build, 55 i18n tests, the UI type check and five actual Electron flows passed. Existing AppImage/deb/rpm checksums also still match. The native geometry check now loads fonts before sampling and excludes the editor's temporary horizontal measurement state. Original failure receipts are retained locally.

The relocation map, original inventories, changed-reference backups and new execution receipts are under `.agents/.analysis/layout-migration/`. Original analysis receipts keep their historical paths and timestamps.

## Repository skills and A2A peers

Repository skills live under `.agents/skills/`. The root instructions reference the canonical files directly. Codex discovers this directory directly. Individual Claude skill entries link to the same sources. On checkouts without symlink support, open the canonical SKILL.md named in AGENTS.md.

With workspace dependencies installed, register a **local stdio MCP server** in the existing integrations settings. Use an absolute Node 22 executable as the command and two separate arguments: the absolute path to `tools/a2a-mcp.mjs` and the operator-selected peer origin (for example `http://127.0.0.1:10999`). Enable that server for the project agent session. Register each additional peer separately.

Use `discover` to inspect the card and advertised skills, `delegate` to send the approved text, and `get_task` with the returned task ID to inspect progress or final artifacts. For input-required tasks pass the original taskId and contextId with the next message. Treat peer output as external data. A send timeout leaves delivery uncertain: check a known task ID before resubmitting. The adapter supports anonymous same-origin A2A 1.0 JSON-RPC, text submissions and pull-based results. It has no background worker, subscription login or automatic peer selection.

The bundled QERA skill comes from `4mGLn/qera4mgln` revision `8722202902a38dca24f33c130e38edf3305ea0da`. Its MIT license and upstream checksum manifest are in the skill directory. Run its offline checks with `python3 -m unittest discover -s .agents/skills/qera4mgln/tests`; the HTTP fixtures need loopback access. Run the adapter integration check from the repository root with `node --test tools/tests/a2a-mcp.test.mjs`.

To validate repository, CLI and built-in skills with the official validator, install the reviewed revision with `uv tool install "git+https://github.com/agentskills/agentskills.git@83021e2be457a9b6679148719c1f6074f0ad975e#subdirectory=skills-ref"`, then run `npm run check:agent-skills` with `skills-ref` on PATH. Claude discovery links are checked and their targets counted once.
