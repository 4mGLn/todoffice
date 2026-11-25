import json, random, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import qera_eval as ev  # noqa: E402

CONV = {"messages": [{"role": "user", "content": "hi"}]}
QUIET = lambda *_: None


def tasks(n):
    return [{"id": f"t{i}", "conversation": CONV, "rubrics": ["a", "b"]} for i in range(n)]


class FlipGen:
    """Stochastic vanilla-only fake: answer is 'GOOD' with probability p_good, else 'BAD'."""
    model = "fixture-generator"
    url = "https://example.invalid/v1/chat/completions"

    def __init__(self, p_good, seed=0):
        self.p, self.rng, self.calls = p_good, random.Random(seed), 0

    def complete(self, system, data, **kw):
        self.calls += 1
        return "GOOD" if self.rng.random() < self.p else "BAD"


class Judge:
    model = "fixture-judge"
    url = "https://example.invalid/v1/chat/completions"

    def complete(self, system, data, **kw):
        ok = "GOOD" in data["response"]
        return json.dumps({"results": [{"id": r["id"], "pass": ok} for r in data["rubrics"]]})


def rec(task, arm, solved, repeat=None):
    r = {"task": task, "arm": arm, "passes": [solved, solved], "judge_error": None,
         "answer": "x", "calls": 1, "approx_tokens": 10,
         "evaluation": ev.evaluation_identity(tasks(1)[0], ev.evaluation_config(FlipGen(1), Judge()))}
    if repeat is not None:
        r["repeat"] = repeat
    return r


def write(path, recs):
    path.write_text("".join(json.dumps(r) + "\n" for r in recs), encoding="utf-8")


