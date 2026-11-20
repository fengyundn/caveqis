"""Symbolic math engine. User text is interpreted through a small AST whitelist."""
from __future__ import annotations

import ast
from decimal import Decimal, ROUND_HALF_EVEN, localcontext
import io
import re
import tokenize
import unicodedata
import sympy as s
from sympy.core.function import AppliedUndef


class InputError(ValueError):
    pass


FUNCTIONS = {
    "sin": s.sin, "cos": s.cos, "tan": s.tan, "cot": s.cot,
    "sec": s.sec, "csc": s.csc, "asin": s.asin, "acos": s.acos,
    "atan": s.atan, "atan2": s.atan2, "sinh": s.sinh, "cosh": s.cosh,
    "tanh": s.tanh, "asinh": s.asinh, "acosh": s.acosh, "atanh": s.atanh,
    "sqrt": s.sqrt, "root": s.root, "realroot": s.real_root,
    "cbrt": lambda x: s.real_root(x, 3), "exp": s.exp, "ln": s.log,
    "log": s.log, "log10": lambda x: s.log(x, 10), "abs": s.Abs,
    "Abs": s.Abs, "sign": s.sign, "floor": s.floor, "ceil": s.ceiling,
    "factorial": s.factorial, "gamma": s.gamma, "erf": s.erf,
    "conjugate": s.conjugate, "re": s.re, "im": s.im,
}
CONSTANTS = {"pi": s.pi, "e": s.E, "E": s.E, "I": s.I, "oo": s.oo, "inf": s.oo}
CONSTANTS.update({"π": s.pi, "圆周率": s.pi, "自然常数": s.E, "欧拉数": s.E,
                  "虚数单位": s.I, "无穷": s.oo, "无穷大": s.oo, "正无穷": s.oo})
FUNCTION_ALIASES = {
    "平方根": "sqrt", "根号": "sqrt", "开方": "sqrt", "方根": "root",
    "指数": "exp", "自然对数": "ln", "对数": "log", "常用对数": "log10",
    "正弦": "sin", "余弦": "cos", "正切": "tan", "余切": "cot",
    "正割": "sec", "余割": "csc", "反正弦": "asin", "反余弦": "acos",
    "反正切": "atan", "双曲正弦": "sinh", "双曲余弦": "cosh", "双曲正切": "tanh",
    "绝对值": "abs", "阶乘": "factorial", "符号": "sign", "向下取整": "floor",
    "向上取整": "ceil", "共轭": "conjugate", "实部": "re", "虚部": "im",
    "积分": "integrate", "求导": "diff", "导数": "diff", "极限": "limit", "代入": "at",
    "lim": "limit", "求和": "sum", "级数": "series", "级数展开": "series",
    "行列式": "det", "全微分": "totaldiff", "截断级数": "trunc",
}
CALCULUS_NAMES = {"integrate", "diff", "limit", "at", "sum", "series", "trunc", "totaldiff"}
CALCULUS_SPELLINGS = CALCULUS_NAMES | {name for name, target in FUNCTION_ALIASES.items() if target in CALCULUS_NAMES}
CALCULUS_INPUT = re.compile(r"(?<!\w)(?:" + "|".join(map(re.escape, sorted(CALCULUS_SPELLINGS))) + r")\s*[({\[]")
MATRIX_NAMES = {"det"}
SYMBOLIC_FUNCTION_NAMES = {"f", "g", "h", "y", "u", "v"}
FUNCTION_NAMES = set(FUNCTIONS) | set(FUNCTION_ALIASES) | CALCULUS_NAMES | MATRIX_NAMES
SUPERSCRIPTS = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻", "0123456789+-")


def normalize_math_text(text):
    """Normalize IME punctuation without changing the user's live composition."""
    text = str(text)
    # Preserve superscripts as powers before NFKC would turn x² into x2.
    text = re.sub(r"[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+", lambda m: "^(" + m[0].translate(SUPERSCRIPTS) + ")", text)
    text = unicodedata.normalize("NFKC", text)
    text = text.translate(str.maketrans({
        "×": "*", "✕": "*", "·": "*", "⋅": "*", "∗": "*",
        "÷": "/", "∕": "/", "⁄": "/", "−": "-", "–": "-", "—": "-",
        "、": ",", "﹑": ",", "∶": ":", "【": "[", "】": "]",
        "〔": "[", "〕": "]", "∞": "oo", "\u2028": "\n", "\u2029": "\n",
    }))
    text = re.sub(r"(?<=\d)。(?=\d)", ".", text)
    for symbol,name in (("∫","integrate"),("∂","diff"),("∑","sum"),("Σ","sum")):
        text=re.sub(re.escape(symbol)+r"\s*(?=[([{])",name,text)
    return text.replace("\r\n", "\n").replace("\r", "\n")


def split_top_level(text, separators=",;\n"):
    parts, depth, start = [], 0, 0
    for index, char in enumerate(text):
        if char in "([{":
            depth += 1
        elif char in ")]}":
            depth -= 1
        elif char in separators and depth == 0:
            parts.append(text[start:index].strip())
            start = index + 1
    parts.append(text[start:].strip())
    return parts


