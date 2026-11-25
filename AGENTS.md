# TodOffice

TodOffice is a desktop office suite for opening and editing Word, Excel, PowerPoint, PDF, Markdown, HTML and Hangul (HWP) documents in one window. It also edits mind maps (XMind `.xmind` files) and diagrams (draw.io `.drawio` files). AI can edit documents directly. The app is distributed free of charge for anyone to use, regardless of profession.

AI features use the user's existing **Claude or ChatGPT subscription**. The Claude and Codex integrations launch the respective vendor's program installed on the user's computer to obtain one response at a time. The app can also sign in to OpenAI directly through its official flow and use the user's ChatGPT plan (decision 0081). The app applies the document edits. Use a separately billed connection only when the user explicitly selects it.

TodOffice runs locally for one person on their own computer. It has no server, product accounts or usage telemetry. It is a fork of the open-source GenOffice project (Apache-2.0) and selectively incorporates upstream document-engine improvements. Keep internal names intact and limit changes to what the task requires. Windows is the primary distribution target. macOS (Apple silicon and Intel) and Linux (x64) are beta targets (decisions 0031 and 0065). The repository maintainer relies on user reports for macOS and Linux verification. The interface has 22 languages.

## Repository layout (2026-11-25)

This directory is the root of both the Git repository and the npm workspace. Run Git and npm commands here. There is no separate `app/` directory. Product documentation is in `docs/`, editors in `apps/`, and shared code in `packages/`. Analysis and work reports from the previous workspace are in `.agents/.analysis/` and `.agents/docs/`. The repository tracks `.agents/skills/` and the local development guide at `.agents/docs/local-development.md`. Absolute paths in logs from before the move are historical records. Use a fresh check for current verification.

## Development workflow

- Read the `AGENTS.md` closest to the directory you are working in and the task-specific documents below. See `docs/repository-layout.md` for the layout and development commands.
- For tasks spanning several requirements, files or revisions, use `.agents/skills/qera4mgln/SKILL.md` to connect each requirement to its evidence and verification result. Use the optional API runner only when the user specifically asks for it.
- Before reporting completion, use `.agents/skills/verify-work/SKILL.md` to check the entry points affected by the change. Keep repository skills in `.agents/skills/`, the source of the distributed CLI skill in `.agents/skills/todoffice/`, and the app's built-in skills in `apps/shell/resources/builtin-skills/`.
- After changing a skill, run the official validator with `npm run check:agent-skills`. Installation instructions are in `docs/repository-layout.md`.
- Follow `.agents/skills/a2a-delegation/SKILL.md` when discovering A2A peers, delegating work or retrieving results.
- Before importing external code or skills, read `.agents/skills/upstream-maintenance/SKILL.md` for provenance, licensing and compatibility checks.

## Mandatory rules

1. **Leave subscription login credentials alone.** Never write code that reads, copies or stores the Codex login file (`~/.codex/auth.json`) or Claude's credential store, including during testing and debugging. Do not add Claude or ChatGPT login forms to the app or modify either vendor's program. The sole exception is the direct ChatGPT connection (decision 0081). The app registers with OpenAI in its own name, receives its own token through the system browser and stores it sealed. This flow uses the app's own credentials.
2. **Never switch an AI conversation to a separately billed connection automatically.** Use an API-key provider or a metered login for conversation only when the user explicitly chooses it. If the chosen connection is blocked, stop and tell the user.
3. **Launch subscription programs without a shell, disable every tool the app can disable, and ensure the programs exit with the app.** For Claude, proceed only if the tools the program reports exactly match the expected set. Ordinary chat and model listing require zero tools. A document-editing turn permits only `StructuredOutput`, which defines the response format the app accepts (decision 0082). Confine Codex's built-in tools that cannot be disabled to read-only access. Launch the actual executable directly. On cancellation or shutdown, terminate the entire process tree.

   Two exceptions apply to tool access. In agent mode (decision 0032), enable only the designated tools in the project folder the user selected. Verify the reported set and route every permission request through the app's `agentPolicyVerdict` or a human decision. For that session, the allowed set includes tools the app relays from user-approved MCP servers (decision 0100). A disposable Codex thread for generating a single image may enable the image tool alone (decision 0145). All other chat restrictions apply. Keep the default AI window's tool set intact. Both exceptions still require a direct launch without a shell, a sanitized environment and termination of child processes.
