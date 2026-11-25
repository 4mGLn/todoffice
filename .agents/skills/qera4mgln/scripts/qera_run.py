"""Optional model-backed QERA pipeline, using any OpenAI-compatible chat API.

Only composes text. It does NOT execute agent tools or mutate external systems.
"""
from __future__ import annotations

import http.client
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from qera_core import audit, filter_contract, guard, measure, validate_conversation

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Never follow redirects: urllib would replay the Authorization header and prompt elsewhere."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


_OPENER = urllib.request.build_opener(_NoRedirect)

PROMPTS = Path(__file__).resolve().parent.parent / "assets" / "prompts"


def prompt(stage: str) -> str:
    """Stage prompt, preceded by the host safety preamble (kept separate from the paper protocol)."""
    safety = (PROMPTS / "safety.txt").read_text(encoding="utf-8")
    return safety + (PROMPTS / (stage + ".txt")).read_text(encoding="utf-8")


def parse_json_response(text: str) -> dict:
    value = text.strip()
    if value.startswith("```"):
        lines = value.splitlines()
        if len(lines) >= 3 and lines[-1].strip() == "```":
            value = "\n".join(lines[1:-1])
    result = json.loads(value)
    if not isinstance(result, dict):
        raise ValueError("Model must return a JSON object")
    return result


class ChatAdapter:
    """Endpoint adapter (chat/completions); host provider is responsible for auth."""

    temperature = 0

    def __init__(self, model: str, base_url: str, key: str = "", timeout: int = 90):
        if not model:
            raise ValueError("Model missing; set --model or QERA_MODEL")
        if not base_url:
            raise ValueError("API endpoint missing; set --api-base or QERA_API_BASE")
        parsed = urllib.parse.urlparse(base_url)
        # HTTPS remote by default; localhost HTTP allowed for self-hosted models.
        if parsed.scheme != "https" and not (parsed.scheme == "http" and
                parsed.hostname in {"127.0.0.1", "localhost", "::1"}):
            raise ValueError("Use HTTPS or localhost HTTP endpoint")
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("API URL must not embed credentials or query parameters")
        self.url = base_url.rstrip("/")
        if not self.url.endswith("/chat/completions"):
            self.url += "/chat/completions"
        self.key = key
        self.model = model
        self.timeout = timeout

    def complete(self, system: str, data: dict, *, response_json: bool = False) -> str:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(data, ensure_ascii=False)},
            ],
            "temperature": self.temperature,
        }
        # Avoid response_format for broader API compatibility. JSON is requested in prompt.
        request = urllib.request.Request(
            self.url,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json", **(
                {"Authorization": "Bearer " + self.key} if self.key else {})},
            method="POST",
        )
        try:
            with _OPENER.open(request, timeout=self.timeout) as response:
                output = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            # Do not print raw provider errors: may echo private context or credentials.
            raise RuntimeError(f"Provider returned HTTP {exc.code}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Provider network error: {exc.reason}") from exc
        except (TimeoutError, OSError, http.client.HTTPException) as exc:
            # Mid-response timeouts/resets surface as raw socket errors, not URLError.
            raise RuntimeError(f"Provider network error: {type(exc).__name__}") from exc
        except UnicodeDecodeError as exc:
            raise ValueError("Unexpected chat/completions response shape") from exc
        try:
            content = output["choices"][0]["message"]["content"]
            if isinstance(content, list):
                content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
            if not isinstance(content, str) or not content.strip():
                raise ValueError("empty model completion")
            return content
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise ValueError("Unexpected chat/completions response shape") from exc


def _json_stage(adapter: ChatAdapter, name: str, data: dict) -> dict:
    last_error = None
    for retry in range(2):
        system = prompt(name) + ("\nPrior response was not valid JSON; retry with ONE JSON object." if retry else "")
        try:
            return parse_json_response(adapter.complete(system, data, response_json=True))
        except (ValueError, json.JSONDecodeError) as exc:
            last_error = exc
    raise ValueError(f"{name} stage did not return valid JSON after retries: {last_error}")


def run_pipeline(conversation: dict, adapter: ChatAdapter, mode: str = "adaptive", *,
                 closed_world: bool = True) -> dict:
    validate_conversation(conversation)
    if mode not in {"draft", "full", "adaptive"}:
        raise ValueError("mode must be draft, full, or adaptive")
    raw_contract = _json_stage(adapter, "ask", {"conversation": conversation})
    contract = filter_contract(conversation, raw_contract)
    if not contract["requirements"]:
        raise ValueError("ASK did not produce any grounded user requirements; review the prompt and source boundary")
    draft = adapter.complete("\n".join([prompt("answer")]),
                             {"conversation": conversation, "contract": contract})
    output = {"mode": mode, "stage": "draft", "answer": draft,
              "draft": draft, "contract": contract,
              "warning": "Automatic textual validation does not authorize or perform external tools."}
    complex_kinds = {"list", "count", "compute", "timeline", "summary", "classification"}
    should_check = mode == "full" or (mode == "adaptive" and any(
        r.get("kind") in complex_kinds for r in contract.get("requirements", [])))
    if not should_check:
        return output
    check = _json_stage(adapter, "check", {
        "conversation": conversation, "contract": contract,
        "draft": draft, "measurements": measure(draft, contract),
    })
    evidence = audit(conversation, contract, draft, check)
    output["stage"] = "checked" if evidence["check_complete"] else "check_incomplete"
    output["audit"] = evidence
    if not evidence["check_complete"]:
        return output
    if not evidence["actionable"]:
        return output
    candidate = adapter.complete(prompt("repair"), {
        "conversation": conversation, "contract": contract,
        "draft": draft, "audited_issues": evidence["actionable"],
        "audit_warnings": evidence["warnings"],
        "measurements": measure(draft, contract),
    })
    decision = guard(conversation, contract, draft, candidate, closed_world=closed_world)
    output["stage"] = "repaired" if decision["accepted"] else "repair_rejected"
    output["answer"] = decision["answer"]
    output["guard"] = {k: v for k, v in decision.items() if k != "answer"}
    return output
