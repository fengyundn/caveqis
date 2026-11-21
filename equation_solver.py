"""Single-input equation documents and symbolic/functional equation solvers."""
from __future__ import annotations

import json
import re
import sympy as s
from sympy.core.function import AppliedUndef
from sympy.solvers.solveset import NonlinearError


def document_rows(text):
    parts, stack, start = [], [], 0
    for i,char in enumerate(str(text)):
        if char in "([{":
            stack.append(char)
        elif char in ")]}":
            if stack:
                stack.pop()
        elif char in ";\n" and not stack:
            parts.append(text[start:i].strip())
            start=i+1
    parts.append(text[start:].strip())
    return [part for part in parts if part]


def read_document(text,error):
    if not isinstance(text,str) or len(text)>14000:
        raise error("输入须为不超过 14000 字符的数学表达式或方程。")
    rows,settings=[],{}
    keys={"vars":"variables","variables":"variables","unknowns":"variables","未知数":"variables","变量":"variables",
          "guess":"guesses","guesses":"guesses","初值":"guesses",
          "domain":"domain","数域":"domain","digits":"precision","precision":"precision","精度":"precision",
          "assume":"assumption","assumption":"assumption","假设":"assumption"}
    for row in document_rows(text):
        directive=re.fullmatch(r"([\w]+)\s*:\s*(.+)",row)
        if directive:
            key=keys.get(directive[1].lower())
            if key is None:
                raise error("未知的设置行；可使用 vars: x、guess: 1、domain: real、digits: 20、assume: real。")
            if key in settings:
                raise error(f"设置 {directive[1]} 请只填写一次。")
            value=directive[2].strip()
            if key=="domain":
                value={"实数":"real","实数域":"real","复数":"complex","复数域":"complex"}.get(value,value.lower())
                if value not in ("real","complex"):
                    raise error("domain 请填 real（实数）或 complex（复数）。")
            if key=="assumption":
                value={"实数":"real","正实数":"positive","一般":"complex","复数":"complex"}.get(value,value.lower())
                if value not in ("real","positive","complex"):
                    raise error("assume 请填 real、positive 或 complex。")
            settings[key]=value
        else:
            rows.append(row)
    return rows,settings


def bare_derivatives(expression):
    substituted=set()
    for node in expression.atoms(s.Subs):
        substituted.update(node.expr.atoms(s.Derivative))
    return expression.atoms(s.Derivative)-substituted


def check_unknown_function(function, unknown, error):
    if unknown and "".join(unknown.split()) not in (function.func.__name__, str(function)):
        raise error("请填写方程中的未知函数，例如 y(x) 或 y。")


def ordinary_differential(pairs,add,notes,error,unknown=None):
    ode_rows=[i for i,(left,right) in enumerate(pairs) if bare_derivatives(left-right)]
    if len(ode_rows)!=1:
        raise error("目前支持一个未知函数的常微分方程，可附初始条件；联立微分方程和偏微分方程暂不支持。")
    index=ode_rows[0]
    equation=pairs[index][0]-pairs[index][1]
    functions=set().union(*(node.expr.atoms(AppliedUndef) for node in bare_derivatives(equation)))
    if len(functions)!=1:
        raise error("常微分方程中请只使用一个未知函数，例如 y(x)。")
    function=next(iter(functions))
    check_unknown_function(function, unknown, error)
    if len(function.args)!=1 or not isinstance(function.args[0],s.Symbol):
        raise error("未知函数请写成 y(x) 这样的单变量形式。")
    variable=function.args[0]
    if any(node.func!=function.func or node.args!=(variable,) for node in equation.atoms(AppliedUndef)):
        raise error("该微分方程包含其他未知函数或不同自变量，暂不能按单函数常微分方程处理。")
    ics={}
    for i,(left,right) in enumerate(pairs):
        if i==index:
            continue
        if isinstance(right,(AppliedUndef,s.Subs)) and not isinstance(left,(AppliedUndef,s.Subs)):
            left,right=right,left
        if isinstance(left,AppliedUndef):
            valid=left.func==function.func and len(left.args)==1 and variable not in left.args[0].free_symbols
        elif isinstance(left,s.Subs):
            valid=left.expr.has(function) and bare_derivatives(left.expr) and all(variable not in point.free_symbols for point in left.point)
        else:
            valid=False
        if not valid or variable in right.free_symbols or right.has(AppliedUndef,s.Derivative):
            raise error("初始条件请写为 y(0)=1；导数初值写为 at(diff(y(x),x),x,0)=2。")
        if left in ics:
            raise error("同一个初始条件请只填写一次。")
        ics[left]=right
    answer=s.dsolve(s.Eq(equation,0),function,ics=ics or None)
    answers=answer if isinstance(answer,list) else [answer]
    for solution in answers:
        add("微分方程特解" if ics else "微分方程通解",solution,numeric=False)
    if not ics:
        notes.append("C1、C2 等为任意常数；可在同一输入框另起一行加入 y(0)=1 这样的初始条件。")
    notes.append("当前求解对象是单函数常微分方程；返回隐式解或特殊函数也是可能的。")


