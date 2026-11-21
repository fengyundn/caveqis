"""CAVEQIS MCP tools and the authenticated, opt-in mobile transport."""

import json
import math
import secrets
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import BoundedSemaphore, Lock, Thread

from calculation import MAX_REQUEST_BYTES, MAX_RESULT_BYTES, compute_bounded, valid_calculation

VERSION = "1.2.0"
PROTOCOLS = ("2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05")
MAX_MESSAGE = MAX_REQUEST_BYTES + 4096

TEXT = {"type": "string"}
MATH_INPUT = {
    key: TEXT
    for key in ("category", "operation", "expression", "variables", "substitutions", "matrixA", "matrixB",
                "matrixEquation", "bounds", "lower", "upper", "point", "direction", "order", "scalar",
                "power", "row", "column", "angle", "assumption")
}
DECIMALS = {"type": "integer", "minimum": 0, "maximum": 50}
MATH_INPUT["decimalPlaces"] = DECIMALS
EQUATION_INPUT = {
    "expression": TEXT, "variables": TEXT, "guesses": TEXT,
    "domain": {"enum": ["real", "complex"]}, "decimalPlaces": DECIMALS,
    "mode": {"enum": ["auto", "solve", "linear", "system", "numeric", "ode", "integral"]},
}
GRAPH_INPUT = {
    "expressions": {"type": "array", "items": {"type": "string", "maxLength": 300},
                    "minItems": 1, "maxItems": 16}
}


def tool(name, description, properties, required=()):
    return {
        "name": name, "description": description,
        "inputSchema": {"type": "object", "properties": properties,
                        "required": list(required), "additionalProperties": False},
        "annotations": {"readOnlyHint": True, "destructiveHint": False,
                        "idempotentHint": True, "openWorldHint": False},
    }


TOOLS = [
    tool("calculate", "Evaluate exact or numerical expressions, matrices, derivatives, integrals, limits and series.", MATH_INPUT),
    tool("solve", "Solve one equation or multiple equations separated by newlines. Supply unknowns separately.", EQUATION_INPUT, ["expression"]),
    tool("prepare_graph", "Create a version 2 graph document that can be imported into CAVEQIS, with one expression per row.", GRAPH_INPUT, ["expressions"]),
]


def tool_result(outcome, is_error=False):
    text = json.dumps(outcome, ensure_ascii=False, allow_nan=False)
    if len(text.encode("utf-8")) > MAX_RESULT_BYTES:
        return tool_result({"ok": False, "error": "The result exceeds the response size limit."}, True)
    return {"content": [{"type": "text", "text": text}], "structuredContent": outcome, "isError": is_error}


def valid_argument(value, schema):
    kind = schema.get("type")
    if kind == "string":
        return isinstance(value, str) and len(value) <= schema.get("maxLength", MAX_REQUEST_BYTES)
    if kind == "integer":
        return type(value) is int and schema["minimum"] <= value <= schema["maximum"]
    if kind == "array":
        return (isinstance(value, list) and schema["minItems"] <= len(value) <= schema["maxItems"]
                and all(valid_argument(entry, schema["items"]) for entry in value))
    return value in schema["enum"]


def call_tool(params):
    definition = next((item for item in TOOLS if item["name"] == params.get("name")), None)
    arguments = params.get("arguments", {})
    if not definition or not isinstance(arguments, dict):
        raise ValueError
    schema = definition["inputSchema"]
    properties = schema["properties"]
    if (not all(key in arguments for key in schema["required"])
            or not all(key in properties and valid_argument(value, properties[key]) for key, value in arguments.items())):
        raise ValueError
    if definition["name"] == "prepare_graph":
        rows = [value.strip() for value in arguments["expressions"]]
        if not all(rows):
            raise ValueError
        return tool_result({
            "version": 2, "rows": [{"text": value, "visible": True} for value in rows],
            "sliders": {}, "view": {"x": 0, "y": 0, "span": 13, "xSpan": 0, "ySpan": 0},
            "settings": {"tMin": 0, "tMax": math.tau, "thetaMin": 0, "thetaMax": math.tau},
            "options": {"grid": True, "intersections": True, "trace": True},
        })
    data = dict(arguments)
    if definition["name"] == "solve":
        data.update(category="equations", operation="equation_" + data.pop("mode", "auto"))
    if not valid_calculation(data):
        raise ValueError
    outcome = compute_bounded(data)
    return tool_result(outcome, not outcome["ok"])


