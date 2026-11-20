"""Regression checks for exact math, degenerate systems, and the input boundary."""
import unittest
import sympy as s
from engine import Parser, InputError, compute, matrix


class ParserTests(unittest.TestCase):
    def test_exact_and_implicit(self):
        p = Parser()
        x = p.symbol("x")
        self.assertEqual(p.parse("0.1+0.2"), s.Rational(3,10))
        self.assertEqual(s.expand(p.parse("2x + (x+1)(x-1)")), x*x+2*x-1)
        self.assertEqual(p.parse("log(8,2)+sqrt(4)+2^3"), 13)
        self.assertEqual(p.parse("1e-3"), s.Rational(1,1000))

    def test_angle(self):
        self.assertEqual(Parser(degrees=True).parse("sin(30) + asin(1)/180"), 1)
        self.assertEqual(Parser().parse("sin(pi/2)"), 1)

    def test_reject_code_and_cost(self):
        for text in ["__import__('os')", "x.__class__", "x[0].__class__", "lambda: 1", "(x for x in y)", "9^9^9", "((999^999)^999)^999", "factorial(999999)", "1/0", "root(2,0)", "1e99999"]:
            with self.subTest(text=text), self.assertRaises((InputError, ValueError, TypeError)):
                Parser().parse(text)

    def test_matrix_formats(self):
        for text in ["1,2;3,4", "[[1,2],[3,4]]", "1\t2\n3\t4", "1 2\n3 4"]:
            self.assertEqual(matrix(text,Parser()),s.Matrix([[1,2],[3,4]]))
        self.assertEqual(matrix("log(8,2), 1/3\n0, sqrt(2)",Parser())[0,0],3)
        with self.assertRaises(InputError):
            matrix("1,2\n3",Parser())