def volterra_equation(pairs,add,notes,error,unknown=None):
    if len(pairs)!=1:
        raise error("积分方程模式目前接受一个 Volterra 型积分方程，初值由积分下限自动导出。")
    expression=pairs[0][0]-pairs[0][1]
    integrals=expression.atoms(s.Integral)
    outside=expression.xreplace({integral:s.Integer(0) for integral in integrals})
    functions=outside.atoms(AppliedUndef)
    if len(functions)!=1:
        raise error("积分方程请写成 y(x)=1+integrate(y(t),t,0,x) 这样的单函数变上限形式。")
    function=next(iter(functions))
    check_unknown_function(function, unknown, error)
    if len(function.args)!=1 or not isinstance(function.args[0],s.Symbol):
        raise error("积分方程的未知函数请写成 y(x)。")
    variable=function.args[0]
    lowers=set()
    for integral in integrals:
        if len(integral.limits)!=1 or len(integral.limits[0])!=3:
            raise error("积分方程目前要求单层定积分。")
        dummy,lower,upper=integral.limits[0]
        if upper!=variable or lower.free_symbols or lower.is_real is not True or lower.is_finite is not True:
            raise error("积分方程目前要求有限的固定下限与自变量上限，例如 integrate(y(t),t,0,x)。")
        lowers.add(lower)
        if any(node.func!=function.func or node.args!=(dummy,) for node in integral.function.atoms(AppliedUndef)):
            raise error("积分内部请使用同一未知函数和积分变量，例如 y(t)。")
    if len(lowers)!=1:
        raise error("同一积分方程的积分下限须一致。")
    lower=next(iter(lowers))
    derived=expression
    for count in range(1,4):
        derived=s.diff(derived,variable)
        if not derived.has(s.Integral):
            break
    else:
        raise error("此积分方程在三次求导后仍含积分，暂未支持这种核函数；可尝试改写方程。")
    ics={}
    for order in range(count):
        condition=s.diff(expression,variable,order).subs(variable,lower).doit()
        initial=s.diff(function,variable,order).subs(variable,lower)
        values=s.solve(condition,initial)
        if len(values)!=1:
            raise error("无法从积分方程导出唯一初值，请检查积分下限或改写方程。")
        ics[initial]=values[0]
    answer=s.dsolve(s.Eq(derived,0),function,ics=ics)
    answers=answer if isinstance(answer,list) else [answer]
    verified=[]
    for solution in answers:
        if not isinstance(solution,s.Equality) or solution.lhs!=function:
            continue
        substituted=expression.replace(lambda node:isinstance(node,AppliedUndef) and node.func==function.func,
                                       lambda node:solution.rhs.subs(variable,node.args[0]))
        if s.simplify(substituted.doit())==0:
            verified.append(solution)
    if not verified:
        raise error("得到的候选解未能通过原积分方程回代核对，请改写方程或缩小求解范围。")
    for solution in verified:
        add("积分方程解",solution,numeric=False)
    notes.append("此解已回代原积分方程核对；目前支持可通过至多三次求导消去积分的单函数 Volterra 型方程。")


