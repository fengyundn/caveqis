"""Verify tool results and the MCP transports used by packaged apps."""

import http.client
import json
from pathlib import Path
import subprocess
import sys
import unittest
from urllib.parse import urlsplit

from caveqis_mcp import dispatch, mobile_configuration


def request(method, params=None, identifier=1):
    message = {"jsonrpc": "2.0", "method": method}
    if identifier is not None:
        message["id"] = identifier
    if params is not None:
        message["params"] = params
    return json.dumps(message).encode("utf-8")


def call(name, **arguments):
    return dispatch(request("tools/call", {"name": name, "arguments": arguments}))


class ToolTests(unittest.TestCase):
    def test_exact_and_decimal(self):
        result = call("calculate", expression="1/3+2/5", decimalPlaces=6)["result"]
        self.assertFalse(result["isError"])
        item = result["structuredContent"]["items"][0]
        self.assertEqual((item["text"], item["approx"]), ("11/15", "0.733333"))

    def test_equation_and_graph_document(self):
        result = call("solve", expression="x^2=4", variables="x")["result"]["structuredContent"]
        self.assertTrue(result["ok"])
        self.assertIn("-2", result["items"][0]["text"])
        graph = call("prepare_graph", expressions=["y=a*x", "y=x^2"])["result"]["structuredContent"]
        self.assertEqual(graph["version"], 2)
        self.assertEqual(graph["rows"], [{"text": "y=a*x", "visible": True}, {"text": "y=x^2", "visible": True}])

    def test_schema_rejects_invalid_decimal_places(self):
        for value in (-1, 51, 4.5, True, "4"):
            with self.subTest(value=value):
                result = call("calculate", expression="pi", decimalPlaces=value)
                self.assertEqual(result["error"]["code"], -32602)

    def test_stdio_entry_and_initialization(self):
        program = Path(__file__).resolve().parents[1] / "caveqis_mcp.py"
        messages = [
            request("initialize", {"protocolVersion": "2025-11-25"}),
            request("notifications/initialized", identifier=None),
            request("tools/list", identifier=2),
        ]
        result = subprocess.run(
            [sys.executable, str(program)], input=b"\n".join(messages) + b"\n",
            capture_output=True, check=True, timeout=20,
        )
        initialized, listed = [json.loads(line) for line in result.stdout.splitlines()]
        self.assertEqual(result.stderr, b"")
        self.assertEqual(initialized["result"]["serverInfo"]["version"], "1.2.0")
        self.assertEqual(initialized["result"]["protocolVersion"], "2025-11-25")
        self.assertEqual({entry["name"] for entry in listed["result"]["tools"]}, {"calculate", "solve", "prepare_graph"})


class MobileTransportTests(unittest.TestCase):
    def test_authentication_and_token_rotation(self):
        configuration = json.loads(mobile_configuration(True))
        self.addCleanup(mobile_configuration, False)
        url = urlsplit(configuration["url"])
        self.assertEqual(url.hostname, "127.0.0.1")
        client = http.client.HTTPConnection(url.hostname, url.port, timeout=4)
        self.addCleanup(client.close)
        headers = {"Content-Type": "application/json", **configuration["headers"]}
        body = request("tools/list")

        def post(message, **options):
            client.request("POST", url.path, body, {**message, **options})
            result = client.getresponse()
            return result.status, result.read()

        self.assertEqual(post({"Content-Type": "application/json"})[0], 401)
        self.assertEqual(post(headers, Origin="https://example.test")[0], 403)
        self.assertEqual(post(headers, Host="example.test")[0], 403)
        status, result = post(headers)
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(result)["result"]["tools"]), 3)
        client.request("GET", url.path, headers=headers)
        result = client.getresponse()
        self.assertEqual(result.status, 405)
        result.read()
        self.assertEqual(json.loads(mobile_configuration(False)), {"enabled": False})
        updated = json.loads(mobile_configuration(True))
        self.assertNotEqual(updated["headers"]["Authorization"], headers["Authorization"])


if __name__ == "__main__":
    unittest.main()
