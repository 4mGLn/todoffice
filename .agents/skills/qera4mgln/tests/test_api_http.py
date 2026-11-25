"""Exercise the REAL ChatAdapter over HTTP against a local mock OpenAI-compatible server."""
import contextlib, io, json, os, socket, sys, tempfile, threading, time, unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import qera_eval as ev  # noqa: E402
import qera_run as run  # noqa: E402

EX = ROOT / "examples"
SECRET = "sk-test-SECRET-123"


def read_ex(name):
    return (EX / name).read_text(encoding="utf-8")


def chat(content):
    return {"choices": [{"message": {"role": "assistant", "content": content}}]}


class Mock:
    """Local server. `route(system, payload) -> (status, body, extra_headers)`."""

    def __init__(self, route=None):
        self.requests = []
        self.route = route or self.default_route
        self.judge_reply = None
        mock_ = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_GET(self):  # a followed 301/302/303 redirect arrives as GET
                mock_.requests.append({"path": self.path, "headers": dict(self.headers),
                                       "payload": None, "system": "", "method": "GET"})
                self.send_response(200)
                self.send_header("Content-Length", "0")
                self.end_headers()

            def do_POST(self):
                raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
                payload = json.loads(raw)
                system = payload["messages"][0]["content"]
                mock_.requests.append({"path": self.path, "headers": dict(self.headers),
                                       "payload": payload, "system": system})
                status, body, extra = mock_.route(system, payload)
                if isinstance(body, (dict, list)):
                    body = json.dumps(body)
                if isinstance(body, str):
                    body = body.encode("utf-8")
                try:
                    self.send_response(status)
                    for k, v in (extra or {}).items():
                        self.send_header(k, v)
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                except (BrokenPipeError, ConnectionResetError):
                    pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.server.daemon_threads = True
        self.thread = threading.Thread(target=lambda: self.server.serve_forever(poll_interval=0.02), daemon=True)

    @property
    def base(self):
        return f"http://127.0.0.1:{self.server.server_address[1]}/v1"

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *a):
        self.server.shutdown()
        self.server.server_close()

    def default_route(self, system, payload):
        if system == ev.VANILLA_SYSTEM:
            return 200, chat("I am not sure."), None
        if system == ev.JUDGE_SYSTEM:
            if self.judge_reply is not None:
                return 200, chat(self.judge_reply), None
            data = json.loads(payload["messages"][1]["content"])
            ok = "104 TPS" in data["response"]
            return 200, chat(json.dumps({"results": [{"id": r["id"], "pass": ok}
                                                     for r in data["rubrics"]]})), None
        if "planning stage" in system:
            return 200, chat(read_ex("ask-output.json")), None
        if "separate evidence reviewer" in system:
            return 200, chat(read_ex("check-output.json")), None
        if "editing a draft answer" in system:
            return 200, chat(read_ex("repaired.txt")), None
        if "Write your reply to the user's last message" in system:
            return 200, chat(read_ex("draft.txt")), None
        return 500, "unrouted system prompt", None

    def stages(self):
        out = []
        for r in self.requests:
            s = r["system"]
            for key, name in (("planning stage", "ask"), ("separate evidence reviewer", "check"),
                              ("editing a draft answer", "repair"), ("strict grader", "judge"),
                              ("Write your reply to the user's last message", "answer")):
                if key in s:
                    out.append(name)
                    break
            else:
                out.append("vanilla")
        return out


def adapter(m, key="", timeout=5):
    return run.ChatAdapter("m", m.base, key, timeout=timeout)


def conv():
    return json.loads(read_ex("conversation.json"))


