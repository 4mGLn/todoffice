"""Deterministic utilities for the portable QERA-inspired Agent Skill.

No LLM, network, shell execution, or third-party dependencies here.
These checks are narrow safeguards, not proofs of semantic correctness.
"""
from __future__ import annotations

import json
import re
import unicodedata
from decimal import Decimal, InvalidOperation
from typing import Any

NEED_TYPES = frozenset({"lookup", "enumerate", "count", "compute", "compare", "judge"})
SET_KINDS = frozenset({"list", "count", "compute", "timeline", "summary", "classification"})
YEAR_RE = re.compile(r"(?<!\d)(?:19|20)\d{2}(?!\d)")
NUMBER_RE = re.compile(r"(?<![\w])[-+]?\d[\d,]*(?:\.\d+)?%?(?!\w)")
WORD_RE = re.compile(r"\b\w+\b", re.UNICODE)


def normalize(text: Any) -> str:
    """NFKC + casefold + whitespace collapse; not semantic equivalence."""
    return " ".join(unicodedata.normalize("NFKC", str(text)).casefold().split())


def contains(haystack: str, needle: str) -> bool:
    return bool(needle.strip()) and normalize(needle) in normalize(haystack)


def read_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as stream:
        value = json.load(stream)
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return value


def conversation_text(conversation: dict) -> str:
    return "\n".join(str(m.get("content", "")) for m in conversation.get("messages", [])
                     if isinstance(m, dict))


def user_text(conversation: dict) -> str:
    # Optional trusted boundary when user messages contain pasted third-party text:
    # only host-extracted authenticated requests may ground authoritative constraints.
    instructions = conversation.get("authenticated_user_requests")
    if isinstance(instructions, list) and all(isinstance(v, str) for v in instructions):
        return "\n".join(instructions)
    return "\n".join(str(m.get("content", "")) for m in conversation.get("messages", [])
                     if isinstance(m, dict) and m.get("role") == "user")


def current_request(conversation: dict) -> str:
    for m in reversed(conversation.get("messages", [])):
        if isinstance(m, dict) and m.get("role") == "user":
            return str(m.get("content", ""))
    return ""


def validate_conversation(conversation: dict) -> None:
    messages = conversation.get("messages")
    if not isinstance(messages, list) or not messages:
        raise ValueError("Conversation must have nonempty 'messages' array")
    if not current_request(conversation).strip():
        raise ValueError("Conversation must include a nonempty user message")
    for message in messages:
        if not isinstance(message, dict) or not isinstance(message.get("content"), str):
            raise ValueError("Each message needs a string 'content'")
        if message.get("role") not in {"system", "developer", "user", "assistant", "tool"}:
            raise ValueError("Each message needs a recognized 'role'")


