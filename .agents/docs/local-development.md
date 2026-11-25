# Local TodOffice development

This guide describes the repository layout as of 2026-11-25. The project directory is the root of both the Git repository and the npm workspace. Run commands here without an intermediate `app/` directory. The original instructions from before the move are archived in `.analysis/layout-migration/originals/` under `.agents/`.

```bash
git status --short --branch
npm ci
npm run build:all
npm run dev
```

Dependencies were already installed in this workspace, so `npm ci` was not rerun after the move. See the root `package.json` and `.nvmrc` for the required Node and npm versions. For native engines and distribution prerequisites, see the [product operations guide](../../docs/operations.md).

- Product code and documentation: `apps/`, `packages/`, `docs/`
- GitHub automation: `.github/`
- Linux distribution files: `apps/shell/release/`
- Analysis and verification records: `.agents/.analysis/`
- Workspace reports: `.agents/docs/`

The move preserved the `product/main` branch, the original Git history and the staging state. The [previous workspace README](workspace-readme-before-layout.md) and archived records document the remotes and baseline commit at the time. Use Git to check current values. The move itself did not include a commit, push or creation of a GitHub repository.

```bash
git branch --list
git remote -v
npm run test -w @genoffice/i18n
npm run typecheck -w @genoffice/ui
```

Use the updated local helper to record a new check. Choose a fresh label and preserve existing logs.

```bash
python3 .agents/.analysis/ui-compact/run-check.py my-new-check npm run test -w @genoffice/i18n
```

In historical logs, `~/Projects/todoffice/app` corresponds to the current repository root. The commands and hashes in those logs describe the original runs.