class PipelineOverHttp(unittest.TestCase):
    def test_empty_check_is_incomplete_over_http(self):
        def route(system, payload):
            if "separate evidence reviewer" in system:
                return 200, chat("{}"), None
            return m.default_route(system, payload)
        with Mock(route) as m:
            result = run.run_pipeline(conv(), adapter(m), mode="full")
            self.assertEqual(m.stages(), ["ask", "answer", "check"])
            self.assertEqual(result["stage"], "check_incomplete")
            self.assertFalse(result["audit"]["check_complete"])
            self.assertEqual(result["answer"], read_ex("draft.txt"))

    def test_draft_full_adaptive(self):
        for mode, stages in (("draft", ["ask", "answer"]),
                             ("full", ["ask", "answer", "check", "repair"]),
                             ("adaptive", ["ask", "answer", "check", "repair"])):
            with self.subTest(mode=mode), Mock() as m:
                out = run.run_pipeline(conv(), adapter(m, SECRET), mode=mode)
                self.assertEqual(m.stages(), stages)
                self.assertTrue(out["answer"].strip())
                self.assertTrue(all(r["path"] == "/v1/chat/completions" for r in m.requests))
                self.assertTrue(all(r["headers"].get("Authorization") == "Bearer " + SECRET
                                    for r in m.requests))
                self.assertEqual(m.requests[0]["payload"]["model"], "m")
                if mode != "draft":
                    self.assertIn(out["stage"], {"repaired", "repair_rejected", "checked"})

    def test_auth_header_only_with_key(self):
        with Mock(lambda s, p: (200, chat("ok"), None)) as m:
            adapter(m, "").complete("s", {"a": 1})
            adapter(m, SECRET).complete("s", {"a": 1})
        self.assertNotIn("Authorization", m.requests[0]["headers"])
        self.assertEqual(m.requests[1]["headers"]["Authorization"], "Bearer " + SECRET)

    def test_utf8_roundtrip(self):
        with Mock(lambda s, p: (200, chat("한글 ok"), None)) as m:
            self.assertEqual(adapter(m).complete("s", {"q": "질문"}), "한글 ok")
            self.assertIn("질문", m.requests[0]["payload"]["messages"][1]["content"])


class ResponseShapes(unittest.TestCase):
    def complete(self, status, body, extra=None, key=SECRET, timeout=5):
        with Mock(lambda s, p: (status, body, extra)) as m:
            return adapter(m, key, timeout).complete("s", {"a": 1})

    def test_content_parts(self):
        parts = [{"type": "text", "text": "A"}, {"type": "text", "text": "B"}, "junk", {"type": "image"}]
        self.assertEqual(self.complete(200, chat(parts)), "AB")

    def test_bad_shapes_raise_valueerror(self):
        for name, body in {
            "empty": chat(""), "blank": chat("   "), "null": chat(None),
            "empty list": chat([]), "no choices": {"id": "x"}, "choices empty": {"choices": []},
            "choices str": {"choices": "x"}, "no message": {"choices": [{}]},
            "json list": [1, 2], "json string": '"hi"', "json null": "null",
            "not json": "<html>oops</html>", "empty body": "",
        }.items():
            with self.subTest(name):
                with self.assertRaises(ValueError) as cm:
                    self.complete(200, body)
                self.assertNotIn(SECRET, str(cm.exception))

    def test_http_errors_clean(self):
        for status in (400, 401, 403, 404, 429, 500, 502, 503):
            with self.subTest(status):
                with self.assertRaises(RuntimeError) as cm:
                    self.complete(status, {"error": {"message": "echo " + SECRET + " private-ctx"}})
                msg = str(cm.exception)
                self.assertIn(f"HTTP {status}", msg)
                self.assertNotIn(SECRET, msg)
                self.assertNotIn("private-ctx", msg)

    def test_timeout_is_clean(self):
        def slow(s, p):
            time.sleep(1.5)
            return 200, chat("late"), None
        with Mock(slow) as m:
            t0 = time.time()
            with self.assertRaises(RuntimeError) as cm:
                adapter(m, SECRET, timeout=0.4).complete("s", {})
            self.assertLess(time.time() - t0, 1.4)
            self.assertNotIn(SECRET, str(cm.exception))

    def test_body_stall_timeout_is_clean(self):
        # Headers arrive, body stalls: read() raises a raw socket timeout, not URLError.
        srv = socket.socket()
        srv.bind(("127.0.0.1", 0))
        srv.listen(1)
        port = srv.getsockname()[1]

        def serve():
            c, _ = srv.accept()
            c.recv(65536)
            c.sendall(b'HTTP/1.1 200 OK\r\nContent-Length: 500\r\n\r\n{"choi')
            time.sleep(1.5)
            c.close()
        threading.Thread(target=serve, daemon=True).start()
        a = run.ChatAdapter("m", f"http://127.0.0.1:{port}/v1", SECRET, timeout=0.4)
        with self.assertRaises(RuntimeError) as cm:
            a.complete("s", {})
        self.assertNotIn(SECRET, str(cm.exception))
        srv.close()

    def test_connection_refused_clean(self):
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
        with self.assertRaises(RuntimeError) as cm:
            run.ChatAdapter("m", f"http://127.0.0.1:{port}/v1", SECRET, timeout=2).complete("s", {})
        self.assertNotIn(SECRET, str(cm.exception))

    def test_redirect_does_not_forward_key(self):
        with Mock(lambda s, p: (200, chat("leak"), None)) as sink:
            target = sink.base + "/chat/completions"
            for code in (301, 302, 303, 307, 308):
                with self.subTest(code):
                    sink.requests.clear()
                    with Mock(lambda s, p, c=code: (c, "", {"Location": target})) as front:
                        try:
                            adapter(front, SECRET).complete("s", {})
                        except Exception:
                            pass
                    self.assertEqual(sink.requests, [], "followed redirect (would forward key/prompt)")