def arithmetic_groups(text):
    """Treat (), [] and {} as grouping, never as Python containers/indexing."""
    opening, closing = "([{", ")]}"
    stack, output = [], []
    for char in text:
        if char in opening:
            stack.append(char)
            output.append("(")
        elif char in closing:
            if not stack or opening.index(stack[-1]) != closing.index(char):
                raise InputError("括号不匹配：请让 ()、[]、{} 成对，并按正确顺序嵌套。")
            stack.pop()
            output.append(")")
        else:
            output.append(char)
    if stack:
        raise InputError("缺少右括号：请检查 ()、[]、{} 是否完整配对。")
    return "".join(output)


def complete_operator_name(text):
    text=arithmetic_groups(normalize_math_text(text)).strip()
    match=re.match(r"([^\W\d_]\w*)\s*\(",text)
    if not match:
        return None
    name=FUNCTION_ALIASES.get(match[1],match[1])
    if name not in CALCULUS_NAMES:
        return None
    depth=0
    for index,char in enumerate(text[match.end()-1:],start=match.end()-1):
        if char=="(":
            depth+=1
        elif char==")":
            depth-=1
            if depth==0:
                return name if index==len(text)-1 else None
    return None


def wraps_entire_square_group(text):
    if not text.startswith("[") or not text.endswith("]"):
        return False
    stack = []
    matching = {")": "(", "]": "[", "}": "{"}
    for index, char in enumerate(text):
        if char in "([{":
            stack.append(char)
        elif char in ")]}":
            if not stack or matching[char] != stack[-1]:
                return False
            stack.pop()
            if not stack:
                return index == len(text) - 1
    return False


def bounded_int(value, lo, hi, label):
    try:
        result = int(normalize_math_text(value).strip())
    except (ValueError, TypeError):
        raise InputError(f"{label}须为 {lo}～{hi} 的整数。") from None
    if not lo <= result <= hi:
        raise InputError(f"{label}须为 {lo}～{hi} 的整数。")
    return result


