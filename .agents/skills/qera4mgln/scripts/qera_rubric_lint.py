#!/usr/bin/env python3
"""Rubric lint: classify rubrics as explicit vs implicit and warn when few are implicit.

Stdlib only; reads a tasks.json (qera_eval format) and sends nothing anywhere.

Heuristic (arXiv 2610.35083v2, section 3.1 and Appendix F, as read via WebFetch):
  content words = quoted strings, capitalized names, numbers, lowercase words of >= 5
  letters, after removing a trailing "For example ..." clause and boilerplate;
  a rubric is explicit when >= 60% of its content words occur in the request (the final
  user turn); otherwise implicit; rubrics with < 2 content words are left out.

NOT specified by the paper (our assumptions, marked A1..A6):
  A1 tokenization: regex words [A-Za-z][A-Za-z'-]* and numbers; comparison is
     case-insensitive exact match (no stemming unless --stem).
  A2 "capitalized name": a capitalized word that is not the first word of the rubric
     or of a sentence inside it (so "The answer ..." does not count as a name).
  A3 quoted strings: text inside "..." or '...' (3+ chars) counts as ONE content word
     and matches if the whole string occurs in the request (case-insensitive).
  A4 numbers: digit groups; thousands commas and a trailing % or unit are ignored
     ("1,200" == "1200"); decimals kept.
  A5 boilerplate: a small fixed list of grader-template words (BOILERPLATE below) is
     dropped. The paper's boilerplate list is unknown.
  A6 the "request" is the final user message with pasted context removed: text after the
     last "<|TASK|>" delimiter if present (CL-bench layout), else the whole message
     (--request-mode full always uses the whole message). Calibrated on the real
     CL-bench-Life data (405 tasks, 5,348 rubrics): the whole-message request gave
     1,978 explicit / 3,356 implicit / 14 left out (63% implicit); the after-delimiter
     request gives 938 / 4,396 / 14 (82.4%), against the paper's 981 / 4,352 / 15 (82%).
     Residual gap ~1% (43 rubrics); the cause is unknown (A1/A2/A5 are likely sources).
This cannot be validated against the paper's data (not available here); expect the
share to differ from theirs by an unknown amount.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

THRESHOLD = 0.60          # paper: explicit iff >= 60% of content words occur in request
MIN_WORDS = 2             # paper: fewer than two content words -> left out
DEFAULT_MIN_IMPLICIT = 0.50

BOILERPLATE = frozenset({
    "answer", "answers", "response", "responses", "states", "state", "should",
    "includes", "include", "mentions", "mention", "provides", "provide", "reply",
    "correctly", "explicitly", "clearly", "which", "about", "their", "there",
})

_FOR_EXAMPLE = re.compile(r"[,;(\s]*\b(for example|e\.g\.|for instance)\b.*$", re.I | re.S)
_QUOTED = re.compile(r"\"([^\"]{3,})\"|“([^”]{3,})”|(?<!\w)'([^']{3,})'(?!\w)")
_NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")
_WORD = re.compile(r"[A-Za-z][A-Za-z'-]*")


def _norm_num(s: str) -> str:
    return s.replace(",", "").rstrip(".")


def _stem(w: str) -> str:
    for suf in ("ing", "ed", "es", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            return w[: -len(suf)]
    return w


def content_words(rubric: str) -> list[tuple[str, str]]:
    """Return [(kind, value)] with kind in quote|number|name|word."""
    text = _FOR_EXAMPLE.sub("", rubric).strip()
    out: list[tuple[str, str]] = []
    for m in _QUOTED.finditer(text):
        out.append(("quote", next(g for g in m.groups() if g).lower()))
    text = _QUOTED.sub(" ", text)
    for m in _NUMBER.finditer(text):
        out.append(("number", _norm_num(m.group())))
    text = _NUMBER.sub(" ", text)
    sentence_start = True
    for m in _WORD.finditer(text):
        w = m.group().strip("'-")
        between = text[: m.start()]
        first = sentence_start or re.search(r"[.!?]\s*$", between) is not None
        sentence_start = False
        lw = w.lower()
        if lw in BOILERPLATE or not w:
            continue
        if w[0].isupper():
            if not first and len(w) >= 2:
                out.append(("name", lw))
            elif len(w) >= 5:          # sentence-initial capitalized long word: treat as word
                out.append(("word", lw))
        elif len(w) >= 5:
            out.append(("word", lw))
    return out


def classify(rubric: str, request: str, stem: bool = False) -> dict:
    cw = content_words(rubric)
    if len(cw) < MIN_WORDS:
        return {"label": "unclassified", "overlap": None, "n_words": len(cw), "missing": []}
    req_l = request.lower()
    req_nums = {_norm_num(m.group()) for m in _NUMBER.finditer(request)}
    req_words = {m.group().strip("'-").lower() for m in _WORD.finditer(request)}
    if stem:
        req_words |= {_stem(w) for w in req_words}
    hit, missing = 0, []
    for kind, v in cw:
        if kind == "quote":
            ok = v in req_l
        elif kind == "number":
            ok = v in req_nums
        else:
            ok = v in req_words or (stem and _stem(v) in req_words)
        hit += ok
        if not ok:
            missing.append(v)
    ov = hit / len(cw)
    return {"label": "explicit" if ov >= THRESHOLD else "implicit", "overlap": ov,
            "n_words": len(cw), "missing": missing}


TASK_DELIM = "<|TASK|>"


def final_request(task: dict, mode: str = "task") -> str:
    msgs = task["conversation"]["messages"]
    for m in reversed(msgs):
        if m.get("role") == "user":
            c = m.get("content", "")
            c = c if isinstance(c, str) else " ".join(
                p.get("text", "") for p in c if isinstance(p, dict))
            return c.rsplit(TASK_DELIM, 1)[-1] if mode == "task" else c
    return ""


def lint(tasks: list[dict], stem: bool = False, request_mode: str = "task") -> dict:
    per_task, tot = [], {"explicit": 0, "implicit": 0, "unclassified": 0}
    for t in tasks:
        req = final_request(t, request_mode)
        rows = [classify(r, req, stem) | {"rubric": r} for r in t["rubrics"]]
        c = {k: sum(1 for r in rows if r["label"] == k) for k in tot}
        for k in tot:
            tot[k] += c[k]
        n = c["explicit"] + c["implicit"]
        per_task.append({"id": t["id"], "counts": c, "rubrics": rows,
                         "implicit_share": (c["implicit"] / n) if n else None})
    n = tot["explicit"] + tot["implicit"]
    return {"totals": tot, "implicit_share": (tot["implicit"] / n) if n else None,
            "tasks": per_task}


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("tasks")
    p.add_argument("--min-implicit", type=float, default=DEFAULT_MIN_IMPLICIT,
                   help="warn below this implicit share (default 0.50)")
    p.add_argument("--stem", action="store_true", help="crude suffix stripping when matching")
    p.add_argument("--verbose", "-v", action="store_true", help="list every rubric")
    p.add_argument("--request-mode", choices=("task", "full"), default="task",
                   help="task: text after the last <|TASK|> (default); full: whole last user message")
    p.add_argument("--json", action="store_true")
    p.add_argument("--strict", action="store_true", help="exit 1 when a warning fires")
    a = p.parse_args(argv)
    data = json.loads(Path(a.tasks).read_text(encoding="utf-8"))
    tasks = data["tasks"] if isinstance(data, dict) else data
    rep = lint(tasks, a.stem, a.request_mode)
    warns = []
    sh = rep["implicit_share"]
    if sh is None:
        warns.append("no classifiable rubrics (every rubric has < 2 content words)")
    elif sh < a.min_implicit:
        warns.append(
            f"implicit share {sh:.0%} < {a.min_implicit:.0%}: the paper reports its gain on "
            "implicit rubrics (explicit: all methods within 81.1-82.5%, QERA tie with best "
            "baseline), so this set has little room to show an advantage; add corrections, "
            "exclusions, totals, committed verdicts")
    for t in rep["tasks"]:
        if t["implicit_share"] == 0:
            warns.append(f"task {t['id']}: no implicit rubric")
    if a.json:
        print(json.dumps({**rep, "warnings": warns}, indent=1))
    else:
        tot = rep["totals"]
        print(f"rubrics: explicit={tot['explicit']} implicit={tot['implicit']} "
              f"unclassified={tot['unclassified']}")
        print("implicit share (set): " + ("n/a" if sh is None else f"{sh:.0%}")
              + "   [paper CL-bench Life: 82% (4,352/5,333); our heuristic is an approximation]")
        for t in rep["tasks"]:
            s = t["implicit_share"]
            c = t["counts"]
            print(f"  {t['id']:<14} implicit={'n/a' if s is None else f'{s:.0%}':>4} "
                  f"(E{c['explicit']} I{c['implicit']} U{c['unclassified']})")
            if a.verbose:
                for r in t["rubrics"]:
                    ov = "-" if r["overlap"] is None else f"{r['overlap']:.0%}"
                    print(f"      [{r['label'][:4]} {ov:>4}] {r['rubric']}")
        for w in warns:
            print("WARNING:", w)
    return 1 if (warns and a.strict) else 0


if __name__ == "__main__":
    sys.exit(main())