class JsonStage(unittest.TestCase):
    def test_fenced_json(self):
        def route(s, p):
            if "planning stage" in s:
                return 200, chat("```json\n" + read_ex("ask-output.json") + "\n```"), None
            return 200, chat(read_ex("draft.txt")), None
        with Mock(route) as m:
            out = run.run_pipeline(conv(), adapter(m), mode="draft")
        self.assertTrue(out["contract"]["requirements"])

    def test_json_with_extra_prose_fails_cleanly_after_retry(self):
        # parse_json_response is strict: prose around JSON is rejected after 1 retry.
        reply = "Sure! Here you go:\n" + read_ex("ask-output.json") + "\nBye"
        with Mock(lambda s, p: (200, chat(reply), None)) as m:
            with self.assertRaises(ValueError) as cm:
                run.run_pipeline(conv(), adapter(m, SECRET), mode="draft")
        self.assertEqual(m.stages().count("ask"), 2)
        self.assertIn("ask stage", str(cm.exception))
        self.assertNotIn(SECRET, str(cm.exception))
        self.assertIn("retry with ONE JSON object", m.requests[1]["system"])

    def test_recovers_on_retry(self):
        n = {"i": 0}

        def route(s, p):
            if "planning stage" in s:
                n["i"] += 1
                return 200, chat("not json" if n["i"] == 1 else read_ex("ask-output.json")), None
            return 200, chat(read_ex("draft.txt")), None
        with Mock(route) as m:
            out = run.run_pipeline(conv(), adapter(m), mode="draft")
        self.assertTrue(out["contract"]["requirements"])

    def test_http_error_in_stage_propagates_runtimeerror(self):
        with Mock(lambda s, p: (500, "boom", None)) as m:
            with self.assertRaises(RuntimeError):
                run.run_pipeline(conv(), adapter(m, SECRET), mode="draft")
        self.assertEqual(len(m.requests), 1)

    def test_fence_variants(self):
        for text in ('```\n{"a":1}\n```', '```json\n{"a":1}\n```  \n', '  {"a":1}  '):
            self.assertEqual(run.parse_json_response(text), {"a": 1})
        for bad in ('```json\n{"a":1}', "[1]", ""):
            with self.assertRaises(ValueError):
                run.parse_json_response(bad)


class JudgePath(unittest.TestCase):
    def judge(self, reply, answer="104 TPS"):
        t = {"id": "t", "conversation": conv(), "rubrics": ["a", "b"]}
        with Mock() as m:
            m.judge_reply = reply
            try:
                return ev.judge(t, answer, adapter(m)), len(m.requests)
            except Exception as e:  # noqa: BLE001
                return e, len(m.requests)

    def test_valid_and_fenced(self):
        good = json.dumps({"results": [{"id": 0, "pass": True}, {"id": 1, "pass": False}]})
        self.assertEqual(self.judge(good)[0], [True, False])
        self.assertEqual(self.judge("```json\n" + good + "\n```")[0], [True, False])

    def test_string_ids_and_order(self):
        r = json.dumps({"results": [{"id": "1", "pass": False}, {"id": "0", "pass": True}]})
        self.assertEqual(self.judge(r)[0], [True, False])

    def test_missing_rubric_ids_raise_after_retry(self):
        e, n = self.judge(json.dumps({"results": [{"id": 0, "pass": True}]}))
        self.assertIsInstance(e, ValueError)
        self.assertEqual(n, 2)

    def test_extra_ids_rejected(self):
        r = json.dumps({"results": [{"id": i, "pass": True} for i in range(3)]})
        self.assertIsInstance(self.judge(r)[0], ValueError)

    def test_malformed_shapes_raise_cleanly(self):
        for r in ('{"results": "x"}', '{"results": [1]}', '{"results": [{"id": 0}]}',
                  '{"results": [{"id": "a", "pass": true}]}', '{"nope": 1}', 'not json', '[]',
                  '{"results": [{"id": null, "pass": true}, {"id": 1, "pass": true}]}'):
            with self.subTest(r=r):
                e, n = self.judge(r)
                self.assertIsInstance(e, ValueError)
                self.assertEqual(n, 2)

    def test_string_booleans_are_not_coerced_unsafely(self):
        # bool("false") is True in Python: a judge returning "false" must NOT pass the rubric.
        r = json.dumps({"results": [{"id": 0, "pass": "false"}, {"id": 1, "pass": "true"}]})
        self.assertEqual(self.judge(r)[0], [False, True])

    def test_other_falsy_strings(self):  # same bug as above ("no" -> True)
        r = json.dumps({"results": [{"id": 0, "pass": "no"}, {"id": 1, "pass": 0}]})
        self.assertEqual(self.judge(r)[0], [False, False])

    def test_duplicate_conflicting_ids_do_not_silently_pass(self):
        r = json.dumps({"results": [{"id": 0, "pass": True}, {"id": 0, "pass": False},
                                    {"id": 1, "pass": True}]})
        got, _ = self.judge(r)
        self.assertTrue(isinstance(got, Exception) or got[0] is False, got)

    def test_judge_http_failure_recorded_not_raised(self):
        t = {"id": "t", "conversation": conv(), "rubrics": ["a", "b"]}
        with Mock(lambda s, p: (503, "x", None) if s == ev.JUDGE_SYSTEM
                  else (200, chat("an answer"), None)) as m:
            with tempfile.TemporaryDirectory() as d:
                path = Path(d) / "r.jsonl"
                ev.run_eval([t], ["vanilla"], adapter(m, SECRET), adapter(m, SECRET), path,
                            log=lambda *_: None)
                rec = json.loads(path.read_text())
        self.assertIsNone(rec["passes"])
        self.assertIn("HTTP 503", rec["judge_error"])
        self.assertNotIn(SECRET, json.dumps(rec))