class Parser:
    def __init__(self, assumption="complex", degrees=False, allow_functions=False):
        if assumption not in ("complex", "real", "positive"):
            raise InputError("未知的变量假设。")
        self.assumption = assumption
        self.symbols = {}
        self.degrees = degrees
        self.allow_functions = allow_functions
        self.outer_operator = None
        self.outer_arity = 0

    def symbol(self, name):
        name = normalize_math_text(name).strip()
        if not name or not name.isidentifier() or not name[0].isalpha() or len(name) > 24 or "__" in name or any(not (c.isalnum() or c == "_") for c in name):
            raise InputError("变量名可用中文、英文字母或混合名称，如 x、力、Fx、温度1；不能以数字或下划线开头，最多 24 字符。")
        if name in FUNCTION_NAMES or name in CONSTANTS:
            raise InputError(f"{name} 是保留函数或常数，请换一个变量名。")
        if name not in self.symbols:
            if len(self.symbols) >= 24:
                raise InputError("每次最多使用 24 个变量。")
            opts = {} if self.assumption == "complex" else {self.assumption: True}
            self.symbols[name] = s.Symbol(name, **opts)
        return self.symbols[name]

    def parse(self, text):
        if not isinstance(text, str) or not text.strip():
            raise InputError("请先填写表达式。")
        if len(text) > 1800:
            raise InputError("单个表达式不能超过 1800 个字符。")
        text = normalize_math_text(text).strip()
        text = arithmetic_groups(text)
        text = re.sub(r"√\s*(?=\()", "sqrt", text).replace("^", "**")
        try:
            # Support 2x, 2(x+1), and (x+1)(x-1); multi-letter names stay intact.
            tokens = [t for t in tokenize.generate_tokens(io.StringIO(text).readline)
                      if t.type not in (tokenize.ENDMARKER, tokenize.NEWLINE, tokenize.NL)]
            calculus = any(t.type == tokenize.NAME and FUNCTION_ALIASES.get(t.string,t.string) in CALCULUS_NAMES for t in tokens)
            applied_functions = self.allow_functions or calculus
            function_names = FUNCTION_NAMES | (SYMBOLIC_FUNCTION_NAMES if applied_functions else set())
            output = []
            previous = None
            for token in tokens:
                if previous:
                    end_value = previous.type in (tokenize.NUMBER, tokenize.NAME) or previous.string == ")"
                    start_value = token.type in (tokenize.NUMBER, tokenize.NAME) or token.string == "("
                    function_call = previous.type == tokenize.NAME and token.string == "(" and previous.string in function_names
                    if end_value and start_value and not function_call:
                        output.append("*")
                output.append(token.string)
                previous = token
            normalized = " ".join(output)
            tree = ast.parse(normalized, mode="eval")
        except (SyntaxError, tokenize.TokenError, IndentationError):
            raise InputError("表达式格式有误，请检查括号、运算符和函数写法。") from None
        if sum(1 for _ in ast.walk(tree)) > 350:
            raise InputError("表达式过于复杂，请拆分计算。")
        self.outer_operator = FUNCTION_ALIASES.get(tree.body.func.id,tree.body.func.id) if isinstance(tree.body,ast.Call) and isinstance(tree.body.func,ast.Name) else None
        self.outer_arity = len(tree.body.args) if isinstance(tree.body,ast.Call) else 0

        def visit(node):
            if isinstance(node, ast.Expression):
                return visit(node.body)
            if isinstance(node, ast.Constant) and type(node.value) in (int, float):
                literal = ast.get_source_segment(normalized, node)
                if len(literal) > 90 or not re.fullmatch(r"(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?", literal):
                    raise InputError("数字过长或格式不支持。")
                if "e" in literal.lower() and abs(int(literal.lower().split("e")[1])) > 300:
                    raise InputError("科学记数法指数须在 -300～300 之间。")
                return s.Rational(literal)
            if isinstance(node, ast.Name):
                if node.id in CONSTANTS:
                    return CONSTANTS[node.id]
                return self.symbol(node.id)
            if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
                value = visit(node.operand)
                return value if isinstance(node.op, ast.UAdd) else -value
            if isinstance(node, ast.BinOp):
                left, right = visit(node.left), visit(node.right)
                if isinstance(node.op, ast.Add):
                    return left + right
                if isinstance(node.op, ast.Sub):
                    return left - right
                if isinstance(node.op, ast.Mult):
                    return left * right
                if isinstance(node.op, ast.Div):
                    if right == 0:
                        raise InputError("除数不能为零。")
                    return left / right
                if isinstance(node.op, ast.Pow):
                    if right.is_number and (right.is_real is not True or abs(right) > 1000):
                        raise InputError("数值指数须为 -1000～1000 的实数。")
                    if left == 0 and right.is_negative:
                        raise InputError("零不能取负次幂。")
                    if left.is_Rational and right.is_Integer:
                        bits = max(abs(int(left.p)).bit_length(), int(left.q).bit_length())
                        if bits * abs(int(right)) > 12000:
                            raise InputError("数值幂的结果过大，请降低幂次或拆分计算。")
                    return left ** right
                raise InputError("仅支持 +、-、*、/、^ 运算。")
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                name = FUNCTION_ALIASES.get(node.func.id, node.func.id)
                if node.keywords:
                    raise InputError("函数参数请按位置填写，不支持关键字参数。")
                if name == "det":
                    rows = [arg.elts if isinstance(arg, ast.Tuple) else [arg] for arg in node.args]
                    if len(rows) == 1 and rows[0] and all(isinstance(row, ast.Tuple) for row in rows[0]):
                        rows = [row.elts for row in rows[0]]
                    if not 1 <= len(rows) <= 8 or any(len(row) != len(rows) for row in rows):
                        raise InputError("行列式须为 1×1～8×8 的方阵，例如 det([1,2],[3,4])。")
                    return s.Matrix([[visit(cell) for cell in row] for row in rows]).det()
                if name == "totaldiff":
                    if not 2 <= len(node.args) <= 7:
                        raise InputError("全微分格式为 totaldiff(f,x,y)，最多使用 6 个变量。")
                    expression, *variables = [visit(arg) for arg in node.args]
                    if any(not isinstance(var, s.Symbol) for var in variables) or len(set(variables)) != len(variables):
                        raise InputError("全微分需要互不重复的变量名。")
                    return s.Add(*(s.diff(expression, var) * self.symbol("d" + var.name) for var in variables))
                if name in CALCULUS_NAMES:
                    arities = {"integrate": (2,4), "diff": (2,3), "limit": (3,4), "at": (3,), "sum": (4,), "series": (4,), "trunc": (4,)}[name]
                    if len(node.args) not in arities:
                        raise InputError(f"{name} 的参数格式不正确，请参照输入指南中的微积分函数。")
                    args = [visit(arg) for arg in node.args]
                    expr, variable = args[:2]
                    if not isinstance(variable,s.Symbol):
                        raise InputError(f"{name} 的第二个参数须为一个变量名，如 x。")
                    if name == "sum":
                        lower,upper=args[2:]
                        if variable in lower.free_symbols | upper.free_symbols:
                            raise InputError("求和上下限不能包含本层求和指标。")
                        if any(bound.is_number and bound not in (s.oo,-s.oo) and bound.is_integer is not True for bound in (lower,upper)):
                            raise InputError("求和的数值上下限须为整数或无穷大。")
                        if lower==s.oo or upper==-s.oo:
                            raise InputError("求和下限不能为正无穷，上限不能为负无穷。")
                        return s.summation(expr, (variable, lower, upper))
                    if name in {"series", "trunc"}:
                        point,order=args[2],bounded_int(args[3],1,16,"展开阶数")
                        if variable in point.free_symbols:
                            raise InputError("展开点不能含有当前展开变量。")
                        expansion = s.series(expr, variable, point, order)
                        return expansion.removeO() if name == "trunc" else expansion
                    if name == "diff":
                        order = bounded_int(args[2] if len(args)==3 else 1,1,10,"求导阶数")
                        return s.diff(expr, variable, order)
                    if name == "at":
                        if variable in args[2].free_symbols:
                            raise InputError("代入值不能含有被代入变量。")
                        return expr.subs(variable,args[2])
                    if name == "integrate":
                        if len(args)==2:
                            if self.allow_functions:
                                raise InputError("方程中的积分请给定上下限，例如 integrate(t,t,0,x)；不定积分含任意常数，需改写成含 C 的原函数再求解。")
                            return s.integrate(expr, variable)
                        if variable in args[2].free_symbols | args[3].free_symbols:
                            raise InputError("积分限不能含有本层积分变量；变上限积分请使用另一个变量名作为积分变量，如 integrate(t,t,0,x)。")
                        return s.integrate(expr, (variable, args[2], args[3]))
                    point = args[2]
                    if variable in point.free_symbols:
                        raise InputError("趋近点不能含有当前极限变量。")
                    direction = bounded_int(args[3] if len(args)==4 else 0,-1,1,"极限方向")
                    if expr.has(s.core.function.AppliedUndef):
                        return s.Limit(expr, variable, point, dir={0:"+-", 1:"+", -1:"-"}[direction])
                    if direction == 0 and point not in (s.oo, -s.oo):
                        left = s.limit(expr, variable, point, dir="-")
                        right = s.limit(expr, variable, point, dir="+")
                        if left != right:
                            raise InputError("左右极限不同，双侧极限不存在；可将 limit 的第四个参数设为 -1（左侧）或 1（右侧）。")
                        return left
                    return s.limit(expr, variable, point, dir="-" if direction == -1 else "+")

                if applied_functions and name in SYMBOLIC_FUNCTION_NAMES:
                    if len(node.args)!=1:
                        raise InputError(f"未知函数 {name} 请写成 {name}(x) 这样的单变量形式。")
                    return s.Function(name)(visit(node.args[0]))
                if name in FUNCTIONS and not node.args:
                    raise InputError(f"{node.func.id}() 的括号内需要填写参数，例如 {node.func.id}(1)。")
                if name not in FUNCTIONS or node.keywords or not 1 <= len(node.args) <= 2:
                    raise InputError("不支持此函数或参数，请参照输入帮助。")
                arities = (1, 2) if name == "log" else (2,) if name in ("root", "realroot", "atan2") else (1,)
                if len(node.args) not in arities:
                    raise InputError(f"{node.func.id} 的参数数量不正确，请参照输入帮助。")
                args = [visit(a) for a in node.args]
                if name in ("factorial", "gamma") and args[0].is_number and abs(args[0]) > 500:
                    raise InputError("阶乘和 gamma 的数值参数绝对值不能超过 500。")
                if name in ("root", "realroot") and (not args[1].is_Integer or not 1 <= args[1] <= 100):
                    raise InputError("root(x,n) 的 n 须为 1～100 的整数。")
                if self.degrees and name in ("sin", "cos", "tan", "cot", "sec", "csc"):
                    args[0] *= s.pi / 180
                try:
                    value = FUNCTIONS[name](*args)
                    if self.degrees and name in ("asin", "acos", "atan", "atan2"):
                        value *= 180 / s.pi
                    return value
                except (TypeError, ValueError):
                    raise InputError(f"{name} 的参数数量或取值不正确。") from None
            raise InputError("输入仅接受数学表达式，不支持属性、下标、代码或字符串。")

        try:
            return visit(tree)
        except RecursionError:
            raise InputError("表达式嵌套过深，请拆分计算。") from None

    def variables(self, text, maximum=8):
        names = re.split(r"[,;\s]+", normalize_math_text(text).strip())
        if not names or not names[0] or len(names) > maximum or len(set(names)) != len(names):
            raise InputError(f"请填写 1～{maximum} 个不同的变量，用逗号分隔。")
        return [self.symbol(n) for n in names]

    def substitutions(self, text):
        if not str(text).strip():
            return {}
        result = {}
        # Semicolons/newlines allow functions containing commas on the right.
        pieces = [piece for piece in split_top_level(normalize_math_text(text)) if piece]
        if len(pieces) > 16:
            raise InputError("最多代入 16 个变量。")
        for piece in pieces:
            if piece.count("=") != 1:
                raise InputError("代入格式为 x=2; y=pi/2。")
            name, value = piece.split("=")
            var = self.symbol(name.strip())
            if var in result:
                raise InputError(f"变量 {var} 被重复代入，请只填写一次。")
            result[var] = self.parse(value)
        return result