4. **Preserve document-engine behavior and identifiers stored in documents.** Save and export results must match upstream, and documents must remain interchangeable with the upstream application.
5. **Preserve internal names and upstream registrations on the user's computer.** Keep `@genoffice/*` and `GENOFFICE_*`. Never read or modify the `genoffice` command or `~/.genoffice`. Retain `LICENSE`, `NOTICE` and attribution.

See `docs/standards.md` for the full rules and `docs/security.md` for the security policy.

## Before starting a task

Always read `docs/standards.md`, `docs/engineering-notes.md` and the `AGENTS.md` for the module you will change.

| Task | Read first or action required |
| --- | --- |
| Change subscription integration, including program launch, status detection or environment variables | Read all of `docs/security.md`, `packages/ai-provider/AGENTS.md` and the [subscription programs section](docs/engineering-notes.md#구독-프로그램). |
| Change provider selection or how the AI window sends requests and handles blocked requests | Read [provider selection](docs/business-rules.md#제공자-선택), [checks before sending](docs/business-rules.md#보내기-전의-문지기-모든-편집기-공통) and [handling a block during execution](docs/business-rules.md#실행-중-막혔을-때). |
| Change an editor's main process (`apps/*/src/main`) or preload | Read [build and run](docs/engineering-notes.md#빌드와-실행). Rebuild the desktop shell for the changes to take effect. |
| Add or edit interface text or help | Read [writing and languages](docs/standards.md#글과-언어) and [product names](docs/standards.md#제품-이름). Provide text in all 22 languages, including Turkish (`tr`). |
| Change interface styles | Read [interface colors](docs/standards.md#화면-색). |
| Add icons or artwork, or display another company's name | Read [trademarks and icons](docs/standards.md#상표와-아이콘) (decision 0052). |
| Change CLI commands, MCP or skills | Read `docs/contracts.md`. External callers depend on output structures and names. |
| Change masking or text extraction when a file is read outside its own editor | Read [document content](docs/security.md#문서-내용) and `packages/file-parse/AGENTS.md`. |
| Change how mind maps open or save | Read `packages/xmind-engine/AGENTS.md`. Saving an unchanged file must preserve the original bytes. |
| Change the diagram editor or bundled draw.io | Read `apps/diagram/AGENTS.md`, `vendor/drawio/README.md` and decision 0103. |
| Add a setting or change how settings are read | Read the settings sections in the [engineering notes](docs/engineering-notes.md#설정-파일) and [contracts](docs/contracts.md#설정-파일-ai-settingsjson). |
| Import an upstream change | Read [importing upstream improvements](docs/operations.md#원본의-개선-받아오기). Run `npm run check:no-genspark` afterward. |
| A document-engine package appears to need changes | Stop and ask a human. Read the package's `AGENTS.md`. |
| Change agent mode, which enables tools in a subscription program | Read `docs/tracking/decisions/0032-agent-mode-in-project-folder.md` and the [agent mode security policy](docs/security.md#에이전트-모드-결정-0032-0049). |
| Test AI with a real subscription | Read [testing with a real subscription](docs/operations.md#실제-구독으로-확인하기). This consumes the user's quota. |
| Publish a new version | Check the publication target, build and verification procedures in `.agents/skills/release-todoffice/SKILL.md` and `docs/todoffice-branding.md`. |

## When something goes wrong

**Notify a human immediately** in any of the following situations. Do not quietly fix the problem and continue.

- You find code that accesses a subscription login file or credential store.
- A request used, or could use, a billing route the user did not choose (an API-key provider or metered login).
- Claude ran with tools enabled, or a subscription program remained running after the app exited.
- Content hidden by masking was sent to a provider.
- Save or export results changed, or the app cannot open a document created by the upstream program.
- Something read or modified an upstream registration on the computer (the `genoffice` command or `~/.genoffice`).
- Tests or verification repeatedly consumed the user's subscription quota.
- A change requires interpreting terms of service, such as using a subscription through a new route or using either vendor's name or logo.

For other problems, first try to resolve them. If you cannot resolve one now, record the conditions under which it occurs, what you observed, why it matters and why it remains unresolved in `docs/tracking/findings.md`.