class ComputationTests(unittest.TestCase):
    def run_math(self, category, operation, **kwargs):
        return compute({"category":category,"operation":operation,**kwargs})

    def test_calculator(self):
        for op,expr,expected in [("evaluate","1/3+2/5","11/15"),("factor","x^2-1","(x - 1)*(x + 1)"),("cancel","(x^2-1)/(x-1)","x + 1"),("trigsimp","sin(x)^2+cos(x)^2","1")]:
            self.assertEqual(self.run_math("calculate",op,expression=expr)["items"][0]["text"],expected)
        self.assertEqual(self.run_math("calculate","evaluate",expression="x+y",substitutions="x=y; y=2")["items"][0]["text"],"y + 2")

    def test_calculus_functions_stay_in_radians_in_scientific_degree_mode(self):
        cases = {
            "lim(sin(x)/x,x,0)": "1",
            "sum(sin(pi/2*n),n,1,1)": "1",
            "series(sin(x),x,0,4)": "x - x**3/6 + O(x**4)",
            "trunc(sin(x),x,0,2)": "x",
        }
        for expression, expected in cases.items():
            with self.subTest(expression=expression):
                result = self.run_math("calculate", "evaluate", angle="deg", expression=expression)
                self.assertEqual(result["items"][0]["text"], expected)
        self.assertEqual(self.run_math("calculate","evaluate",angle="deg",expression="sin(30)")["items"][0]["text"],"1/2")

    def test_requested_significant_digits(self):
        options = {
            2: ("3.1", "0.74"),
            3: ("3.14", "0.739"),
            4: ("3.142", "0.7391"),
            6: ("3.14159", "0.739085"),
            31: ("3.141592653589793238462643383280", "0.7390851332151606416553120876739"),
        }
        for digits, (approx, root) in options.items():
            with self.subTest(digits=digits):
                value = self.run_math("calculate", "evaluate", expression="pi", precision=digits)["items"][0]
                self.assertEqual(value["text"], "pi")
                self.assertEqual(value["approx"], approx)
                answer = self.run_math("equations", "equation_numeric", expression="cos(x)=x\nguess: 1", precision=digits)
                self.assertEqual(answer["items"][0]["text"], root)

    def test_matrix_operations(self):
        data={"matrixA":"1,2\n3,4","matrixB":"2,0\n1,2"}
        for op in ["add","subtract","multiply","divide","hadamard","scale","power","det","inverse","transpose","adjoint","rank","trace","rref","nullspace","eigen","charpoly","lu"]:
            with self.subTest(operation=op):
                answer=self.run_math("matrix",op,**data)
                self.assertTrue(answer["items"] or answer["notes"])
        self.assertEqual(self.run_math("matrix","multiply",**data)["items"][0]["matrix"],[["4","4"],["10","8"]])
        self.assertEqual(self.run_math("matrix","divide",**data)["items"][0]["matrix"],[["0","1"],["1/2","2"]])
        self.assertEqual(self.run_math("matrix","det",**data)["items"][0]["text"],"-2")

    def test_linear_degenerate(self):
        unique=self.run_math("matrix","solve",matrixA="2,1\n1,-1",matrixB="5\n1",variables="x,y")
        self.assertEqual([i["text"] for i in unique["items"]][1:],["2","1"])
        no=self.run_math("matrix","solve",matrixA="1,1\n2,2",matrixB="1\n3",variables="x,y")
        self.assertEqual(no["items"][0]["text"],"EmptySet")
        infinite=self.run_math("equations","linear",equations="x+y=1\n2*x+2*y=2",variables="x,y")
        self.assertIn("无穷多解","".join(infinite["notes"]))

    def test_determinant_operations(self):
        data = {"matrixA":"1,2\n3,4", "matrixB":"2,0\n1,2", "row":"1", "column":"2", "scalar":"1/2", "power":"3"}
        cases = {
            "det": "-2", "minor": "3", "cofactor": "-3", "expand_row": "-2",
            "expand_column": "-2", "transpose": "-2", "product": "-8",
            "scale": "-1/2", "power": "-8", "inverse": "-1/2",
        }
        for op, expected in cases.items():
            with self.subTest(operation=op):
                item = self.run_math("determinant", op, **data)["items"][0]
                self.assertEqual(item["text"], expected)
                if op.startswith("expand"):
                    self.assertIn(r"\cdot", item["latex"])
        self.assertEqual(self.run_math("determinant","minor",matrixA="7")["items"][0]["text"],"1")
        self.assertEqual(self.run_math("determinant","formula",expression="行列式（【1，2】，【3，4】）+det([3])")["items"][0]["text"],"1")
        for op, invalid in [("det", {"matrixA":"1,2"}), ("minor", {"row":"3"}), ("product", {"matrixB":"7"}), ("inverse", {"matrixA":"1,2;2,4"})]:
            with self.subTest(invalid=op), self.assertRaises(InputError):
                self.run_math("determinant", op, **(data | invalid))

    def test_derivative_modes(self):
        self.assertEqual(self.run_math("derivative","partial",expression="x^3*y^2",variables="x:2,y:1")["items"][0]["text"],"12*x*y")
        gradient=self.run_math("derivative","gradient",expression="x^2+y^2",variables="x,y",substitutions="x=1;y=2")
        self.assertEqual(gradient["items"][1]["matrix"],[["2"],["4"]])
        self.assertEqual(self.run_math("derivative","hessian",expression="x^2+x*y+y^2",variables="x,y")["items"][0]["matrix"],[["2","1"],["1","2"]])
        self.assertEqual(self.run_math("derivative","differential",expression="x*y",variables="x,y")["items"][0]["text"],"dx*y + dy*x")

    def test_integrals(self):
        indefinite=self.run_math("integral","indefinite",expression="x*exp(x)",variables="x")["items"][0]
        self.assertTrue(indefinite["latex"].endswith(" + C"))
        self.assertEqual(self.run_math("integral","definite",expression="exp(-x^2)",variables="x",lower="-oo",upper="oo")["items"][0]["text"],"sqrt(pi)")
        self.assertEqual(self.run_math("integral","multiple",expression="x+y",bounds="x,0,y\ny,0,1")["items"][0]["text"],"1/2")
        with self.assertRaisesRegex(InputError, "第 2 行的第一项须为积分变量"):
            self.run_math("integral", "multiple", expression="x+y", bounds="y,0,x\n1,0,y")
        self.assertEqual(self.run_math("integral","multiple",expression="1",bounds="x,0,1\ny,0,1\nz,0,1")["items"][0]["text"],"1")
        divergent=self.run_math("integral","definite",expression="1/x",variables="x",lower="0",upper="1")
        self.assertIn("发散","".join(divergent["notes"]))
        with self.assertRaises(InputError):
            self.run_math("integral","multiple",expression="x+y",bounds="x,0,1\ny,0,x")

    def test_equations(self):
        roots=self.run_math("equations","solve",equations="x^3-6*x^2+11*x-6=0",variables="x")
        self.assertEqual(roots["items"][0]["text"],"{1, 2, 3}")
        no=self.run_math("equations","solve",equations="x^2+1=0",variables="x",domain="real")
        self.assertEqual(no["items"][0]["text"],"EmptySet")
        complex_roots=self.run_math("equations","solve",equations="x^2+1=0",variables="x",domain="complex")
        self.assertIn("I",complex_roots["items"][0]["text"])
        numerical=self.run_math("equations","numeric",equations="cos(x)=x",variables="x",guesses="1")
        self.assertAlmostEqual(float(numerical["items"][0]["text"]),0.739085133215,places=10)
        self.assertTrue(self.run_math("equations","system",equations="x^2+y^2=1\nx-y=0",variables="x,y")["items"])

    def test_analysis(self):
        self.assertEqual(self.run_math("analysis","limit",expression="sin(x)/x",variables="x",point="0")["items"][0]["text"],"1")
        bad=self.run_math("analysis","limit",expression="1/x",variables="x",point="0")
        self.assertIn("不存在","".join(bad["notes"]))
        self.assertIn("O(x**6)",self.run_math("analysis","series",expression="exp(x)",variables="x",point="0",order="6")["items"][0]["text"])
        self.assertEqual(self.run_math("series","summation",expression="1/n",variables="n",lower="1",upper="5")["items"][0]["text"],"137/60")


if __name__=="__main__":
    unittest.main()