def split_cells(row):
    row = normalize_math_text(row)
    result = split_top_level(row, ",\t")
    if len(result) == 1:
        row = re.sub(r"([^\W\d_]\w*)\s+(?=\()", lambda m: m[1] if m[1] in FUNCTION_NAMES else m[0], row)
        pieces = [piece for piece in split_top_level(row, " \t") if piece]
        # Spaces inside function calls/groups or around operators belong to a cell.
        if any(re.fullmatch(r"[+\-*/^]+", v) or re.search(r"[+\-*/^]$|^[*/^]", v) for v in pieces):
            return [row.strip()]
        result = pieces
    return result


def matrix(text, parser):
    text = normalize_math_text(text).strip()
    if len(text) > 10000:
        raise InputError("矩阵内容过长。")
    rows = None
    if wraps_entire_square_group(text):
        text = text[1:-1].strip()
        candidates = split_top_level(text, ",")
        if all(wraps_entire_square_group(part) for part in candidates):
            rows = [part[1:-1].strip() for part in candidates]
    if rows is None:
        rows = [r for r in split_top_level(text, ";\n") if r.strip()]
    entries = [split_cells(r) for r in rows]
    if not entries or len(entries) > 8 or not 1 <= len(entries[0]) <= 8:
        raise InputError("矩阵大小须为 1×1～8×8。")
    if any(len(r) != len(entries[0]) for r in entries):
        raise InputError("矩阵每行的列数必须相同。元素用逗号分隔，行用换行或分号分隔。")
    if any(not cell for r in entries for cell in r):
        raise InputError("矩阵不能包含空元素。")
    return s.Matrix([[parser.parse(cell) for cell in r] for r in entries])


