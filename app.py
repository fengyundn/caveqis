"""Local / VPS WSGI app. Each calculation runs in a time-limited child process."""
from __future__ import annotations

import collections
import json
import multiprocessing as mp
import os
from pathlib import Path
import threading
import time

from flask import Flask, jsonify, request, send_from_directory
from calculation import compute_result

ROOT = Path(__file__).resolve().parent
app = Flask(__name__, static_folder="static", static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 24 * 1024
if os.environ.get("MATH_TRUST_PROXY") == "1":
    from werkzeug.middleware.proxy_fix import ProxyFix
    # Enable only when bound to loopback behind one configured reverse proxy.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=0, x_port=0, x_prefix=0)
TIMEOUT = min(30, max(2, float(os.environ.get("MATH_TIMEOUT", "12"))))
SLOTS = threading.BoundedSemaphore(min(2, max(1, int(os.environ.get("MATH_WORKERS", "1")))))
RATE_LIMIT = 40
SERVER_OPTIONS = {
    "threads": 6,
    "max_request_body_size": 24 * 1024,
    "channel_timeout": 30,
    "connection_limit": 64,
}
visits = collections.OrderedDict()
visits_lock = threading.Lock()


def calculation_worker(connection, data):
    try:
        if os.name == "posix":
            import resource
            resource.setrlimit(resource.RLIMIT_AS, (384 * 1024**2, 384 * 1024**2))
            resource.setrlimit(resource.RLIMIT_CPU, (int(TIMEOUT) + 1, int(TIMEOUT) + 2))
        connection.send(compute_result(data))
    except (MemoryError, OSError):
        pass
    finally:
        connection.close()


@app.after_request
def headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"
    )
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/")
def home():
    return send_from_directory(ROOT / "static", "index.html")


@app.get("/api/health")
def health():
    return jsonify(ok=True, engine="SymPy", timeout=TIMEOUT)


@app.post("/api/calculate")
def calculate():
    # JSON-only and no permissive CORS. The proxy must retain the same origin.
    if not request.is_json:
        return jsonify(ok=False, error="请使用 JSON 格式提交计算。"), 415
    if request.headers.get("Sec-Fetch-Site") == "cross-site":
        return jsonify(ok=False, error="不接受跨站请求。"), 403
    origin = request.headers.get("Origin")
    if origin and origin.rstrip("/") != request.host_url.rstrip("/"):
        return jsonify(ok=False, error="请求来源与工具箱地址不一致。"), 403
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(ok=False, error="请求格式须为 JSON 对象。"), 400
    if any(not isinstance(v, (str, int, float, bool)) for v in data.values()) or len(data) > 24:
        return jsonify(ok=False, error="请求字段格式不正确。"), 400
    # Use connection IP only. Never trust arbitrary X-Forwarded-For headers.
    address = request.remote_addr or "unknown"
    now = time.monotonic()
    with visits_lock:
        history = visits.pop(address, collections.deque())
        while history and history[0] < now - 60:
            history.popleft()
        allowed = len(history) < RATE_LIMIT
        if allowed:
            history.append(now)
        visits[address] = history
        while len(visits) > 2048:
            visits.popitem(last=False)
    if not allowed:
        return jsonify(ok=False, error="计算较频繁，请稍后再试（每分钟最多 40 次）。"), 429
    if not SLOTS.acquire(blocking=False):
        return jsonify(ok=False, error="当前有计算正在进行，请稍后重试。"), 429
    process = None
    receiver = sender = None
    started = time.perf_counter()
    try:
        context = mp.get_context("spawn")
        receiver, sender = context.Pipe(duplex=False)
        process = context.Process(target=calculation_worker, args=(sender, data), daemon=True)
        process.start()
        sender.close()
        if not receiver.poll(TIMEOUT):
            return jsonify(ok=False, error=f"计算超过 {TIMEOUT:g} 秒已停止，请减小问题规模或简化表达式。"), 408
        try:
            answer = receiver.recv()
        except EOFError:
            return jsonify(ok=False, error="计算超出资源限制，请简化表达式或缩小矩阵。"), 422
        answer["elapsed_ms"] = round((time.perf_counter() - started) * 1000)
        return jsonify(answer), 200 if answer["ok"] else 422
    finally:
        if process is not None and process.pid is not None:
            process.join(timeout=0.1)
            if process.is_alive():
                process.terminate()
                process.join(timeout=1)
                if process.is_alive():
                    process.kill()
                    process.join()
        if receiver is not None:
            receiver.close()
        if sender is not None:
            sender.close()
        SLOTS.release()


@app.errorhandler(413)
def too_large(_):
    return jsonify(ok=False, error="输入内容超过 24 KB，请拆分计算。"), 413


@app.errorhandler(404)
def not_found(_):
    return jsonify(ok=False, error="页面不存在。"), 404


if __name__ == "__main__":
    import argparse
    from waitress import serve
    mp.freeze_support()
    parser = argparse.ArgumentParser(description="数学工具箱")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    options = parser.parse_args()
    print(f"Math Toolbox: http://{options.host}:{options.port}", flush=True)
    serve(app, host=options.host, port=options.port, **SERVER_OPTIONS)
