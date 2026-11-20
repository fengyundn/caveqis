import unittest
import sympy as s
from engine import Parser, InputError, compute, matrix


class ChineseInputTests(unittest.TestCase):
    def test_fullwidth_math_and_functions(self):
        p=Parser()
        for text,expected in [("ｅｘｐ（０）＋平方根（９）",4), ("正弦（π／２）＋对数（８，２）",4),
                              ("２×３＋８÷４−１",7), ("阶乘（５）",120), ("√ （１６）",4),
                              ("１。５＋０．５",2), ("根号（４）＋常用对数（１００）",4)]:
            with self.subTest(text=text):
                self.assertEqual(p.parse(text),expected)
        self.assertEqual(p.parse("自然常数"),s.E)
        self.assertEqual(p.parse("无穷大"),s.oo)
        self.assertEqual(p.parse("指数（１）"),s.E)
        self.assertEqual(p.parse("正弦（３０）"),s.Rational(1,2) if p.degrees else s.sin(30))
        self.assertEqual(Parser(degrees=True).parse("正弦（３０）"),s.Rational(1,2))

    def test_chinese_symbols_and_superscripts(self):
        p=Parser()
        x=p.symbol("x")
        self.assertEqual(p.parse("ｘ²＋２ｘ＋１"),x*x+2*x+1)
        self.assertEqual(p.parse("温度1＋Fx"),p.symbol("温度1")+p.symbol("Fx"))
        self.assertEqual(p.variables("力、温度1；ｘ"),[p.symbol("力"),p.symbol("温度1"),x])

    def test_chinese_substitutions(self):
        result=compute({"expression":"力＋温度", "substitutions":"力＝对数（８，２），温度＝指数（０）"})
        self.assertEqual(result["items"][0]["text"],"4")
        with self.assertRaises(InputError):
            Parser().substitutions("力＝1；力＝2")

    def test_chinese_matrix_and_equations(self):
        self.assertEqual(matrix("【【１，２】，【３，４】】",Parser()),s.Matrix([[1,2],[3,4]]))
        result=compute({"category":"matrix","operation":"det","matrixA":"１、２；３、４"})
        self.assertEqual(result["items"][0]["text"],"-2")
        result=compute({"category":"equations","operation":"linear","variables":"力，距离","equations":"２×力＋距离＝５；力−距离＝１"})
        self.assertEqual([item["text"] for item in result["items"]][1:],["2","1"])

    def test_chinese_calculus_fields(self):
        result=compute({"category":"derivative","operation":"partial","expression":"力³×距离²","variables":"力：２，距离：１","substitutions":"力＝１；距离＝２"})
        self.assertEqual(result["items"][-1]["text"],"24")
        result=compute({"category":"integral","operation":"definite","expression":"指数（−ｘ）","variables":"ｘ","lower":"０","upper":"∞"})
        self.assertEqual(result["items"][0]["text"],"1")
        result=compute({"category":"integral","operation":"multiple","expression":"力＋距离","bounds":"力，０，距离；距离，０，１"})
        self.assertEqual(result["items"][0]["text"],"1/2")
        result=compute({"category":"analysis","operation":"limit","expression":"正弦（ｘ）／ｘ","variables":"ｘ","point":"０"})
        self.assertEqual(result["items"][0]["text"],"1")
        result=compute({"category":"matrix","operation":"power","matrixA":"１，０；０，１","power":"２"})
        self.assertEqual(result["items"][0]["matrix"],[["1","0"],["0","1"]])

    def test_normalization_preserves_input_boundary(self):
        for text in ["＿＿ｉｍｐｏｒｔ＿＿（'os'）","力.__class__","指数（）", "平方根（1,2）"]:
            with self.subTest(text=text),self.assertRaises((InputError,ValueError,TypeError)):
                Parser().parse(text)
        with self.assertRaisesRegex(InputError,"括号内需要填写参数"):
            Parser().parse("exp()")


if __name__=="__main__":
    unittest.main()
