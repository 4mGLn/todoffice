import json, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import qera_eval as ev  # noqa: E402

EX = ROOT / "examples"


class Gen:
    """Fake generator: vanilla answers badly, QERA stages replay the bundled example."""
    model = "fixture-generator"
    url = "https://example.invalid/v1/chat/completions"

    def complete(self, system, data, **kw):
        if system == ev.VANILLA_SYSTEM:
            return "I am not sure."
        if "planning stage" in system:
            return (EX / "ask-output.json").read_text(encoding="utf-8")
        self.n = getattr(self, "n", 0) + 1   # stages after ask: answer, check, repair
        files = {1: "draft.txt", 2: "check-output.json", 3: "repaired.txt"}
        return (EX / files[(self.n - 1) % 3 + 1]).read_text(encoding="utf-8")


class Judge:
    """Passes a rubric iff the response contains '104 TPS' (example's correct total)."""
    model = "fixture-judge"
    url = "https://example.invalid/v1/chat/completions"

    def complete(self, system, data, **kw):
        ok = "104 TPS" in data["response"]
        return json.dumps({"results": [{"id": r["id"], "pass": ok} for r in data["rubrics"]]})


def tasks(n=3):
    conv = json.loads((EX / "conversation.json").read_text(encoding="utf-8"))
    return [{"id": f"t{i}", "conversation": conv, "rubrics": ["a", "b"]} for i in range(n)]


class EvalTests(unittest.TestCase):
    def test_load_tasks_validation(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "t.json"
            p.write_text(json.dumps({"tasks": [{"id": "x", "conversation": {"messages": []}, "rubrics": []}]}))
            with self.assertRaises(ValueError):
                ev.load_tasks(str(p))
        ev.load_tasks(str(EX / "eval" / "tasks.example.json"))

    def test_run_resume_and_report(self):
        ts = tasks(3)
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "r.jsonl"
            ev.run_eval(ts, ["vanilla", "full"], Gen(), Judge(), path, log=lambda *_: None)
            n_lines = len(path.read_text().splitlines())
            self.assertEqual(n_lines, 6)
            ev.run_eval(ts, ["vanilla", "full"], Gen(), Judge(), path, log=lambda *_: None)
            self.assertEqual(len(path.read_text().splitlines()), 6, "resume must not redo work")
            rep = ev.report(ts, ["vanilla", "full"], path)
            self.assertEqual(rep["n_tasks_paired"], 3)
            self.assertEqual(rep["arms"]["vanilla"]["solving_rate"], 0.0)
            self.assertEqual(rep["arms"]["full"]["solving_rate"], 1.0)
            self.assertAlmostEqual(rep["vs_baseline"]["full"]["solving_diff"], 1.0)
            self.assertEqual(rep["vs_baseline"]["full"]["solving_wins_losses"], [3, 0])
            self.assertEqual(rep["arms"]["full"]["mean_calls"], 4)
            self.assertEqual(oct(path.stat().st_mode & 0o777), "0o600")

    def test_generation_error_is_recorded_not_masked(self):
        class Boom:
            def complete(self, *a, **k): raise RuntimeError("down")
        g = ev.generate("vanilla", tasks(1)[0], Boom())
        self.assertIn("error", g)
        self.assertEqual(ev.judge(tasks(1)[0], g["answer"], Judge()), [False, False])

    def test_unusable_judge_raises(self):
        class Bad:
            def complete(self, *a, **k): return "not json"
        with self.assertRaises(ValueError):
            ev.judge(tasks(1)[0], "answer", Bad())

    def test_stats_helpers(self):
        self.assertEqual(ev.sign_test(0, 0), 1.0)
        self.assertLess(ev.sign_test(10, 0), 0.01)
        self.assertEqual(ev.sign_test(5, 5), 1.0)
        lo, hi = ev.paired_bootstrap([1.0] * 10)
        self.assertEqual((lo, hi), (1.0, 1.0))

    def test_unpaired_tasks_excluded(self):
        ts = tasks(2)
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "r.jsonl"
            ev.run_eval(ts[:1], ["vanilla", "full"], Gen(), Judge(), path, log=lambda *_: None)
            ev.run_eval(ts[1:], ["vanilla"], Gen(), Judge(), path, log=lambda *_: None)
            self.assertEqual(ev.report(ts, ["vanilla", "full"], path)["n_tasks_paired"], 1)


if __name__ == "__main__":
    unittest.main()


class JudgeContextTests(unittest.TestCase):
    def test_judge_omits_conversation_by_default(self):
        seen = []
        class J:
            def complete(self, system, data, **kw):
                seen.append(data)
                return json.dumps({"results": [{"id": 0, "pass": True}, {"id": 1, "pass": True}]})
        t = tasks(1)[0]
        ev.judge(t, "ans", J())
        ev.judge(t, "ans", J(), with_context=True)
        self.assertNotIn("conversation", seen[0])
        self.assertIn("conversation", seen[1])
