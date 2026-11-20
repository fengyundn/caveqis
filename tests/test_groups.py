import unittest
import sympy as s
from engine import Parser, InputError, compute, matrix


class GroupingTests(unittest.TestCase):
    def test_nested_priority(self):
        p=Parser()
        for expression,expected in [("{2+[3*(4+1)]}",17),("2[3+{4*(5-1)}]",38),
                                    ("-[2+3]^2",-25),("{[1+2]/(4-1)}^2",1),
                                    ("｛２＋【３×（４＋１）】｝",17), ("exp({[1-1]})",1)]:
            with self.subTest(expression=expression):
                self.assertEqual(p.parse(expression),expected)

    def test_invalid_groups(self):
        for expression in ["{2+[3*(4+1)]", "(1+2]", "[1+{2)]}", "1+2}", "{1,2}", "{'a':1}"]:
            with self.subTest(expression=expression),self.assertRaises(InputError):
                Parser().parse(expression)

    def test_matrix_structure_and_arithmetic_groups(self):
        p=Parser()
        self.assertEqual(matrix("[[1,2],[3,4]]",p),s.Matrix([[1,2],[3,4]]))
        self.assertEqual(matrix("[[1+[2*3], {4+5}], [6,7]]",p),s.Matrix([[7,9],[6,7]]))
        self.assertEqual(matrix("[1+[2*3], {4+5}; 6,7]",p),s.Matrix([[7,9],[6,7]]))
        self.assertEqual(matrix("log(8, 2)",p),s.Matrix([[3]]))
        self.assertEqual(matrix("正弦 （π／２）",p),s.Matrix([[1]]))
        self.assertEqual(matrix("1 + 2, 3\n4, 5",p),s.Matrix([[3,3],[4,5]]))

    def test_grouping_in_substitutions_and_calculus(self):
        result=compute({"expression":"力", "substitutions":"力＝｛２＋【３×（４＋１）】｝"})
        self.assertEqual(result["items"][0]["text"],"17")
        result=compute({"category":"derivative","operation":"differentiate","expression":"{[x+1]*(x-1)}^2","variables":"x"})
        self.assertEqual(s.simplify(Parser().parse(result["items"][0]["text"])-4*s.Symbol("x")*(s.Symbol("x")**2-1)),0)
        result=compute({"category":"integral","operation":"definite","expression":"[x+{1}]","variables":"x","lower":"{1-1}","upper":"[1+1]"})
        self.assertEqual(result["items"][0]["text"],"4")


if __name__=="__main__":
    unittest.main()