def filter_contract(conversation: dict, contract: dict) -> dict:
    """Conservative user-quote grounding + coverage completion.

    This does not infer whether a claimed scope is semantically supported.
    The agent remains responsible for resolving scope and chronology.
    """
    validate_conversation(conversation)
    words = user_text(conversation)
    accepted = []
    dropped = []
    seen = set()
    for raw in (contract.get("requirements") or []):
        if not isinstance(raw, dict):
            continue
        rid = str(raw.get("id", "")).strip()
        quote = str(raw.get("user_quote", "")).strip()
        if not rid or rid in seen or not contains(words, quote):
            dropped.append({"id": rid or "?", "reason": "duplicate, missing ID, or ungrounded user_quote"})
            continue
        seen.add(rid)
        entry = {k: v for k, v in raw.items() if k not in ("exclusions", "required_literals")}
        entry["required_literals"] = [s for s in (raw.get("required_literals") or [])
                                      if isinstance(s, str) and contains(words, s)]
        entry["exclusions"] = []
        for ex in (raw.get("exclusions") or []):
            # An exclusion is privileged: require a quote showing the user requested it.
            if isinstance(ex, dict):
                term, proof = str(ex.get("term", "")), str(ex.get("user_quote", ""))
                if term.strip() and contains(words, proof) and contains(proof, term):
                    entry["exclusions"].append({"term": term, "user_quote": proof})
        if raw.get("format") and raw.get("format") != "unspecified":
            format_quote = str(raw.get("format_quote", ""))
            if not contains(words, format_quote):
                entry["format"] = "unspecified"
        if raw.get("max_words") is not None and not contains(words, str(raw.get("max_words_quote", ""))):
            entry.pop("max_words", None)
        if raw.get("min_words") is not None and not contains(words, str(raw.get("min_words_quote", ""))):
            entry.pop("min_words", None)
        accepted.append(entry)

    req_ids = {r["id"] for r in accepted}
    needs = []
    seen_needs = set()
    for raw in (contract.get("information_needs") or []):
        if not isinstance(raw, dict):
            continue
        nid, typ = str(raw.get("id", "")), str(raw.get("type", ""))
        if not nid or nid in seen_needs or typ not in NEED_TYPES:
            continue
        linked = [r for r in (raw.get("requirement_ids") or []) if r in req_ids]
        if not linked or not str(raw.get("description", "")).strip():
            continue
        seen_needs.add(nid)
        needs.append({**raw, "requirement_ids": linked})

    for req in accepted:
        rid, kind = req["id"], req.get("kind", "")
        if kind not in SET_KINDS:
            continue
        supported = any(rid in n.get("requirement_ids", []) and
                        n.get("type") in {"enumerate", "count", "compute"} for n in needs)
        if supported:
            continue
        typ = "compute" if kind == "compute" else "count" if kind == "count" else "enumerate"
        nid = "auto-" + re.sub(r"[^a-zA-Z0-9_-]", "-", rid)
        suffix = 1
        while nid in seen_needs:
            nid = f"auto-{rid}-{suffix}"
            suffix += 1
        seen_needs.add(nid)
        needs.append({
            "id": nid,
            "description": f"Find every qualifying input/item needed for: {req.get('description', req['user_quote'])}",
            "type": typ,
            "requirement_ids": [rid],
            "where": "entire supplied context, including later corrections",
            "generated_by": "coverage_filter",
        })

    return {"requirements": accepted, "information_needs": needs,
            "filter_report": {"dropped_requirements": dropped,
                              "generated_needs": [n["id"] for n in needs if n.get("generated_by")]}}


def measure(draft: str, contract: dict | None = None) -> dict:
    words = WORD_RE.findall(draft)
    sentences = [s for s in re.split(r"[.!?。！？]+", draft) if s.strip()]
    bullet_lines = [s for s in draft.splitlines() if re.match(r"^\s*(?:[-*+]\s|\d+[.)]\s)", s)]
    values = {
        "characters": len(draft), "words": len(words), "sentences": len(sentences),
        "bullets": len(bullet_lines), "lines": len(draft.splitlines()),
        "numbers": NUMBER_RE.findall(draft),
    }
    issues = []
    for req in (contract or {}).get("requirements", []):
        for literal in req.get("required_literals", []):
            if literal not in draft:
                issues.append({"type": "missing_required_literal", "requirement_id": req["id"], "value": literal})
        for excluded in req.get("exclusions", []):
            term = excluded.get("term", "") if isinstance(excluded, dict) else ""
            if term and contains(draft, term):
                issues.append({"type": "excluded_term_present", "requirement_id": req["id"], "value": term})
        if isinstance(req.get("max_words"), int) and len(words) > req["max_words"]:
            issues.append({"type": "over_word_limit", "requirement_id": req["id"],
                           "actual": len(words), "limit": req["max_words"]})
        if isinstance(req.get("min_words"), int) and len(words) < req["min_words"]:
            issues.append({"type": "under_word_limit", "requirement_id": req["id"],
                           "actual": len(words), "limit": req["min_words"]})
        if req.get("format") == "json":
            try:
                json.loads(draft)
            except (ValueError, TypeError):
                issues.append({"type": "invalid_json_format", "requirement_id": req["id"]})
    values["issues"] = issues
    return values


def _decimal(value: Any) -> Decimal:
    if isinstance(value, bool):
        raise ValueError("Booleans are not numbers")
    try:
        number = Decimal(str(value).replace(",", ""))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Not a decimal number: {value!r}") from exc
    if not number.is_finite():
        raise ValueError("Nonfinite number")
    return number


