#!/usr/bin/env python3
"""CLI for QERA-inspired Agent Skill: filter, measure, audit, guard, run, demo."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from qera_core import audit, filter_contract, guard, measure, read_json
from qera_run import ChatAdapter, run_pipeline

ROOT = Path(__file__).resolve().parent.parent


def text_file(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def emit(obj: dict, output: str | None = None) -> None:
    content = json.dumps(obj, ensure_ascii=False, indent=2) + "\n"
    if output:
        path = Path(output)
        path.parent.mkdir(parents=True, exist_ok=True)
        # Private by default: contracts may contain sensitive user context.
        flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
        fd = os.open(str(path), flags, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(content)
    else:
        print(content, end="")


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Vendor-neutral QERA-style evidence reasoning skill")
    commands = p.add_subparsers(dest="command", required=True)
    f = commands.add_parser("filter", help="Ground Ask output in user quotes and complete coverage")
    f.add_argument("--conversation", required=True)
    f.add_argument("--contract", required=True)
    f.add_argument("--output")

    m = commands.add_parser("measure", help="Measure deterministic text constraints")
    m.add_argument("--draft", required=True)
    m.add_argument("--contract")
    m.add_argument("--output")

    a = commands.add_parser("audit", help="Verify literal source quotations, sets and arithmetic")
    a.add_argument("--conversation", required=True)
    a.add_argument("--contract", required=True)
    a.add_argument("--draft", required=True)
    a.add_argument("--check", required=True)
    a.add_argument("--output")

    g = commands.add_parser("guard", help="Compare repair with draft; reject obvious regressions")
    g.add_argument("--conversation", required=True)
    g.add_argument("--contract", required=True)
    g.add_argument("--draft", required=True)
    g.add_argument("--candidate", required=True)
    g.add_argument("--open-world", action="store_true", help="Allow years not present in source")
    g.add_argument("--output")

    r = commands.add_parser("run", help="Optional model-backed text pipeline via OpenAI-compatible API")
    r.add_argument("--conversation", required=True)
    r.add_argument("--mode", choices=["draft", "full", "adaptive"], default="adaptive")
    r.add_argument("--model", default=os.environ.get("QERA_MODEL", ""))
    r.add_argument("--api-base", default=os.environ.get("QERA_API_BASE", ""))
    r.add_argument("--timeout", type=int, default=90)
    r.add_argument("--open-world", action="store_true")
    r.add_argument("--output")

    d = commands.add_parser("demo", help="Run the bundled deterministic fixture without API")
    d.add_argument("--output")
    return p


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        if args.command == "filter":
            result = filter_contract(read_json(args.conversation), read_json(args.contract))
        elif args.command == "measure":
            result = measure(text_file(args.draft), read_json(args.contract) if args.contract else {})
        elif args.command == "audit":
            result = audit(read_json(args.conversation), read_json(args.contract),
                           text_file(args.draft), read_json(args.check))
        elif args.command == "guard":
            result = guard(read_json(args.conversation), read_json(args.contract),
                           text_file(args.draft), text_file(args.candidate),
                           closed_world=not args.open_world)
        elif args.command == "run":
            adapter = ChatAdapter(args.model, args.api_base, os.environ.get("QERA_API_KEY", ""),
                                  timeout=args.timeout)
            result = run_pipeline(read_json(args.conversation), adapter,
                                  mode=args.mode, closed_world=not args.open_world)
        elif args.command == "demo":
            ex = ROOT / "examples"
            c = read_json(str(ex / "conversation.json"))
            contract = filter_contract(c, read_json(str(ex / "ask-output.json")))
            draft = text_file(str(ex / "draft.txt"))
            result = {
                "filtered_contract": contract,
                "measurements": measure(draft, contract),
                "audit": audit(c, contract, draft, read_json(str(ex / "check-output.json"))),
                "guard": guard(c, contract, draft,
                               text_file(str(ex / "repaired.txt"))),
            }
        else:
            raise ValueError("Unknown command")
        emit(result, getattr(args, "output", None))
        return 0
    except (OSError, ValueError, KeyError, RuntimeError, json.JSONDecodeError) as exc:
        print(f"qera: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