def error(code, message, request_id=None):
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def dispatch(raw):
    try:
        message = json.loads(raw.decode("utf-8"))
    except (ValueError, RecursionError):
        return error(-32700, "Parse error")
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0" or not isinstance(message.get("method"), str):
        return error(-32600, "Invalid request")
    if "id" not in message:
        return None
    request_id = message["id"]
    if type(request_id) not in (str, int):
        return error(-32600, "Invalid request")
    method = message["method"]
    params = message.get("params", {})
    if not isinstance(params, dict):
        return error(-32602, "Invalid parameters", request_id)
    try:
        if method == "initialize":
            version = params.get("protocolVersion")
            outcome = {"protocolVersion": version if version in PROTOCOLS else PROTOCOLS[0],
                       "capabilities": {"tools": {}}, "serverInfo": {"name": "CAVEQIS", "version": VERSION}}
        elif method == "ping":
            outcome = {}
        elif method == "tools/list":
            outcome = {"tools": TOOLS}
        elif method == "tools/call":
            outcome = call_tool(params)
        else:
            return error(-32601, "Method not found", request_id)
    except (ArithmeticError, ValueError, RecursionError):
        return error(-32602, "Invalid parameters", request_id)
    return {"jsonrpc": "2.0", "id": request_id, "result": outcome}


def encode(value):
    return json.dumps(value, allow_nan=False).encode("utf-8")


def stdio():
    source, destination = sys.stdin.buffer, sys.stdout.buffer
    while raw := source.readline(MAX_MESSAGE + 1):
        if len(raw) > MAX_MESSAGE:
            while raw and not raw.endswith(b"\n"):
                raw = source.readline(MAX_MESSAGE + 1)
            response = error(-32600, "Request exceeds the size limit")
        else:
            response = dispatch(raw)
        if response is not None:
            destination.write(encode(response) + b"\n")
            destination.flush()


class _MCPHandler(BaseHTTPRequestHandler):
    def setup(self):
        self.request.settimeout(4)
        super().setup()

    def log_message(self, _format, *_args):
        pass  # Request or bearer token data never reaches the app logs.

    def reply(self, status, payload=None):
        body = encode(payload) if payload is not None else b""
        self.send_response(status)
        if body:
            self.send_header("Content-Type", "application/json")
        if status == 401:
            self.send_header("WWW-Authenticate", "Bearer")
        if status == 405:
            self.send_header("Allow", "POST")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def authorized(self):
        if self.path != "/mcp":
            self.reply(404)
            return False
        if self.headers.get_all("Host") != [self.server.authority] or self.headers.get_all("Origin"):
            self.reply(403)
            return False
        provided = self.headers.get_all("Authorization") or []
        if len(provided) != 1 or not secrets.compare_digest(provided[0].encode("latin-1"), self.server.authorization):
            self.reply(401)
            return False
        return True

    def do_GET(self):
        if self.authorized():
            self.reply(405)

    do_DELETE = do_GET
    do_OPTIONS = do_GET

    def do_POST(self):
        if not self.authorized():
            return
        version = self.headers.get("MCP-Protocol-Version")
        if version and version not in PROTOCOLS[:3]:
            self.reply(400)
            return
        length = self.headers.get_all("Content-Length") or []
        if (self.headers.get_all("Transfer-Encoding") or len(length) != 1 or not length[0].isascii()
                or not length[0].isdigit() or len(length[0]) > 7):
            self.reply(400)
            return
        size = int(length[0])
        if size > MAX_MESSAGE:
            self.reply(413)
            return
        if self.headers.get_content_type() != "application/json":
            self.reply(415)
            return
        body = self.rfile.read(size)
        if len(body) != size:
            self.reply(400)
            return
        response = dispatch(body)
        self.reply(202 if response is None else 200, response)


class _MobileServer(ThreadingHTTPServer):
    request_queue_size = 4
    daemon_threads = True

    def __init__(self):
        super().__init__(("127.0.0.1", 0), _MCPHandler)
        self.token = secrets.token_urlsafe(32)
        self.authorization = ("Bearer " + self.token).encode("ascii")
        self.authority = f"127.0.0.1:{self.server_port}"
        self.slots = BoundedSemaphore(4)

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self.slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()

    def handle_error(self, _request, _client_address):
        pass


_mobile = None
_mobile_lock = Lock()


def mobile_configuration(enabled):
    global _mobile
    with _mobile_lock:
        if not enabled:
            if _mobile is not None:
                _mobile.shutdown()
                _mobile.server_close()
                _mobile = None
            return '{"enabled":false}'
        if _mobile is None:
            try:
                _mobile = _MobileServer()
            except OSError:
                return '{"enabled":false,"error":true}'
            Thread(target=_mobile.serve_forever, kwargs={"poll_interval": 0.1}, daemon=True).start()
        return json.dumps({"enabled": True, "url": f"http://{_mobile.authority}/mcp",
                           "headers": {"Authorization": "Bearer " + _mobile.token}})


if __name__ == "__main__":
    stdio()
