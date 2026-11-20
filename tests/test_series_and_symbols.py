import unittest
import sympy as s
from engine import Parser, InputError, compute


class SeriesAndSymbolsTests(unittest.TestCase):
    def test_unicode_operator_inputs(self):
        p=Parser()
        x=p.symbol("x")
        for text,expected in [("∫（ｘ，ｘ）",x**2/2),("∂（ｘ³，ｘ）",3*x*x),
                              ("lim(sin(x)/x,x,0)",1),("∑（１／ｎ²，ｎ，１，∞）",s.pi**2/6),
                              ("Σ(n,n,1,10)",55),("求和(n,n,1,10)",55)]:
            with self.subTest(text=text):
                self.assertEqual(p.parse(text),expected)
        self.assertEqual(p.parse("级数(exp(x),x,0,3)"),1+x+x*x/2+s.Order(x**3))

    def test_explicit_formulas_do_not_apply_the_operation_twice(self):
        answer=compute(dict(category="integral",operation="formula",expression="∫(x,x)"))
        self.assertEqual(answer["items"][0]["text"],"x**2/2 + C")
        answer=compute(dict(category="integral",operation="formula",expression="∫(x,x,0,1)"))
        self.assertEqual(answer["items"][0]["text"],"1/2")
        answer=compute(dict(category="derivative",operation="formula",expression="∂(x^3,x)"))
        self.assertEqual(answer["items"][0]["text"],"3*x**2")
        answer=compute(dict(category="analysis",operation="formula",expression="lim(sin(x)/x,x,0)"))
        self.assertEqual(answer["items"][0]["text"],"1")
        for category,operation,expression,expected in [("integral","indefinite","∫(x,x)","x**2/2 + C"),("derivative","differentiate","∂(x^3,x)","3*x**2"),("analysis","limit","lim(sin(x)/x,x,0)","1")]:
            with self.subTest(manual=expression):
                answer=compute(dict(category=category,operation=operation,expression=expression))
                self.assertEqual(answer["items"][0]["text"],expected)

    def test_finite_infinite_and_geometric_series(self):
        for term,lower,upper,expected in [("1/n","1","5","137/60"),("1/n^2","1","oo","pi**2/6"),("(1/2)^n","0","∞","2")]:
            with self.subTest(term=term):
                answer=compute(dict(category="analysis",operation="summation",expression=term,variables="n",lower=lower,upper=upper))
                self.assertEqual(answer["items"][0]["text"],expected)
        answer=compute(dict(category="analysis",operation="formula",expression="∑(1/n^2,n,1,oo)"))
        self.assertEqual(answer["items"][0]["text"],"pi**2/6")
        answer=compute(dict(category="analysis",operation="limit",expression="∑(1/n^2,n,1,oo)"))
        self.assertEqual(answer["items"][0]["label"],"级数求和")

    def test_series_expansion_and_divergence_notes(self):
        answer=compute(dict(category="analysis",operation="formula",expression="series(exp(x),x,0,6)"))
        self.assertIn("O(x**6)",answer["items"][0]["text"])
        manual=compute(dict(category="analysis",operation="limit",expression="series(exp(x),x,0,6)"))
        self.assertIn("O(x**6)",manual["items"][0]["text"])
        answer=compute(dict(category="analysis",operation="summation",expression="1/n",variables="n",lower="1",upper="oo"))
        self.assertEqual(answer["items"][0]["text"],"oo")
        self.assertIn("发散","".join(answer["notes"]))

    def test_sum_and_series_parameter_boundaries(self):
        for text in ["sum(n,n,0.5,2)","sum(n,n,1,n)","sum(n,n,oo,2)","series(exp(x),x,x,6)","series(exp(x),x,0,99)"]:
            with self.subTest(text=text),self.assertRaises(InputError):
                Parser().parse(text)


if __name__=="__main__":
    unittest.main()
