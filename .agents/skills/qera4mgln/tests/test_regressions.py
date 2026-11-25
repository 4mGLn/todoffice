"""Regression coverage for stale evaluations, incomplete checks and short repairs."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import qera_eval as ev
from qera_core import audit, filter_contract, guard, measure
from qera_run import run_pipeline


class Adapter:
    model = "fixture"
    url = "https://example.invalid/v1/chat/completions"
    temperature = 0

    def __init__(self, judge=False):
        self.calls = 0
        self.judge = judge

    def complete(self, system, data, **kw):
        self.calls += 1
        if self.judge:
            return json.dumps({"results": [{"id": r["id"], "pass": True}
                                            for r in data["rubrics"]]})
        return "ALPHA"


def task():
    return {"id": "t1", "conversation": {"messages": [
        {"role": "user", "content": "Say ALPHA"}]}, "rubrics": ["Contains ALPHA"]}


class EvaluationIdentityTests(unittest.TestCase):
    def test_changed_task_rejected_by_resume_and_report(self):
        for change in ("question", "rubrics", "request_boundary"):
            with self.subTest(change=change), tempfile.TemporaryDirectory() as d:
                path = Path(d) / "r.jsonl"
                gen, jd, original = Adapter(), Adapter(judge=True), task()
                ev.run_eval([original], ["vanilla"], gen, jd, path, log=lambda *_: None)
                before = path.read_bytes()
                changed = copy.deepcopy(original)
                if change == "question":
                    changed["conversation"]["messages"][0]["content"] = "Say BETA"
                elif change == "rubrics":
                    changed["rubrics"] = ["Contains BETA", "Contains GAMMA"]
                else:
                    changed["conversation"]["authenticated_user_requests"] = ["Say ALPHA"]
                # An unseen task first must not trigger calls before the mismatch is found.
                new_task = {**original, "id": "new"}
                with self.assertRaisesRegex(ValueError, "task input"):
                    ev.run_eval([new_task, changed], ["vanilla"], gen, jd, path)
                with self.assertRaisesRegex(ValueError, "task input"):
                    ev.report([changed], ["vanilla"], path)
                self.assertEqual((gen.calls, jd.calls), (1, 1))
                self.assertEqual(path.read_bytes(), before)

    def test_changed_configuration_rejected_before_calls(self):
        for who, attr, value in (("gen", "model", "other"), ("judge", "model", "other"),
                                 ("gen", "url", "https://other.invalid/v1"),
                                 ("judge", "url", "https://other.invalid/v1"),
                                 ("gen", "temperature", 0.5), ("judge", "temperature", 0.5)):
            with self.subTest(who=who, attr=attr), tempfile.TemporaryDirectory() as d:
                path = Path(d) / "r.jsonl"
                gen, jd = Adapter(), Adapter(judge=True)
                ev.run_eval([task()], ["vanilla"], gen, jd, path, log=lambda *_: None)
                setattr(gen if who == "gen" else jd, attr, value)
                with self.assertRaisesRegex(ValueError, "configuration"):
                    ev.run_eval([task()], ["vanilla"], gen, jd, path)
                self.assertEqual((gen.calls, jd.calls), (1, 1))

    def test_changed_judge_context_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "r.jsonl"
            gen, jd = Adapter(), Adapter(judge=True)
            ev.run_eval([task()], ["vanilla"], gen, jd, path, log=lambda *_: None)
            with self.assertRaisesRegex(ValueError, "configuration"):
                ev.run_eval([task()], ["vanilla"], gen, jd, path, judge_context=True)
            with self.assertRaisesRegex(ValueError, "judge.context"):
                ev.report([task()], ["vanilla"], path, judge_context=True)

    def test_changed_prompts_and_code_rejected_by_resume_and_report(self):
        for name in ("VANILLA_SYSTEM", "JUDGE_SYSTEM", "prompt", "protocol_fingerprint"):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as d:
                path = Path(d) / "r.jsonl"
                gen, jd = Adapter(), Adapter(judge=True)
                ev.run_eval([task()], ["vanilla"], gen, jd, path, log=lambda *_: None)
                if name in {"prompt", "protocol_fingerprint"}:
                    replacement = lambda *a: "changed"
                else:
                    replacement = "changed"
                with patch.object(ev, name, replacement):
                    with self.assertRaises(ValueError):
                        ev.run_eval([task()], ["vanilla"], gen, jd, path)
                    with self.assertRaises(ValueError):
                        ev.report([task()], ["vanilla"], path)
                self.assertEqual((gen.calls, jd.calls), (1, 1))

    def test_mixed_configurations_and_bad_pass_counts_rejected(self):
        for change in ("configuration", "passes"):
            with self.subTest(change=change), tempfile.TemporaryDirectory() as d:
                path = Path(d) / "r.jsonl"
                ev.run_eval([task()], ["vanilla"], Adapter(), Adapter(judge=True), path,
                            repeats=2, log=lambda *_: None)
                records = [json.loads(line) for line in path.read_text().splitlines()]
                if change == "configuration":
                    records[1]["evaluation"]["config"]["generator"]["model"] = "other"
                else:
                    records[1]["passes"] = [True, True]
                path.write_text("".join(json.dumps(r) + "\n" for r in records))
                with self.assertRaises(ValueError):
                    ev.report([task()], ["vanilla"], path, repeats=2)

    def test_credentials_not_recorded_and_key_rotation_does_not_invalidate(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "r.jsonl"
            gen, jd = Adapter(), Adapter(judge=True)
            gen.key, jd.key = "private-generator-key", "private-judge-key"
            ev.run_eval([task()], ["vanilla"], gen, jd, path, log=lambda *_: None)
            gen.key, jd.key = "rotated-generator-key", "rotated-judge-key"
            ev.run_eval([task()], ["vanilla"], gen, jd, path)
            self.assertEqual((gen.calls, jd.calls), (1, 1))
            self.assertNotIn("private-", path.read_text())
            self.assertNotIn("rotated-", path.read_text())

    def test_conflicting_duplicate_cannot_hide_a_stale_result(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "r.jsonl"
            gen, jd = Adapter(), Adapter(judge=True)
            ev.run_eval([task()], ["vanilla"], gen, jd, path, log=lambda *_: None)
            conflicting = json.loads(path.read_text())
            conflicting["evaluation"]["task_fingerprint"] = "stale"
            ev.append_result(path, conflicting)
            before = path.read_bytes()
            with self.assertRaisesRegex(ValueError, "conflicting duplicate"):
                ev.run_eval([task()], ["vanilla"], gen, jd, path)
            with self.assertRaisesRegex(ValueError, "conflicting duplicate"):
                ev.report([task()], ["vanilla"], path)
            self.assertEqual((gen.calls, jd.calls), (1, 1))
            self.assertEqual(path.read_bytes(), before)

    def test_legacy_results_readable_but_not_trusted_for_resume_or_report(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "r.jsonl"
            path.write_text(json.dumps({"task": "t1", "arm": "vanilla", "passes": [True]}) + "\n")
            self.assertIn(("t1", "vanilla", 0), ev.read_results(path))
            gen, jd = Adapter(), Adapter(judge=True)
            with self.assertRaisesRegex(ValueError, "lack evaluation fingerprints"):
                ev.run_eval([task()], ["vanilla"], gen, jd, path)
            with self.assertRaisesRegex(ValueError, "lack evaluation fingerprints"):
                ev.report([task()], ["vanilla"], path)
            self.assertEqual((gen.calls, jd.calls), (0, 0))

    def test_report_uses_recorded_models_without_provider_environment(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "r.jsonl"
            ev.run_eval([task()], ["vanilla"], Adapter(), Adapter(judge=True), path,
                        log=lambda *_: None)
            with patch.dict("os.environ", {}, clear=True):
                result = ev.report([task()], ["vanilla"], path)
            self.assertEqual(result["evaluation_config"]["generator"]["model"], Adapter.model)
            self.assertEqual(result["arms"]["vanilla"]["solving_rate"], 1.0)


class CheckCoverageTests(unittest.TestCase):
    def setUp(self):
        self.conv = {"messages": [{"role": "user", "content": "List all: A-11 and B-22"}]}
        self.raw = {"requirements": [{"id": "R1", "kind": "list", "user_quote": "List all"}],
                    "information_needs": [{"id": "N1", "type": "enumerate",
                        "description": "all items", "requirement_ids": ["R1"]}]}
        self.contract = filter_contract(self.conv, self.raw)

    def test_empty_check_reports_missing_ids(self):
        result = audit(self.conv, self.contract, "A-11", {})
        self.assertFalse(result["check_complete"])
        self.assertEqual(result["missing_requirement_ids"], ["R1"])
        self.assertEqual(result["missing_need_ids"], ["N1"])
        self.assertTrue(result["warnings"])
        self.assertEqual(result["actionable"], [])

    def test_malformed_duplicate_and_partial_checks_are_incomplete(self):
        valid = {"requirement_checks": [{"id": "R1", "status": "pass", "draft_quote": "A-11"}],
                 "need_checks": [{"id": "N1", "status": "correct", "findings": []}]}
        self.assertTrue(audit(self.conv, self.contract, "A-11", valid)["check_complete"])
        cases = [{"requirement_checks": None, "need_checks": "bad"},
                 {"requirement_checks": [{"id": "R1"}], "need_checks": []},
                 {**valid, "need_checks": [{"id": "N1", "status": "correct", "findings": None}]},
                 {**valid, "requirement_checks": valid["requirement_checks"] * 2},
                 {**valid, "need_checks": []}]
        for check in cases:
            with self.subTest(check=check):
                result = audit(self.conv, self.contract, "A-11", check)
                self.assertFalse(result["check_complete"])
                self.assertTrue(result["warnings"])

    def test_empty_check_pipeline_preserves_draft_without_repair(self):
        for mode in ("full", "adaptive"):
            with self.subTest(mode=mode):
                outputs = iter([json.dumps(self.raw), "A-11", "{}"])
                class Fake:
                    def complete(self, *a, **kw): return next(outputs)
                result = run_pipeline(self.conv, Fake(), mode=mode)
                self.assertEqual(result["stage"], "check_incomplete")
                self.assertEqual(result["answer"], "A-11")
                self.assertFalse(result["audit"]["check_complete"])

    def test_measurements_survive_incomplete_check(self):
        contract = {"requirements": [{"id": "R1", "min_words": 10}]}
        result = audit(self.conv, contract, "one", {})
        self.assertEqual(result["actionable"][0]["type"], "under_word_limit")
        self.assertFalse(result["check_complete"])
        self.assertFalse(result["safe_to_autorepair"])


class MinimumLengthGuardTests(unittest.TestCase):
    def test_rejects_short_repair_with_and_without_maximum(self):
        conv = {"messages": [{"role": "user", "content": "Write at least 10 words, at most 30 words."}]}
        for long in (False, True):
            for maximum in (False, True):
                with self.subTest(long=long, maximum=maximum):
                    req = {"id": "R1", "user_quote": "Write at least 10 words",
                           "min_words": 10, "min_words_quote": "at least 10 words"}
                    if maximum:
                        req.update(max_words=30, max_words_quote="at most 30 words")
                    contract = filter_contract(conv, {"requirements": [req]})
                    draft = " ".join(["substantial" if long else "word"] * 10)
                    self.assertEqual(measure(draft, contract)["issues"], [])
                    decision = guard(conv, contract, draft, "one")
                    self.assertFalse(decision["accepted"])
                    self.assertIn("introduced_under_word_limit", decision["reasons"])
                    self.assertEqual(decision["answer"], draft)

    def test_accepts_valid_length_and_improvement_but_not_worsening(self):
        conv = {"messages": [{"role": "user", "content": "Write 10 words"}]}
        contract = {"requirements": [{"id": "R1", "min_words": 10}]}
        self.assertTrue(guard(conv, contract, "one two", "word " * 10)["accepted"])
        self.assertTrue(guard(conv, contract, "one two", "one two three")["accepted"])
        self.assertFalse(guard(conv, contract, "one two", "one")["accepted"])


if __name__ == "__main__":
    unittest.main()
