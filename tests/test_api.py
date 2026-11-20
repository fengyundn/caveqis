"""HTTP contract and real isolated-worker smoke checks."""
import unittest
from app import app, visits


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client=app.test_client()
        visits.clear()

    def calculate(self, **data):
        return self.client.post("/api/calculate", json=data)

    def test_assets_and_health(self):
        self.assertTrue(self.client.get("/api/health").json["ok"])
        for path in ["/", "/static/app.js", "/static/math-input.js", "/static/style.css", "/static/vendor/katex/katex.min.js", "/static/vendor/katex/fonts/KaTeX_Main-Regular.woff2"]:
            with self.subTest(path=path):
                response=self.client.get(path)
                self.assertEqual(response.status_code,200)
                self.assertEqual(response.headers["X-Content-Type-Options"],"nosniff")
                response.close()
        with self.client.get("/static/caveqis.png") as logo:
            self.assertEqual(logo.status_code,200)
            self.assertEqual(logo.mimetype,"image/png")
            self.assertTrue(logo.data.startswith(b"\x89PNG\r\n\x1a\n"))

    def test_isolated_worker(self):
        response=self.calculate(category="calculate",operation="evaluate",expression="1/3+2/5")
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json["items"][0]["text"],"11/15")
        self.assertGreater(response.json["elapsed_ms"],0)

    def test_errors_release_worker_slot(self):
        response=self.calculate(category="matrix",operation="inverse",matrixA="1,2\n2,4")
        self.assertEqual(response.status_code,422)
        self.assertFalse(response.json["ok"])
        response=self.calculate(category="calculate",operation="evaluate",expression="2+2")
        self.assertEqual(response.json["items"][0]["text"],"4")

    def test_request_boundaries(self):
        self.assertEqual(self.client.post("/api/calculate",data="1+2").status_code,415)
        self.assertEqual(self.client.post("/api/calculate",json=[]).status_code,400)
        self.assertEqual(self.client.post("/api/calculate",json={"expression":[]}).status_code,400)
        self.assertEqual(self.client.post("/api/calculate",json={},headers={"Origin":"https://another.example"}).status_code,403)
        self.assertEqual(self.client.post("/api/calculate",json={"expression":"x"*30000}).status_code,413)
        # Populate the per-connection window without launching 40 math processes.
        import collections,time
        visits["127.0.0.1"]=collections.deque([time.monotonic()]*40)
        self.assertEqual(self.calculate(expression="2+2").status_code,429)


if __name__=="__main__":
    unittest.main()