def evaluate_to_digits(value, precision):
    # Evaluate with guard digits so the binary conversion does not decide a decimal tie.
    approximation = value.evalf(precision + 8)
    with localcontext() as context:
        context.prec = precision
        context.rounding = ROUND_HALF_EVEN
        return approximation.replace(lambda part: isinstance(part, s.Float),
                                     lambda part: s.Float(str(+Decimal(str(part))), precision))


def result_item(label, value, precision=12, numeric=True, tex=None):
    item = {"label": label, "text": s.sstr(value), "latex": tex if tex is not None else s.latex(value)}
    if isinstance(value, s.MatrixBase):
        item["matrix"] = [[s.sstr(value[r,c]) for c in range(value.cols)] for r in range(value.rows)]
        item["text"] = "\n".join(", ".join(row) for row in item["matrix"])
    if len(item["text"]) + len(item["latex"]) > 45000:
        raise InputError("结果过长，请减小问题规模。")
    integer_only = bool(getattr(value, "is_Integer", False)) or (isinstance(value, s.MatrixBase) and all(v.is_Integer for v in value))
    if numeric and not integer_only and hasattr(value, "evalf") and not getattr(value, "free_symbols", {1}):
        try:
            approx = evaluate_to_digits(value, precision)
            if approx != value and not approx.has(s.Integral, s.Derivative):
                item["approx"] = s.sstr(approx)
                item["approx_latex"] = s.latex(approx, full_prec=True)
        except (ArithmeticError, TypeError, ValueError, NotImplementedError):
            pass
    return item


def graph_scalar(value, independent=None):
    if not isinstance(value, s.Expr) or value.is_real is False or value.has(
        s.I, s.oo, -s.oo, s.zoo, s.nan, s.Order, AppliedUndef
    ):
        return None
    symbols = value.free_symbols
    if independent is None and len(symbols) == 1:
        independent = next(iter(symbols))
    if independent is not None and str(independent) != "x":
        if any(str(symbol) == "x" for symbol in symbols):
            return None
        value = value.subs(independent, s.Symbol("x"))
    if any(str(symbol) == "y" for symbol in value.free_symbols):
        return None
    if any(not re.fullmatch(r"(?:[a-z](?:_[a-z0-9]+)?|theta|[\u3400-\u9fffα-ω][\u3400-\u9fffα-ω0-9_]{0,23})", str(symbol))
           for symbol in value.free_symbols):
        return None
    return "y = " + s.sstr(value)


def graph_equation(left, right, variables):
    if len(variables) == 1:
        return graph_scalar(left - right, variables[0])
    symbols = left.free_symbols | right.free_symbols
    if all(str(variable) in ("x", "y") for variable in variables) and all(
        str(symbol) in ("x", "y") for symbol in symbols
    ):
        if not (left.has(s.I) or right.has(s.I)):
            return s.sstr(left) + " = " + s.sstr(right)
    return None


def compute_determinant(data, operation, parser, add, notes):
    if operation == "formula":
        add("符号表达式结果", parser.parse(data.get("expression", "")))
        return

    a = matrix(data.get("matrixA", ""), parser)
    if a.rows != a.cols:
        raise InputError("行列式要求方阵。")
    if a.free_symbols:
        notes.append("含参数矩阵的结果按一般参数条件计算；特殊参数取值可能改变秩、可逆性或解的数量。")

    if operation in {"minor", "cofactor", "expand_row", "expand_column"}:
        row = bounded_int(data.get("row") or 1, 1, a.rows, "行号") - 1 if operation != "expand_column" else None
        column = bounded_int(data.get("column") or 1, 1, a.cols, "列号") - 1 if operation != "expand_row" else None
        if operation == "minor":
            add(f"M({row + 1},{column + 1})", s.factor(a.minor(row, column)))
        elif operation == "cofactor":
            add(f"C({row + 1},{column + 1})", s.factor(a.cofactor(row, column)))
        else:
            positions = [(row, c) for c in range(a.cols)] if row is not None else [(r, column) for r in range(a.rows)]
            terms = [(a[r, c], s.factor(a.cofactor(r, c))) for r, c in positions]
            value = s.factor(sum(entry * cofactor for entry, cofactor in terms))
            products = " + ".join(rf"\left({s.latex(entry)}\right)\cdot\left({s.latex(cofactor)}\right)" for entry, cofactor in terms)
            label = "按行展开" if row is not None else "按列展开"
            add(label, value, tex=rf"{products} = {s.latex(value)}")
        return

    determinant = a.det()
    if operation == "det":
        add("det(A)", s.factor(determinant))
    elif operation == "transpose":
        add("det(Aᵀ)", s.factor(determinant))
    elif operation == "product":
        b = matrix(data.get("matrixB", ""), parser)
        if b.shape != a.shape:
            raise InputError("乘积行列式要求两个同阶方阵。")
        add("det(AB)", s.factor(determinant * b.det()))
    elif operation == "scale":
        k = parser.parse(data.get("scalar", "2"))
        add("det(kA)", s.factor(k ** a.rows * determinant))
    elif operation in {"power", "inverse"}:
        exponent = -1 if operation == "inverse" else bounded_int(data.get("power", 2), -20, 20, "矩阵幂次")
        if exponent < 0 and determinant == 0:
            raise InputError("矩阵不可逆，行列式为零。")
        label = "det(A⁻¹)" if operation == "inverse" else f"det(A^{exponent})"
        add(label, s.factor(determinant ** exponent))
    else:
        raise InputError("未知的行列式操作。")


