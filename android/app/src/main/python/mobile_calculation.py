"""Decode and dispatch requests to the same engine used by CAVEQIS on desktop."""

import json
from time import perf_counter

from calculation import compute_result


def calculate(payload):
    started = perf_counter()
    try:
        data = json.loads(payload)
    except (ValueError, RecursionError):
        data = None
    if not isinstance(data, dict) or len(data) > 24 or any(
        not isinstance(value, (str, int, float, bool)) for value in data.values()
    ):
        outcome = {"ok": False, "error": "请求字段格式不正确。"}
    else:
        outcome = compute_result(data)
    outcome["elapsed_ms"] = round((perf_counter() - started) * 1000)
    return json.dumps(outcome, ensure_ascii=False)
