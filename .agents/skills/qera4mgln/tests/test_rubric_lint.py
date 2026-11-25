import io, json, sys, tempfile, unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import qera_rubric_lint as rl  # noqa: E402
import qera_eval as ev  # noqa: E402

EXAMPLE = ROOT / "examples" / "eval" / "tasks.implicit.example.json"


def task(req, rubrics, ctx="context"):
    return {"id": "t", "conversation": {"messages": [
        {"role": "user", "content": ctx}, {"role": "user", "content": req}]},
        "rubrics": rubrics}


class ClassifyTests(unittest.TestCase):
    def test_explicit_when_overlap_at_least_60(self):
        r = rl.classify("Lists the quarterly revenue numbers", "List quarterly revenue numbers")
        self.assertEqual(r["label"], "explicit")

    def test_implicit_when_words_absent_from_request(self):
        r = rl.classify("Uses 35 dollars for drinks, the corrected figure", "Give me the tally")
        self.assertEqual(r["label"], "implicit")
        self.assertEqual(r["overlap"], 0.0)

    def test_exact_boundary(self):
        r = rl.classify("Totals 10 20 30 40 50", "10 20 30")  # 'totals' is a word -> 6 words
        self.assertEqual(r["n_words"], 6)
        r2 = rl.classify("Mix 10 20 30 40 50", "10 20 30")    # 'Mix' too short -> 5 numbers
        self.assertEqual((r2["n_words"], r2["overlap"], r2["label"]), (5, 0.6, "explicit"))

    def test_fewer_than_two_content_words_unclassified(self):
        self.assertEqual(rl.classify("Is good", "anything")["label"], "unclassified")

    def test_numbers_normalize_commas(self):
        r = rl.classify("States 1,200 and 55", "we have 1200 and 55")
        self.assertEqual(r["label"], "explicit")

    def test_for_example_clause_removed(self):
        words = [v for _, v in rl.content_words("Names the planet, for example Jupiter or Saturn")]
        self.assertNotIn("jupiter", words)
        self.assertIn("planet", words)

    def test_quoted_string_is_single_unit(self):
        cw = rl.content_words('Prints "hello world" twice')
        self.assertIn(("quote", "hello world"), cw)
        self.assertNotIn(("word", "hello"), cw)

    def test_capitalized_name_not_sentence_initial(self):
        cw = rl.content_words("Mentions Maria and Tomas")
        self.assertIn(("name", "maria"), cw)
        self.assertIn(("name", "tomas"), cw)

    def test_only_last_user_message_is_request(self):
        t = task("short ask", ["x"], ctx="bravo upgraded gigabytes")
        self.assertEqual(rl.final_request(t), "short ask")


class LintTests(unittest.TestCase):
    def test_share_and_warning(self):
        tasks = [task("List quarterly revenue numbers",
                      ["Lists the quarterly revenue numbers", "Reports the revenue numbers quarterly"])]
        rep = rl.lint(tasks)
        self.assertEqual(rep["implicit_share"], 0.0)
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "t.json"
            p.write_text(json.dumps({"tasks": tasks}))
            buf = io.StringIO()
            with redirect_stdout(buf):
                code = rl.main([str(p), "--strict"])
            self.assertEqual(code, 1)
            self.assertIn("WARNING", buf.getvalue())

    def test_synthetic_example_mostly_implicit_and_mixed(self):
        data = json.loads(EXAMPLE.read_text(encoding="utf-8"))
        self.assertIn("SYNTHETIC", data["_label"])
        rep = rl.lint(data["tasks"])
        self.assertEqual(len(data["tasks"]), 6)
        self.assertGreaterEqual(rep["implicit_share"], 0.7)
        for t in rep["tasks"]:
            self.assertGreaterEqual(t["counts"]["explicit"], 1, t["id"])
            self.assertGreaterEqual(t["counts"]["implicit"], 1, t["id"])

    def test_synthetic_example_loads_in_harness(self):
        self.assertEqual(len(ev.load_tasks(str(EXAMPLE))), 6)

    def test_existing_example_runs(self):
        p = ROOT / "examples" / "eval" / "tasks.example.json"
        with redirect_stdout(io.StringIO()):
            self.assertEqual(rl.main([str(p)]), 0)


if __name__ == "__main__":
    unittest.main()


class RequestModeTests(unittest.TestCase):
    def test_task_mode_strips_pasted_context(self):
        import qera_rubric_lint as L
        t = {"id": "x", "rubrics": ["The response lists Orchid Lantern shipments"],
             "conversation": {"messages": [{"role": "user", "content":
                "Orchid Lantern shipments arrived Monday.\n<|TASK|>\nSummarize my week."}]}}
        self.assertEqual(L.final_request(t, "task").strip(), "Summarize my week.")
        self.assertIn("Orchid", L.final_request(t, "full"))
        self.assertEqual(L.lint([t], request_mode="full")["totals"]["explicit"], 1)
        self.assertEqual(L.lint([t], request_mode="task")["totals"]["implicit"], 1)