def calculate(operation: str, values: list) -> Decimal:
    nums = [_decimal(v) for v in values]
    if not nums:
        raise ValueError("Missing inputs")
    if operation == "sum":
        return sum(nums, Decimal(0))
    if operation in {"mean", "average"}:
        return sum(nums, Decimal(0)) / len(nums)
    if operation == "count":
        return Decimal(len(nums))
    if operation == "difference" and len(nums) == 2:
        return nums[0] - nums[1]
    if operation == "ratio" and len(nums) == 2 and nums[1] != 0:
        return nums[0] / nums[1]
    raise ValueError("Unsupported operation or number of inputs")


def audit(conversation: dict, contract: dict, draft: str, check: dict) -> dict:
    """Verify literal quotes, findings coverage and arithmetic. Do not trust model verdicts alone."""
    validate_conversation(conversation)
    source = conversation_text(conversation)
    actions, warnings, verified = [], [], []
    m = measure(draft, contract)
    actions.extend(m["issues"])
    req_ids = {r["id"] for r in contract.get("requirements", [])}
    need_by_id = {n["id"]: n for n in contract.get("information_needs", [])}

    def entries(field, expected, statuses):
        raw = check.get(field, [])
        if not isinstance(raw, list):
            warnings.append({"type": "invalid_check_collection", "field": field})
            return [], set(expected)
        accepted, seen = [], set()
        for entry in raw:
            if (not isinstance(entry, dict) or not isinstance(entry.get("id"), str)
                    or entry["id"] not in expected):
                warnings.append({"type": "invalid_check_entry", "field": field})
                continue
            cid = entry["id"]
            if cid in seen:
                warnings.append({"type": "duplicate_check_id", "field": field, "id": cid})
                continue
            seen.add(cid)
            if (not isinstance(entry.get("status"), str) or entry["status"] not in statuses
                    or (field == "need_checks" and not isinstance(entry.get("findings"), list))):
                warnings.append({"type": "invalid_check_entry", "field": field, "id": cid})
                continue
            accepted.append(entry)
        missing = set(expected) - {entry["id"] for entry in accepted}
        return accepted, missing

    requirement_checks, missing_reqs = entries("requirement_checks", req_ids,
                                               {"pass", "partial", "fail", "unknown"})
    need_checks, missing_needs = entries("need_checks", need_by_id,
                                        {"correct", "partial", "missing", "unknown"})
    structure_valid = not warnings
    for field, missing in (("requirement_checks", missing_reqs), ("need_checks", missing_needs)):
        if missing:
            warnings.append({"type": "missing_checks", "field": field, "ids": sorted(missing)})
    check_complete = structure_valid and not missing_reqs and not missing_needs

    for rc in requirement_checks:
        status = rc.get("status", "unknown")
        snippet = str(rc.get("draft_quote", ""))
        if status == "pass" and not contains(draft, snippet):
            warnings.append({"type": "unsubstantiated_pass", "id": rc["id"]})
        elif status in {"fail", "partial"} and str(rc.get("problem", "")).strip():
            actions.append({"type": "requirement_gap", "id": rc["id"],
                            "problem": rc["problem"], "suggested_fix": rc.get("fix", "")})

    for nc in need_checks:
        need = need_by_id[nc["id"]]
        findings = nc["findings"]
        genuine = []
        for f in findings:
            if not isinstance(f, dict):
                continue
            quote = str(f.get("quote", ""))
            if quote and contains(source, quote):
                genuine.append(f)
            else:
                warnings.append({"type": "quote_not_found", "need_id": nc["id"],
                                 "item_id": f.get("item_id", ""), "quote": quote})
        verified.append({"need_id": nc["id"], "verified_findings": len(genuine),
                         "submitted_findings": len(findings)})
        typ = need.get("type")
        if typ in {"enumerate", "count"}:
            ids = [str(f.get("item_id", "")).strip() for f in genuine if str(f.get("item_id", "")).strip()]
            unique = list(dict.fromkeys(ids))
            missing = [i for i in unique if not contains(draft, i)]
            if missing:
                actions.append({"type": "missing_items", "need_id": nc["id"],
                                "items": missing[:30]})
            if typ == "count" and nc.get("stated_count") is not None:
                try:
                    stated = int(nc["stated_count"])
                    if len(genuine) == len(findings) and stated != len(unique):
                        actions.append({"type": "count_mismatch", "need_id": nc["id"],
                                        "claimed": stated, "found_distinct": len(unique)})
                except (TypeError, ValueError):
                    warnings.append({"type": "invalid_count", "need_id": nc["id"]})
        if typ == "compute" and isinstance(nc.get("calculation"), dict):
            calc = nc["calculation"]
            # Each input must carry an independently located exact quote.
            inputs = calc.get("inputs", [])
            if not isinstance(inputs, list) or not inputs or any(
                not isinstance(v, dict) or not contains(source, str(v.get("quote", "")))
                for v in inputs
            ):
                warnings.append({"type": "unverified_calculation_inputs", "need_id": nc["id"]})
                continue
            try:
                expected = calculate(str(calc.get("operation", "")), [i.get("value") for i in inputs])
                result = _decimal(calc.get("result"))
                if abs(expected - result) > max(Decimal("0.005") * abs(expected), Decimal("0.00001")):
                    actions.append({"type": "arithmetic_mismatch", "need_id": nc["id"],
                                    "claimed": str(result), "recomputed": str(expected),
                                    "operation": calc.get("operation")})
            except (ValueError, ZeroDivisionError, TypeError) as exc:
                warnings.append({"type": "invalid_calculation", "need_id": nc["id"], "detail": str(exc)})

    return {"actionable": actions, "warnings": warnings, "evidence_summary": verified,
            "check_complete": check_complete, "missing_requirement_ids": sorted(missing_reqs),
            "missing_need_ids": sorted(missing_needs),
            "safe_to_autorepair": check_complete and bool(actions) and not any(
                a.get("type") == "arithmetic_mismatch" for a in actions),
            "note": "Literal/code audit only; use agent judgment for semantic grounding and permissions."}


