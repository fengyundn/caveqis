import json
import unittest
import sympy as s
from engine import compute, Parser, InputError


class EquationWorkspaceTests(unittest.TestCase):
    def run_input(self,text,operation="equation_auto"):
        return compute({"category":"calculate","operation":operation,"expression":text})

    def run_matrix(self, equation, unknown, **matrices):
        form = json.dumps({"equation":equation, "unknown":unknown, "matrices":matrices})
        return compute({"category":"equations","operation":"equation_matrix","matrixEquation":form})

    def test_graph_transfer_for_scalar_results_and_equations(self):
        self.assertEqual(self.run_input("log(100)", "evaluate")["graph"], ["y = log(100)"])
        self.assertEqual(self.run_input("q^2=4")["graph"], ["y = x**2 - 4"])
        self.assertEqual(self.run_input("x+y=2\nx-y=0")["graph"], ["x + y = 2", "x - y = 0"])
        ode = self.run_input("diff(y(x),x)=y(x)\ny(0)=1")
        self.assertEqual(ode["graph"], ["y = exp(x)"])
        self.assertNotIn("graph", self.run_input("sqrt(-1)", "evaluate"))
        self.assertEqual(self.run_input("realroot(-8,3)+cbrt(-8)", "evaluate")["items"][0]["text"], "-4")

    def test_matrix_equations_with_left_right_and_middle_unknowns(self):
        triples = {"A":"1,2;0,1", "B":"1,2;3,4", "C":"2,0;1,1", "D":"24,10;10,4"}
        for name in triples:
            with self.subTest(name=name):
                entered = {label:value for label,value in triples.items() if label != name}
                item = self.run_matrix("Ａ×Ｂ×Ｃ＝Ｄ", name, **entered)["items"][0]
                self.assertEqual(item["label"], f"{name} =")
                self.assertEqual(item["matrix"], [row.split(",") for row in triples[name].split(";")])
        item = self.run_matrix("U*X*V=P*Q", "X", U="1,0;0,1;1,1", V="1,0,1;0,1,2", P="1,2;3,4;4,6", Q="1,0,1;0,1,2")["items"][0]
        self.assertEqual(item["matrix"], [["1","2"],["3","4"]])
        self.assertEqual(self.run_matrix("AAX=B", "X", A="2", B="12")["items"][0]["matrix"],[["3"]])

    def test_matrix_equation_singular_and_invalid_cases(self):
        infinite = self.run_matrix("AX=B", "X", A="1,0;0,0", B="5;0")
        self.assertIn("自由参数", infinite["notes"][0])
        self.assertEqual(infinite["items"][0]["matrix"][0], ["5"])
        self.assertEqual(self.run_matrix("AX=B", "X", A="1,0;0,0", B="5;1")["items"][0]["text"],"EmptySet")
        for formula, unknown, matrices, message in [
            ("AX=B", "X", {"A":"1,0;0,1"}, "请填写矩阵 B"),
            ("AX=B", "X", {"A":"1,0;0,1", "B":"5;1;0"}, "两边尺寸"),
            ("AX=XB", "X", {}, "只出现一次"),
            ("AB", "A", {}, "乘积等式"),
        ]:
            with self.subTest(formula=formula, message=message), self.assertRaisesRegex(InputError, message):
                self.run_matrix(formula, unknown, **matrices)

    def test_inline_substitution_and_settings(self):
        result=self.run_input("x^2+y\nx=2\ny=3\ndigits: 20","evaluate")
        self.assertEqual(result["items"][0]["text"],"7")
        result=self.run_input("a*x=2\nvars: x\nassume: positive")
        self.assertIn("2/a",result["items"][0]["text"])

    def test_automatic_equation_and_constant_equalities(self):
        result=self.run_input("x^2=4","evaluate")
        self.assertEqual(result["items"][0]["text"],"{-2, 2}")
        self.assertEqual(self.run_input("2+2=4")["items"][0]["text"],"True")
        self.assertEqual(self.run_input("2+2=5")["items"][0]["text"],"False")

    def test_existing_modes_in_single_input(self):
        result=self.run_input("2*x+y=5\nx-y=1","equation_linear")
        self.assertEqual([item["text"] for item in result["items"]][1:],["2","1"])
        result=self.run_input("cos(x)=x\nguess: 1","equation_numeric")
        self.assertAlmostEqual(float(result["items"][0]["text"]),0.739085133215,places=10)
        result=self.run_input("x^2+1=0\ndomain: complex","equation_solve")
        self.assertEqual(result["items"][0]["text"],"{-I, I}")
        self.assertTrue(self.run_input("x^2+y^2=1\nx-y=0","equation_system")["items"])

    def test_calculus_in_algebraic_equations(self):
        cases=[("integrate(t,t,0,a)=2","{-2, 2}"),
               ("diff(x^3,x)=12","{-2, 2}"),
               ("limit(sin(a*x)/x,x,0)=2","{2}"),
               ("at(diff(a*x^2,x),x,1)=4","{2}"),
               ("integrate(t,t,0,x)+at(diff(t^2,t),t,1)+limit(sin(t)/t,t,0)=5","{-2, 2}"),
               ("积分（ｔ，ｔ，０，ａ）＝２","{-2, 2}")]
        for text,expected in cases:
            with self.subTest(text=text):
                self.assertEqual(self.run_input(text)["items"][0]["text"],expected)

    def test_differential_equation_and_initial_value(self):
        result=self.run_input("diff(y(x),x)=y(x)\ny(0)=2","equation_ode")
        self.assertEqual(result["items"][0]["text"],"Eq(y(x), 2*exp(x))")
        result=self.run_input("diff(y(x),x,2)+y(x)=0\ny(0)=0\nat(diff(y(x),x),x,0)=1","equation_ode")
        self.assertEqual(result["items"][0]["text"],"Eq(y(x), sin(x))")
        result=self.run_input("diff(f(t),t)=2*t")
        self.assertIn("t**2",result["items"][0]["text"])

    def test_integral_function_equations(self):
        result=self.run_input("y(x)=1+integrate(y(t),t,0,x)","equation_integral")
        self.assertEqual(result["items"][0]["text"],"Eq(y(x), exp(x))")
        result=self.run_input("y(x)=1+integrate((x-t)*y(t),t,0,x)","equation_integral")
        self.assertIn("积分方程解",result["items"][0]["label"])
        solution=result["items"][0]["text"]
        self.assertTrue("exp(x)" in solution or "cosh(x)" in solution)

    def test_operators_remain_restricted(self):
        for text in ["diff(x^2,x,999)","limit(1/x,x,0)","integrate(x,2,0,1)","at(x,x,x)","diff(x,x,order=2)","limit(x,x,0,'+')"]:
            with self.subTest(text=text),self.assertRaises(InputError):
                Parser().parse(text)
        with self.assertRaisesRegex(InputError,"上下限"):
            self.run_input("integrate(x,x)=2")
        with self.assertRaises(InputError):
            self.run_input("diff(y(x),x)+diff(f(x),x)=0","equation_ode")

    def test_determinant_is_a_scalar_inside_a_mixed_equation(self):
        equation = "det([x,2],[3,4])+∫(t,t,0,2)+∂(t^2,t,2)+lim(sin(t)/t,t,0)+∑(n,n,1,3)+log(8,2)+sqrt(4)+asin(0)=18"
        result = compute({"category":"equations","operation":"equation_auto","expression":equation})
        self.assertEqual(result["items"][0]["text"], "{2}")
        self.assertEqual(Parser().parse("det([[1,2],[3,4]])"), -2)
        with self.assertRaisesRegex(InputError, "方阵"):
            Parser().parse("det([1,2,3],[4,5,6])")

    def test_series_and_differentials_in_equations(self):
        result = compute({"category":"equations","operation":"equation_auto","expression":"at(trunc(exp(t),t,0,3),t,1)+totaldiff(x*y,x,y)=15/2\nvars: x"})
        self.assertIn("dx", result["items"][0]["text"])

    def test_equations_in_corresponding_calculus_categories(self):
        cases=[
            ("integral","equation_auto","integrate(t,t,0,a)=2","{-2, 2}"),
            ("integral","equation_integral","y(x)=1+integrate(y(t),t,0,x)","Eq(y(x), exp(x))"),
            ("derivative","equation_auto","diff(x^3,x)=12","{-2, 2}"),
            ("derivative","equation_ode","diff(y(x),x)=y(x)\ny(0)=1","Eq(y(x), exp(x))"),
            ("analysis","equation_auto","limit(sin(a*x)/x,x,0)=2","{2}"),
        ]
        for category,operation,expression,expected in cases:
            with self.subTest(category=category,operation=operation):
                answer=compute(dict(category=category,operation=operation,expression=expression))
                self.assertEqual(answer["items"][0]["text"],expected)
        for category,expression in [("integral","integrate(exp(t),t,0,x)=2"),("analysis","limit((1+a/x)^x,x,oo)=3")]:
            answer=compute(dict(category=category,operation="equation_numeric",expression=expression+"\nguess: 1"))
            self.assertAlmostEqual(float(answer["items"][0]["text"]),float(s.log(3)),places=9)


if __name__=="__main__":
    unittest.main()