def compute(data):
    if not isinstance(data, dict):
        raise InputError("请求格式须为 JSON 对象。")
    math_fields = {"expression", "matrixA", "matrixB", "variables", "substitutions", "equations",
                   "bounds", "guesses", "lower", "upper", "scalar", "power", "row", "column", "order", "point", "precision"}
    data = {key: normalize_math_text(value) if key in math_fields else value for key, value in data.items()}
    category = data.get("category", "calculate")
    op = data.get("operation", "evaluate")
    if category in ("calculate","integral","derivative","analysis","equations") and op.startswith("equation_"):
        from equation_solver import read_document
        rows,settings=read_document(data.get("expression",""),InputError)
        data.update(settings)
        category="equations"
        op=op.removeprefix("equation_")
        data.update(category=category,operation=op,equations="\n".join(rows),infer_variables=True)
    if category == "calculate":
        from equation_solver import read_document
        rows, settings = read_document(data.get("expression",""), InputError)
        data.update(settings)
        if op.startswith("equation_") or (rows and "=" in rows[0]):
            category = "equations"
            op = op.removeprefix("equation_") if op.startswith("equation_") else "auto"
            data.update(category=category,operation=op,equations="\n".join(rows),infer_variables=True)
        else:
            if len(rows)>1:
                if not all("=" in row for row in rows[1:]):
                    raise InputError("表达式计算请填写一个算式；代入可另起一行写 x=2，求方程组请选择方程求解。")
                data["substitutions"] = ";".join(filter(None,[data.get("substitutions",""),*rows[1:]]))
            data["expression"] = rows[0] if rows else ""
    if category == "equations":
        from equation_solver import read_document
        rows,settings=read_document(data.get("equations",""),InputError)
        data.update(settings,equations="\n".join(rows))
    explicit_for={
        ("integral","indefinite"):{"integrate"},("integral","definite"):{"integrate"},
        ("derivative","differentiate"):{"diff"},("derivative","partial"):{"diff"},
        ("analysis","limit"): {"limit","sum","series","trunc"},
        ("analysis","series"): {"limit","sum","series","trunc"},
        ("analysis","summation"): {"limit","sum","series","trunc"},
        ("series","series"): {"sum","series","trunc"},
        ("series","summation"): {"sum","series","trunc"},
    }
    expected_operators=explicit_for.get((category,op))
    if expected_operators and complete_operator_name(data.get("expression","")) in expected_operators:
        op="formula"
    precision = bounded_int(data.get("precision", 12), 2, 50, "有效数字")
    data["precision"] = precision
    calculus_input = CALCULUS_INPUT.search(data.get("expression", data.get("equations", "")))
    p = Parser(data.get("assumption", "complex"), category == "calculate" and data.get("angle") == "deg" and not calculus_input, category=="equations")
    items, notes, graph = [], [], []

    def add_graph(form):
        if form and len(form) <= 300 and form not in graph:
            graph.append(form)

    def add(label, value, **kwargs):
        items.append(result_item(label, value, precision, **kwargs))
        if category != "equations":
            add_graph(graph_scalar(value))
        elif isinstance(value, s.Equality) and isinstance(value.lhs, AppliedUndef):
            if len(value.lhs.args) == 1 and isinstance(value.lhs.args[0], s.Symbol):
                add_graph(graph_scalar(value.rhs, value.lhs.args[0]))

    def note_symbolic_value(value,summation=False):
        if value.has(s.Integral,s.Derivative,s.Limit,s.Sum):
            notes.append("尚未完整求出解析结果，保留未求出的运算符号；这不表示结果为零。")
        if value.has(s.oo,-s.oo,s.zoo,s.nan):
            notes.append("该级数可能发散或不存在有限和，请检查求和区间与参数。" if summation else "结果不是有限值，请检查收敛性、奇点或定义域。")
        if summation and value.has(s.AccumBounds):
            notes.append("该级数出现振荡，未得到单一有限和。")

    if category in ("integral","derivative","analysis","series") and op == "formula":
        value=p.parse(data.get("expression",""))
        root=p.outer_operator
        indefinite=root=="integrate" and p.outer_arity==2
        label={"integrate":"积分结果","diff":"微分 / 导数结果","limit":"极限结果","sum":"级数求和","series":"级数展开","trunc":"截断级数"}.get(root,"符号表达式结果")
        add(label,value,numeric=not indefinite and root!="series",tex=s.latex(value)+(r" + C" if indefinite else ""))
        if indefinite:
            items[-1]["text"] += " + C"
            notes.append("C 为任意积分常数。")
        note_symbolic_value(value,summation=root=="sum")
    elif category == "calculate":
        expr = p.parse(data.get("expression", ""))
        expr = expr.subs(p.substitutions(data.get("substitutions", "")), simultaneous=True)
        operations = {"evaluate": s.simplify, "simplify": s.simplify, "expand": s.expand,
                      "factor": s.factor, "cancel": s.cancel, "trigsimp": s.trigsimp}
        if op not in operations:
            raise InputError("未知的科学计算操作。")
        value = operations[op](expr)
        add("计算结果", value)
        if p.degrees:
            notes.append("当前三角函数输入为角度；反三角函数结果也以度表示。")

    elif category == "determinant":
        compute_determinant(data, op, p, add, notes)

    elif category == "matrix":
        a = matrix(data.get("matrixA", ""), p)
        needs_b = op in ("add", "subtract", "multiply", "divide", "hadamard", "solve")
        b = matrix(data.get("matrixB", ""), p) if needs_b else None
        if op in ("det", "inverse", "power", "trace", "eigen", "charpoly", "divide"):
            square = b if op == "divide" else a
            if square.rows != square.cols:
                raise InputError("该操作要求方阵。矩阵右除要求 B 为可逆方阵。")
        if op in ("add", "subtract", "hadamard") and a.shape != b.shape:
            raise InputError("A、B 的行数和列数须分别相同。")
        if op in ("multiply", "divide") and a.cols != b.rows:
            raise InputError("A 的列数须等于 B 的行数。")
        if op == "add":
            add("A + B", a + b)
        elif op == "subtract":
            add("A − B", a - b)
        elif op == "multiply":
            add("A × B", a * b)
        elif op == "divide":
            add("A · B⁻¹（右除）", a * b.inv())
            notes.append("矩阵右除定义为 A·B⁻¹；矩阵乘法通常不满足交换律。")
        elif op == "hadamard":
            add("逐元素乘积", a.multiply_elementwise(b))
        elif op == "scale":
            k = p.parse(data.get("scalar", "2"))
            add("kA", k * a)
        elif op == "power":
            n = bounded_int(data.get("power", 2), -20, 20, "矩阵幂次")
            add(f"A^{n}", a ** n)
        elif op == "det":
            add("det(A)", s.factor(a.det()))
        elif op == "inverse":
            add("A⁻¹", a.inv())
        elif op == "transpose":
            add("Aᵀ", a.T)
        elif op == "adjoint":
            add("Aᴴ（共轭转置）", a.H)
        elif op == "rank":
            add("rank(A)", s.Integer(a.rank()))
        elif op == "trace":
            add("tr(A)", s.trace(a))
        elif op == "rref":
            reduced, pivots = a.rref()
            add("行最简形", reduced)
            notes.append("主元列（从 1 开始）：" + ("、".join(str(i + 1) for i in pivots) or "无"))
        elif op == "nullspace":
            basis = a.nullspace()
            if basis:
                for i, vector in enumerate(basis):
                    add(f"零空间基向量 {i+1}", vector)
            else:
                notes.append("零空间只有零向量，维数为 0。")
        elif op == "eigen":
            if a.rows > 5:
                raise InputError("特征值与特征向量计算目前限于 5×5 及以下。")
            for eigenvalue, multiplicity, vectors in a.eigenvects():
                add(f"特征值（代数重数 {multiplicity}）", eigenvalue)
                for vector in vectors:
                    add("对应特征向量", vector)
        elif op == "charpoly":
            lam = s.Dummy("lambda")
            add("特征多项式 det(λI − A)", a.charpoly(lam).as_expr())
        elif op == "lu":
            lower, upper, swaps = a.LUdecomposition()
            permutation = s.eye(a.rows)
            for i, j in swaps:
                permutation.row_swap(i, j)
            add("P", permutation)
            add("L", lower)
            add("U", upper)
            notes.append("分解满足 P·A = L·U。")
        elif op == "solve":
            if a.rows != b.rows:
                raise InputError("求解 AX=B 时，A 与 B 的行数须相同。")
            if b.cols != 1:
                raise InputError("此处 B 请输入一列常数向量。")
            variables = p.variables(data.get("variables", ",".join(f"x{i+1}" for i in range(a.cols))))
            if len(variables) != a.cols:
                raise InputError("未知数数量须等于 A 的列数。")
            if any(v in a.free_symbols | b.free_symbols for v in variables):
                raise InputError("未知数不能同时作为 A、B 中的系数参数。")
            solution = s.linsolve((a, b), variables)
            add("线性方程组解集", solution, numeric=False)
            if solution is s.EmptySet:
                notes.append("方程组无解。")
            elif any(v in solution.free_symbols for v in variables):
                notes.append("存在自由变量，方程组有无穷多解；保留的未知数为自由参数。")
            else:
                for v, value in zip(variables, next(iter(solution))):
                    add(str(v), value)
        else:
            raise InputError("未知的矩阵操作。")
        if a.free_symbols or (b is not None and b.free_symbols):
            notes.append("含参数矩阵的结果按一般参数条件计算；特殊参数取值可能改变秩、可逆性或解的数量。")

    elif category == "derivative":
        expr = p.parse(data.get("expression", ""))
        if op in ("differentiate", "partial"):
            spec = str(data.get("variables", "x")).strip()
            tokens = re.split(r"[,，;；]+", spec)
            if len(tokens) > 6:
                raise InputError("最多设置 6 组求导变量。")
            steps, total = [], 0
            for token in tokens:
                parts = token.strip().split(":")
                if len(parts) > 2:
                    raise InputError("求导格式为 x:2,y:1，表示先对 x 求二阶导，再对 y 求一阶导。")
                var = p.symbol(parts[0].strip())
                n = bounded_int(parts[1].strip() if len(parts) == 2 else data.get("order", 1), 1, 10, "求导阶数")
                total += n
                steps.append((var, n))
            if total > 12:
                raise InputError("总求导阶数不能超过 12。")
            value = s.simplify(s.diff(expr, *steps))
            add("导数", value)
        elif op in ("gradient", "hessian", "differential"):
            variables = p.variables(data.get("variables", "x,y"), 6)
            if op == "gradient":
                value = s.Matrix([s.diff(expr, v) for v in variables])
                add("梯度 ∇f", value)
            elif op == "hessian":
                value = s.hessian(expr, variables)
                add("Hessian 矩阵", value)
            else:
                terms = [(s.diff(expr, v), s.Symbol("d" + str(v))) for v in variables]
                value = s.Add(*(a*b for a, b in terms))
                add("全微分 df", value)
                notes.append("dx、dy 等表示对应变量的微分。")
        else:
            raise InputError("未知的微分操作。")
        substitutions = p.substitutions(data.get("substitutions", ""))
        if substitutions:
            add("代入后的结果", value.subs(substitutions, simultaneous=True))
        notes.append("微积分中的三角函数统一采用弧度制。")

    elif category == "integral":
        expr = p.parse(data.get("expression", ""))
        if op == "indefinite":
            var = p.symbol(data.get("variables", "x"))
            value = s.integrate(expr, var)
            add("不定积分", value, numeric=False, tex=s.latex(value) + r" + C")
            items[-1]["text"] += " + C"
            notes.append("C 为任意积分常数；在被积函数连续的区间上理解此结果。")
        elif op in ("definite", "multiple"):
            if op == "definite":
                raw = [(data.get("variables", "x"), data.get("lower", "0"), data.get("upper", "1"))]
            else:
                rows = [row for row in split_top_level(data.get("bounds", ""), ";\n") if row]
                raw = [split_cells(r) for r in rows]
                if not 1 <= len(raw) <= 3 or any(len(r) != 3 for r in raw):
                    raise InputError("多重积分限填 1～3 行，每行为 变量,下限,上限；按从内到外排列。")
            limits, names = [], set()
            for row_number, (name, low, high) in enumerate(raw, 1):
                try:
                    var = p.symbol(name.strip())
                except InputError as error:
                    if op == "multiple":
                        raise InputError(f"积分限第 {row_number} 行的第一项须为积分变量，例如 y,0,1。每行依次填写变量、下限、上限。") from error
                    raise
                if str(var) in names:
                    raise InputError("多重积分的变量不能重复。")
                names.add(str(var))
                low, high = p.parse(low), p.parse(high)
                if var in low.free_symbols | high.free_symbols:
                    raise InputError("积分上下限不能包含本层积分变量。")
                if any(v in low.free_symbols | high.free_symbols for v, _, _ in limits):
                    raise InputError("外层积分限不能包含已经在内层积分掉的变量。")
                limits.append((var, low, high))
            value = s.integrate(expr, *limits)
            add("定积分" if op == "definite" else "多重积分", value)
        else:
            raise InputError("未知的积分操作。")
        if value.has(s.Integral):
            notes.append("未求出完整解析解，结果保留了积分符号；这不表示积分为零。可尝试改写表达式、设置变量假设或填写具体积分限。")
        if value.has(s.oo, -s.oo, s.zoo, s.nan):
            notes.append("积分可能发散或在当前定义域无有限值，请检查奇点与积分区间。")

    elif category == "equations":
        from equation_solver import solve_equations
        solve_equations(data,p,add,notes,InputError,add_graph)

    elif category in {"analysis", "series"}:
        expr = p.parse(data.get("expression", ""))
        var = p.symbol(data.get("variables", "x"))
        if op!="summation":
            point = p.parse(data.get("point", "0"))
            if var in point.free_symbols:
                raise InputError("趋近点或展开点不能含有当前变量。")
        if op == "limit":
            direction = data.get("direction", "+-")
            if direction not in ("+", "-", "+-"):
                raise InputError("未知的极限方向。")
            if direction == "+-" and point not in (s.oo, -s.oo):
                left = s.limit(expr, var, point, dir="-")
                right = s.limit(expr, var, point, dir="+")
                if left == right:
                    add("双侧极限", left)
                else:
                    add("左极限", left)
                    add("右极限", right)
                    notes.append("左右极限不相同，双侧极限不存在。")
            else:
                add("极限", s.limit(expr, var, point, dir="+" if direction == "+-" else direction))
        elif op == "series":
            order = bounded_int(data.get("order", 6), 1, 16, "展开阶数")
            add("级数展开", s.series(expr, var, point, order), numeric=False)
            notes.append(f"展开到 {order-1} 次幂附近，保留大 O 余项；特殊函数可能出现 Laurent 或分数幂项。")
        elif op == "summation":
            lower,upper=data.get("lower","1"),data.get("upper","oo")
            value=p.parse(f"sum(({data.get('expression','')}),{var},{lower},{upper})")
            add("级数求和",value)
            note_symbolic_value(value,summation=True)
            notes.append("上下限填整数可求有限和；上限填 oo 或 ∞ 可求无穷级数。参数条件以结果中显示的条件为准。")
        else:
            raise InputError("未知的极限 / 级数操作。")
    else:
        raise InputError("未知的工具类型。")

    for item in items:
        if item["text"] in ("zoo", "nan"):
            notes.append("结果无定义或为复无穷，请检查输入的定义域。")
    if sum(len(i["text"]) + len(i["latex"]) for i in items) > 110000:
        raise InputError("结果过长，请减少矩阵规模或表达式复杂度。")
    result = {"items": items, "notes": list(dict.fromkeys(notes))}
    if graph:
        result["graph"] = graph
    return result