def guard(conversation: dict, contract: dict, draft: str, candidate: str, *,
          closed_world: bool = True) -> dict:
    """Reject obvious regressions. The caller, not this function, decides if edits are correct."""
    reasons = []
    if not candidate.strip():
        reasons.append("empty_repair")
        return {"accepted": False, "reasons": reasons, "answer": draft}
    limit_exists = any(isinstance(r.get("max_words"), int) for r in contract.get("requirements", []))
    if len(draft.strip()) >= 100 and len(candidate.strip()) < 0.5 * len(draft.strip()) and not limit_exists:
        reasons.append("repair_dropped_over_half_of_draft")
    source = conversation_text(conversation)
    if closed_world:
        source_years = set(YEAR_RE.findall(source)) | set(YEAR_RE.findall(draft))
        if set(YEAR_RE.findall(candidate)) - source_years:
            reasons.append("introduced_year_not_in_context")
    old_numbers = NUMBER_RE.findall(draft)
    new_numbers = NUMBER_RE.findall(candidate)
    if len(old_numbers) >= 10 and not limit_exists:
        retained = sum(1 for number in old_numbers if number in new_numbers)
        if retained / len(old_numbers) < 0.3:
            reasons.append("lost_most_numbers")
    old_measure = measure(draft, contract)
    new_measure = measure(candidate, contract)
    old_issues = {(x["type"], x.get("requirement_id"), x.get("value")) for x in old_measure["issues"]}
    for issue in new_measure["issues"]:
        key = (issue["type"], issue.get("requirement_id"), issue.get("value"))
        if issue["type"] == "under_word_limit":
            if key not in old_issues or new_measure["words"] < old_measure["words"]:
                reasons.append("introduced_under_word_limit")
        if issue["type"] in {"missing_required_literal", "excluded_term_present", "over_word_limit", "invalid_json_format"}:
            if key not in old_issues or issue["type"] == "over_word_limit":
                reasons.append(f"introduced_{issue['type']}")
    return {"accepted": not reasons, "reasons": sorted(set(reasons)),
            "answer": candidate if not reasons else draft,
            "note": "Passing guard does not establish semantic truth or execution safety."}