def solve_matrix_equation(data, parser, add, notes, error):
    from engine import matrix, normalize_math_text

    try:
        form = json.loads(data.get("matrixEquation", ""))
    except (TypeError, json.JSONDecodeError, RecursionError):
        raise error("请填写矩阵方程并指定未知矩阵。") from None
    if not isinstance(form, dict) or not isinstance(form.get("equation"), str) or not isinstance(form.get("matrices"), dict):
        raise error("请填写矩阵方程并指定未知矩阵。")
    equation = re.sub(r"\s+", "", normalize_math_text(form["equation"]))
    products = equation.split("=")
    if len(products) != 2 or any(not re.fullmatch(r"[A-Za-z]+(?:\*[A-Za-z]+)*", side) for side in products):
        raise error("矩阵方程用单个英文字母命名矩阵。请填写 A*X*B=D 或 AXB=D 这样的乘积等式。")
    left_names, right_names = [list(side.replace("*", "")) for side in products]
    if max(len(left_names), len(right_names)) > 9:
        raise error("矩阵方程每侧最多使用 9 个因子。")
    names = left_names + right_names
    name = form.get("unknown")
    if not isinstance(name, str) or name not in names:
        raise error("请从方程中选择一个未知矩阵。")
    if names.count(name) != 1:
        raise error("未知矩阵在方程中须只出现一次。可以重复使用其他已知矩阵。")

    known = {}
    for label in dict.fromkeys(label for label in names if label != name):
        value = form["matrices"].get(label)
        if not isinstance(value, str) or not value.strip():
            raise error(f"请填写矩阵 {label}。")
        try:
            result = matrix(value, parser)
        except ValueError as exc:
            raise error(f"矩阵 {label} 输入有误。{exc}") from exc
        if result.has(s.oo, -s.oo, s.zoo, s.nan):
            raise error("矩阵方程中的元素须有定义且有限。")
        known[label] = result

    def product(parts):
        first, *rest = parts
        value = known[first]
        for label in rest:
            factor = known[label]
            if value.cols != factor.rows:
                raise error("矩阵乘积的相邻因子尺寸不匹配。")
            value = value * factor
        return value

    if name not in left_names:
        left_names, right_names = right_names, left_names
    position = left_names.index(name)
    target = product(right_names)
    before, after = left_names[:position], left_names[position + 1:]
    a = product(before) if before else s.eye(target.rows)
    b = product(after) if after else s.eye(target.cols)
    if (a.rows, b.cols) != target.shape:
        raise error("矩阵方程两边尺寸不匹配。请检查未知矩阵两侧因子和等号另一边的尺寸。")

    # Row-wise flattening turns A*X*B into (A ⊗ B.T) times the entries of X.
    coefficients = s.kronecker_product(a, b.T)
    values = s.Matrix(list(target))
    try:
        solution, parameters = coefficients.gauss_jordan_solve(values)
    except ValueError as exc:
        if "no solution" not in str(exc).lower():
            raise
        add("矩阵方程解", s.EmptySet, numeric=False)
        notes.append("矩阵方程无解。")
        return
    add(f"{name} =", s.Matrix(a.cols, b.rows, list(solution)))
    if len(parameters):
        notes.append("矩阵方程有无穷多解，解中的 τ 为自由参数。")
    if any(value.free_symbols for value in (a, b, target)):
        notes.append("含参数矩阵的结果按一般参数条件计算；特殊参数取值可能改变秩、可逆性或解的数量。")


