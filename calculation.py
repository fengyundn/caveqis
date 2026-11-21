"""Shared calculation result handling for desktop and mobile callers."""

import json
import sys
from threading import Lock
from time import monotonic, perf_counter

MAX_REQUEST_BYTES = 24 * 1024
MAX_RESULT_BYTES = 256 * 1024
_mobile_engine = Lock()


class _DeadlineExceeded(BaseException):
    """Escape a calculation's broad error handler when its deadline expires."""


def compute_result(data):
    from engine import InputError, compute

    try:
        return {"ok": True, **compute(data)}
    except InputError as error:
        return {"ok": False, "error": str(error)}
    except (ValueError, TypeError, NotImplementedError, ZeroDivisionError) as error:
        message = str(error).lower()
        if "invert" in message or "det == 0" in message:
            hint = "矩阵不可逆，行列式为零。"
        elif "nonlinear" in message:
            hint = "检测到非线性项，请改用符号求根或非线性方程组模式。"
        elif "could not find root" in message:
            hint = "当前初值未能找到满足精度的根，请更换初值。"
        else:
            hint = "当前表达式不满足此操作的条件，或暂时无法求解；请检查尺寸、参数、定义域或更换计算方式。"
        return {"ok": False, "error": hint}
    except Exception:
        return {"ok": False, "error": "此问题暂时无法完成计算，请缩小规模或改写表达式。"}


def compute_bounded(data, seconds=12):
    """Time-limit embedded Python, where a new worker process is not portable."""
    if not _mobile_engine.acquire(blocking=False):
        return {"ok": False, "error": "当前有计算正在进行，请稍后重试。"}
    previous = sys.gettrace()
    deadline = monotonic() + seconds
    events = 0

    def watch(_frame, _event, _argument):
        nonlocal events
        events += 1
        if events % 128 == 0 and monotonic() >= deadline:
            raise _DeadlineExceeded
        return watch

    try:
        sys.settrace(watch)
        return compute_result(data)
    except _DeadlineExceeded:
        return {"ok": False, "error": "计算超过 12 秒已停止，请减小问题规模或简化表达式。"}
    finally:
        sys.settrace(previous)
        _mobile_engine.release()


def valid_calculation(data):
    return isinstance(data, dict) and len(data) <= 24 and all(
        isinstance(value, (str, int, float, bool)) for value in data.values()
    )


def calculate_json(payload):
    started = perf_counter()
    try:
        data = json.loads(payload) if len(payload.encode("utf-8")) <= MAX_REQUEST_BYTES else None
    except (ValueError, RecursionError):
        data = None
    if valid_calculation(data):
        outcome = compute_bounded(data)
    else:
        outcome = {"ok": False, "error": "请求字段格式不正确。"}
    outcome["elapsed_ms"] = round((perf_counter() - started) * 1000)
    result = json.dumps(outcome, ensure_ascii=False)
    if len(result.encode("utf-8")) > MAX_RESULT_BYTES:
        return '{"ok":false,"error":"计算超出资源限制，请简化表达式或缩小矩阵。"}'
    return result
