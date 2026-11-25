#!/usr/bin/env python3
"""Convert CL-bench / CL-bench-Life records to the qera_eval tasks.json format.

Input schema (verified against the public dataset cards and eval.py):
  one JSON object per line (JSONL; a JSON array is also accepted) with
    messages: [{"role": system|user|assistant, "content": str}, ...]
    rubrics:  [str, ...]   (eval.py also tolerates dicts with "rubric_criteria")
    metadata: {task_id, context_category, context_subcategory|sub_category}
Sources: huggingface.co/datasets/tencent/CL-bench-Life,
         github.com/Tencent-Hunyuan/CL-bench (eval.py).
The data is evaluation-only licensed; do not use it for training.

Usage: clbench_convert.py INPUT -o tasks.json [--subset TEXT] [--limit N]
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import qera_eval  # noqa: E402


def read_records(path):
    text = Path(path).read_text(encoding="utf-8")
    if text.lstrip().startswith("["):
        return json.loads(text)
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def rubric_text(r):
    if isinstance(r, dict):
        r = r.get("rubric_criteria", "")
    return str(r).strip()


TASK_DELIM = "<|TASK|>"


def authenticated_requests(messages):
    """User words only: per user message, the text after the last <|TASK|> delimiter
    (CL-bench puts the pasted context before it); messages without it stay whole.
    Lets QERA's filter ground requirements in the request, not in pasted context."""
    return [m["content"].rsplit(TASK_DELIM, 1)[-1].strip()
            for m in messages if m["role"] == "user" and m["content"].strip()]


def convert(records, subset=None, limit=None, split_request=True):
    tasks, seen = [], set()
    needle = subset.lower() if subset else None
    for n, rec in enumerate(records):
        meta = rec.get("metadata") or {}
        if needle:
            cats = [str(meta.get(k, "")).lower() for k in
                    ("context_category", "context_subcategory", "sub_category")]
            if not any(needle in c for c in cats):
                continue
        tid = str(meta.get("task_id", rec.get("idx", f"line{n}")))
        if tid in seen:
            raise ValueError(f"duplicate task id: {tid}")
        seen.add(tid)
        messages = [{"role": m["role"], "content": m["content"]} for m in rec["messages"]]
        rubrics = [t for t in (rubric_text(r) for r in rec.get("rubrics", [])) if t]
        conv = {"messages": messages}
        if split_request and any(TASK_DELIM in m["content"] for m in messages):
            conv["authenticated_user_requests"] = authenticated_requests(messages)
        tasks.append({"id": tid, "conversation": conv,
                      "rubrics": rubrics, "metadata": meta})
        if limit and len(tasks) >= limit:
            break
    return tasks


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("input")
    ap.add_argument("-o", "--output", required=True)
    ap.add_argument("--subset", help="case-insensitive substring of context_category/subcategory")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--no-split", action="store_true",
                    help="do not add authenticated_user_requests (<|TASK|> split)")
    a = ap.parse_args(argv)
    tasks = convert(read_records(a.input), a.subset, a.limit, not a.no_split)
    if not tasks:
        ap.error("no tasks selected")
    out = Path(a.output)
    out.write_text(json.dumps({"tasks": tasks}, ensure_ascii=False, indent=1), encoding="utf-8")
    qera_eval.load_tasks(str(out))  # validate
    print(f"wrote {len(tasks)} tasks to {out}")


if __name__ == "__main__":
    main()