def solve_equations(data,parser,add,notes,error,add_graph):
    mode=data.get("operation","auto")
    if mode == "matrix":
        return solve_matrix_equation(data, parser, add, notes, error)
    rows=document_rows(data.get("equations",""))
    if not 1<=len(rows)<=10:
        raise error("请填写 1～10 个方程，每行一个。")
    pairs=[]
    for row in rows:
        if row.count("=")>1:
            raise error("每个方程只能有一个等号。")
        left,right=row.split("=") if "=" in row else (row,"0")
        pairs.append((parser.parse(left),parser.parse(right)))
    residuals=[left-right for left,right in pairs]
    if any(expr.has(s.Order) for expr in residuals):
        raise error("方程中的级数展开仍含余项。请使用级数求和，或用 trunc 显式取截断表达式。")
    if any(expr.has(s.oo,-s.oo,s.zoo,s.nan) for expr in residuals):
        raise error("方程含有无定义或无穷值，请检查积分收敛性、极限与定义域。")
    functional_integral=any(integral.has(AppliedUndef) for expr in residuals for integral in expr.atoms(s.Integral))
    if functional_integral:
        if mode not in ("auto","integral","ode"):
            raise error("这是未知函数的积分方程，请选择方程自动求解或积分方程模式。")
        return volterra_equation(pairs,add,notes,error,data.get("variables"))
    if any(bare_derivatives(expr) for expr in residuals) or mode=="ode":
        return ordinary_differential(pairs,add,notes,error,data.get("variables"))
    if any(expr.has(AppliedUndef,s.Derivative,s.Limit) for expr in residuals):
        raise error("仍含未知函数或未求出的极限；函数方程需要更多条件，不能当成普通代数方程直接求根。")
    if any(expr.has(s.Integral) for expr in residuals) and mode=="numeric":
        raise error("方程仍含未求出的积分，当前数值求根不支持；请改写积分或先给出解析式。")
    if data.get("variables"):
        variables=parser.variables(data["variables"])
    elif data.get("infer_variables"):
        variables=sorted(set().union(*(expr.free_symbols for expr in residuals)),key=s.default_sort_key)
        if len(variables)>8:
            raise error("最多求解 8 个未知数，可用 vars: x,y 指定待求变量。")
    else:
        variables=parser.variables("x,y")
    if not variables:
        true=all(s.simplify(expr)==0 for expr in residuals)
        add("等式判断",s.true if true else s.false,numeric=False)
        notes.append("等式恒成立，没有待求未知数。" if true else "等式不成立，没有待求未知数。")
        return
    if data.get("infer_variables") and not data.get("variables"):
        notes.append("所求未知数："+", ".join(map(str,variables))+"。需要区分参数时，可另起一行写 vars: x。")
    from engine import graph_equation
    for left,right in pairs:
        add_graph(graph_equation(left,right,variables))
    if mode in ("auto","integral"):
        if len(variables)==1 and len(residuals)==1:
            mode="solve"
        else:
            try:
                s.linear_eq_to_matrix(residuals,variables)
                mode="linear"
            except NonlinearError:
                mode="system"
    if mode=="linear":
        answer=s.linsolve(residuals,variables)
        add("线性方程组解集",answer,numeric=False)
        if answer is s.EmptySet:
            notes.append("方程组无解。")
        else:
            for variable,value in zip(variables,next(iter(answer))):
                add(str(variable),value)
            if any(variable in answer.free_symbols for variable in variables):
                notes.append("有无穷多解，保留的未知数为自由参数。")
    elif mode=="solve":
        if len(variables)!=1 or len(residuals)!=1:
            raise error("单变量符号求根接受一个方程和一个未知数；多元方程请选择自动或方程组求解。")
        domain=s.S.Reals if data.get("domain","real")=="real" else s.S.Complexes
        answer=s.solveset(residuals[0],variables[0],domain=domain)
        add("解集",answer,numeric=False)
        if answer is s.EmptySet:
            notes.append("在所选数域内无解。")
        if answer.has(s.ConditionSet):
            notes.append("未求出完整显式解，保留条件解集。")
    elif mode=="system":
        answer=s.nonlinsolve(residuals,variables)
        add("非线性方程组解集（顺序对应未知数）",answer,numeric=False)
        if answer is s.EmptySet:
            notes.append("方程组无解。")
        notes.append("非线性方程组按复数域求解；超越方程可能返回条件或参数解。")
    elif mode=="numeric":
        from engine import evaluate_to_digits, split_cells
        guesses=split_cells(data.get("guesses") or ",".join("1" for _ in variables))
        if len(guesses)!=len(variables):
            raise error("初值数量须与未知数数量一致；可另起一行填写 guess: 1,1。")
        values=[parser.parse(guess) for guess in guesses]
        if any(value.free_symbols for value in values):
            raise error("数值初值须为具体数值。")
        if set().union(*(expr.free_symbols for expr in residuals))-set(variables):
            raise error("数值求根前请将系数参数替换为具体数值。")
        precision = int(data.get("precision", 12))
        decimal_places = data.get("decimalPlaces")
        answer=s.nsolve(residuals,variables,values,prec=max(16, precision + 8, (decimal_places or 0) + 18),verify=True)
        for variable,value in zip(variables,answer):
            if decimal_places is None:
                value = evaluate_to_digits(value, precision)
            add(str(variable),value,numeric=False,tex=s.latex(value, full_prec=True),approximate_primary=True)
        notes.append("数值求根只返回初值附近的一组近似解，不代表全部解。")
    else:
        raise error("未知的方程求解操作。")
