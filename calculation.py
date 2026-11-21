"""Shared calculation result handling for HTTP and Android callers."""


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