class EvalCli(unittest.TestCase):
    def cli(self, argv, env_extra, base):
        env = {"QERA_API_BASE": base, "QERA_MODEL": "gen-model", "QERA_API_KEY": SECRET,
               "NO_PROXY": "127.0.0.1", "no_proxy": "127.0.0.1"}
        env.update(env_extra or {})
        buf, err = io.StringIO(), io.StringIO()
        with mock.patch.dict(os.environ, env), contextlib.redirect_stdout(buf), \
                contextlib.redirect_stderr(err):
            rc = ev.main(argv)
        return rc, buf.getvalue(), err.getvalue()

    def test_run_and_report_end_to_end(self):
        tasks = {"tasks": [{"id": f"t{i}", "conversation": conv(), "rubrics": ["a", "b"]}
                           for i in range(3)]}
        with Mock() as m, tempfile.TemporaryDirectory() as d:
            tp, rp = Path(d) / "t.json", Path(d) / "r.jsonl"
            tp.write_text(json.dumps(tasks))
            base = ["--tasks", str(tp), "--results", str(rp),
                    "--arms", "vanilla,draft,adaptive,full", "--timeout", "10"]
            rc, out, err = self.cli(["run", *base], None, m.base)
            self.assertEqual(rc, 0)
            self.assertIn("self-judging", err)
            self.assertNotIn(SECRET, out + err)
            recs = [json.loads(l) for l in rp.read_text().splitlines()]
            self.assertEqual(len(recs), 12)
            self.assertTrue(all(r["passes"] is not None for r in recs))
            self.assertFalse(any(r.get("error") for r in recs))
            by = {r["arm"]: r for r in recs if r["task"] == "t0"}
            self.assertEqual(by["vanilla"]["passes"], [False, False])
            self.assertEqual(by["draft"]["calls"], 2)
            self.assertEqual(by["full"]["calls"], 4)
            self.assertEqual(by["full"]["passes"], [True, True])
            n_req = len(m.requests)
            self.cli(["run", *base], None, m.base)  # resume: no new calls
            self.assertEqual(len(m.requests), n_req)
            rc, out, err = self.cli(["report", *base], None, m.base)
            self.assertEqual(rc, 0)
            self.assertIn("Paired tasks: 3/3", out)
            self.assertIn("full vs vanilla", out)
            self.assertEqual(len(m.requests), n_req, "report must not hit the network")
            self.assertEqual(oct(rp.stat().st_mode & 0o777), "0o600")

    def test_stale_results_fail_cleanly_without_http_calls_or_writes(self):
        for change in ("task", "model", "judge_context"):
            with self.subTest(change=change), Mock() as m, tempfile.TemporaryDirectory() as d:
                tp, rp = Path(d) / "t.json", Path(d) / "r.jsonl"
                task = {"id": "t", "conversation": conv(), "rubrics": ["a"]}
                tp.write_text(json.dumps({"tasks": [task]}))
                argv = ["--tasks", str(tp), "--results", str(rp), "--arms", "vanilla"]
                rc, _, _ = self.cli(["run", *argv], None, m.base)
                self.assertEqual(rc, 0)
                before, calls = rp.read_bytes(), len(m.requests)
                extra = None
                if change == "task":
                    task["rubrics"] = ["b", "c"]
                    tp.write_text(json.dumps({"tasks": [task]}))
                elif change == "model":
                    extra = {"QERA_MODEL": "different-fixture-model"}
                else:
                    argv.append("--judge-context")
                rc, out, err = self.cli(["run", *argv], extra, m.base)
                self.assertEqual(rc, 2)
                self.assertNotIn("Paired tasks:", out)
                self.assertNotIn("Traceback", err)
                self.assertIn("new --results", err)
                if change != "model":
                    rc, out, _ = self.cli(["report", *argv], extra, m.base)
                    self.assertEqual(rc, 2)
                    self.assertNotIn("Paired tasks:", out)
                self.assertEqual(len(m.requests), calls)
                self.assertEqual(rp.read_bytes(), before)

    def test_separate_judge_endpoint(self):
        with Mock() as gen, Mock() as jd, tempfile.TemporaryDirectory() as d:
            tp, rp = Path(d) / "t.json", Path(d) / "r.jsonl"
            tp.write_text(json.dumps({"tasks": [{"id": "t", "conversation": conv(),
                                                 "rubrics": ["a"]}]}))
            rc, out, err = self.cli(["run", "--tasks", str(tp), "--results", str(rp),
                                     "--arms", "draft"],
                                    {"QERA_JUDGE_API_BASE": jd.base, "QERA_JUDGE_MODEL": "judge-m",
                                     "QERA_JUDGE_API_KEY": ""}, gen.base)
            self.assertEqual(rc, 0)
            self.assertNotIn("self-judging", err)
            self.assertEqual(set(jd.stages()), {"judge"})
            self.assertNotIn("judge", gen.stages())
            self.assertEqual(jd.requests[0]["payload"]["model"], "judge-m")
            self.assertEqual(gen.requests[0]["headers"]["Authorization"], "Bearer " + SECRET)

    def test_judge_host_does_not_receive_generator_key(self):
        # Regression: generator key must not reach a different judge host.
        with Mock() as gen, Mock() as jd, tempfile.TemporaryDirectory() as d:
            tp, rp = Path(d) / "t.json", Path(d) / "r.jsonl"
            tp.write_text(json.dumps({"tasks": [{"id": "t", "conversation": conv(),
                                                 "rubrics": ["a"]}]}))
            self.cli(["run", "--tasks", str(tp), "--results", str(rp), "--arms", "draft"],
                     {"QERA_JUDGE_API_BASE": jd.base, "QERA_JUDGE_MODEL": "judge-m",
                      "QERA_JUDGE_API_KEY": ""}, gen.base)
            self.assertNotIn("Authorization", jd.requests[0]["headers"])

    def test_cli_records_generation_errors(self):
        holder = []

        def route(s, p):
            if "planning stage" in s:
                return 500, "echo " + SECRET, None
            return Mock.default_route(holder[0], s, p)
        with tempfile.TemporaryDirectory() as d, Mock(route) as m:
            holder.append(m)
            tp, rp = Path(d) / "t.json", Path(d) / "r.jsonl"
            tp.write_text(json.dumps({"tasks": [{"id": "t", "conversation": conv(),
                                                 "rubrics": ["a"]}]}))
            rc, out, err = self.cli(["run", "--tasks", str(tp), "--results", str(rp),
                                     "--arms", "vanilla,draft"], None, m.base)
            text = rp.read_text()
            rec = {json.loads(l)["arm"]: json.loads(l) for l in text.splitlines()}
        self.assertEqual(rc, 0)
        self.assertIn("HTTP 500", rec["draft"]["error"])
        self.assertEqual(rec["draft"]["passes"], [False])
        self.assertNotIn(SECRET, text + out + err)

    def test_missing_api_base_returns_clean_cli_error(self):
        rc, out, err = self.cli(["run", "--tasks", str(EX / "eval" / "tasks.example.json"),
                                "--results", "/nonexistent-dir-qera/r.jsonl"],
                               {"QERA_API_BASE": ""}, "")
        self.assertEqual(rc, 2)
        self.assertEqual(out, "")
        self.assertIn("API endpoint missing", err)
        self.assertNotIn("Traceback", err)


if __name__ == "__main__":
    unittest.main()