class RepeatTests(unittest.TestCase):
    def test_runs_n_repeats_and_resumes(self):
        ts = tasks(3)
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "r.jsonl"
            gen = FlipGen(0.5, seed=1)
            ev.run_eval(ts, ["vanilla"], gen, Judge(), path, log=QUIET, repeats=3)
            lines = path.read_text().splitlines()
            self.assertEqual(len(lines), 9)
            self.assertEqual(gen.calls, 9)
            keys = {(r["task"], r["arm"], r["repeat"]) for r in map(json.loads, lines)}
            self.assertEqual(len(keys), 9)
            # same N again: nothing redone
            ev.run_eval(ts, ["vanilla"], gen, Judge(), path, log=QUIET, repeats=3)
            self.assertEqual(gen.calls, 9)
            # raise N: only the new repeat runs
            ev.run_eval(ts, ["vanilla"], gen, Judge(), path, log=QUIET, repeats=4)
            self.assertEqual(gen.calls, 12)
            self.assertEqual(len(path.read_text().splitlines()), 12)
            # simulated crash: drop last 4 lines, rerun, exactly those are regenerated
            path.write_text("\n".join(lines[:5]) + "\n")
            gen2 = FlipGen(0.5, seed=2)
            ev.run_eval(ts, ["vanilla"], gen2, Judge(), path, log=QUIET, repeats=3)
            self.assertEqual(gen2.calls, 4)
            self.assertEqual(len(path.read_text().splitlines()), 9)

    def test_missing_repeat_defaults_to_zero_with_matching_identity(self):
        ts = tasks(2)
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "r.jsonl"
            write(path, [rec(t["id"], a, s) for t in ts for a, s in (("vanilla", False), ("full", True))])
            res = ev.read_results(path)
            self.assertIn(("t0", "vanilla", 0), res)
            gen = FlipGen(1.0)
            ev.run_eval(ts, ["vanilla", "full"], gen, Judge(), path, log=QUIET, repeats=1)
            self.assertEqual(gen.calls, 0, "legacy lines count as repeat 0")
            rep = ev.report(ts, ["vanilla", "full"], path)  # default repeats=1
            self.assertEqual(rep["n_tasks_paired"], 2)
            self.assertEqual(rep["arms"]["full"]["solving_rate"], 1.0)
            self.assertIsNone(rep["arms"]["full"]["solving_rate_sd"])
            # extending to 2 repeats only generates repeat 1
            ev.run_eval(ts, ["vanilla"], gen, Judge(), path, log=QUIET, repeats=2)
            self.assertEqual(gen.calls, 2)

    def test_report_requires_all_repeats_and_computes_mean_sd(self):
        ts = tasks(2)
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "r.jsonl"
            # repeat 0: vanilla solves t0,t1 ; repeat 1: solves t0 only. full always solves both.
            write(path, [rec("t0", "vanilla", True, 0), rec("t1", "vanilla", True, 0),
                         rec("t0", "vanilla", True, 1), rec("t1", "vanilla", False, 1),
                         *[rec(t, "full", True, r) for t in ("t0", "t1") for r in (0, 1)]])
            rep = ev.report(ts, ["vanilla", "full"], path, repeats=2)
            v = rep["arms"]["vanilla"]
            self.assertEqual(v["solving_rate_per_repeat"], [1.0, 0.5])
            self.assertAlmostEqual(v["solving_rate"], 0.75)
            self.assertAlmostEqual(v["solving_rate_sd"], 0.5 / 2 ** 0.5)  # sample SD of [1, .5]
            self.assertEqual(rep["arms"]["full"]["solving_rate_sd"], 0.0)
            # per-task mean diff: t0 0, t1 +0.5 -> one win, no loss
            self.assertEqual(rep["vs_baseline"]["full"]["solving_wins_losses"], [1, 0])
            # asking for 3 repeats when only 2 exist leaves no paired task
            self.assertEqual(ev.report(ts, ["vanilla", "full"], path, repeats=3)["n_tasks_paired"], 0)

    def test_stochastic_fake_end_to_end(self):
        ts = tasks(6)
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "r.jsonl"
            ev.run_eval(ts, ["vanilla"], FlipGen(0.5, seed=7), Judge(), path, log=QUIET, repeats=5)
            rep = ev.report(ts, ["vanilla"], path, repeats=5)
            a = rep["arms"]["vanilla"]
            self.assertEqual(len(a["solving_rate_per_repeat"]), 5)
            self.assertGreater(a["solving_rate_sd"], 0, "flipping fake must show run-to-run variance")

    def test_repeats_do_not_inflate_significance(self):
        """8 tasks x 5 repeats must not look like 40 independent tasks."""
        rng = random.Random(3)
        n_t, n_r = 8, 5
        recs, naive = [], []
        for i in range(n_t):
            # Task-level effect: outcomes within a task are strongly correlated across repeats
            # (the usual case: task difficulty dominates), which is what pseudo-replication ignores.
            pv_, pf_ = rng.choice([0.05, 0.95]), rng.choice([0.05, 0.95])
            for r in range(n_r):
                v, f = rng.random() < pv_, rng.random() < pf_
                recs += [rec(f"t{i}", "vanilla", v, r), rec(f"t{i}", "full", f, r)]
                naive += [rec(f"t{i}_{r}", "vanilla", v, 0), rec(f"t{i}_{r}", "full", f, 0)]
        with tempfile.TemporaryDirectory() as d:
            p1, p2 = Path(d) / "a.jsonl", Path(d) / "b.jsonl"
            write(p1, recs); write(p2, naive)
            arms = ["vanilla", "full"]
            proper = ev.report(tasks(n_t), arms, p1, repeats=n_r)
            ind_tasks = [{"id": f"t{i}_{r}", "conversation": CONV, "rubrics": ["a", "b"]}
                         for i in range(n_t) for r in range(n_r)]
            indep = ev.report(ind_tasks, arms, p2, repeats=1)
        self.assertEqual(proper["n_tasks_paired"], n_t)
        self.assertEqual(indep["n_tasks_paired"], n_t * n_r)
        pv, iv = proper["vs_baseline"]["full"], indep["vs_baseline"]["full"]
        self.assertAlmostEqual(pv["solving_diff"], iv["solving_diff"])  # same point estimate
        wl = pv["solving_wins_losses"]
        self.assertLessEqual(sum(wl), n_t, "sign test unit is the task, not task x repeat")
        self.assertGreater(pv["solving_ci95"][1] - pv["solving_ci95"][0],
                           iv["solving_ci95"][1] - iv["solving_ci95"][0],
                           "task-level CI must be wider than the pseudo-replicated one")
        self.assertGreaterEqual(pv["solving_sign_test_p"], iv["solving_sign_test_p"])


if __name__ == "__main__":
    unittest.main()
