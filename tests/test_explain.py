import unittest
from iscn_authenticator.parser import KaryotypeParser
from iscn_authenticator.explain import generate_template_explanation, lookup_curated_explanation, explain

class TestExplain(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.parser = KaryotypeParser()

    def test_template_normal_female(self):
        ast = self.parser.parse("46,XX")
        result = generate_template_explanation(ast)
        self.assertEqual(result.summary, "46,XX karyotype with 0 abnormalities.")
        self.assertIn("total chromosome count of 46", result.detail)
        self.assertEqual(result.confidence, "template")

    def test_template_trisomy_21(self):
        ast = self.parser.parse("47,XY,+21")
        abn = ast.abnormalities[0]
        result = generate_template_explanation(abn)
        self.assertEqual(result.summary, "Gain of chromosome 21.")
        self.assertEqual(result.confidence, "template")

    def test_template_deletion_with_breakpoints(self):
        ast = self.parser.parse("46,XX,del(5)(q13q33)")
        abn = ast.abnormalities[0]
        result = generate_template_explanation(abn)
        self.assertEqual(result.summary, "Deletion on chromosome 5 at q13, q33.")
        self.assertEqual(result.confidence, "template")

    def test_curated_trisomy_21(self):
        ast = self.parser.parse("47,XY,+21")
        result = lookup_curated_explanation(ast)
        self.assertIsNotNone(result)
        self.assertEqual(result.confidence, "curated")
        self.assertIn("Down syndrome", result.summary)

    def test_curated_philadelphia(self):
        ast = self.parser.parse("46,XX,t(9;22)(q34;q11.2)")
        abn = ast.abnormalities[0]
        result = lookup_curated_explanation(abn)
        self.assertIsNotNone(result)
        self.assertEqual(result.confidence, "curated")
        self.assertIn("Philadelphia chromosome", result.summary)

    def test_explain_fallback(self):
        # NOT in curated JSON
        ast = self.parser.parse("46,XX,del(7)(q22q36)")
        abn = ast.abnormalities[0]
        result = explain(abn)
        self.assertEqual(result.confidence, "template")
        self.assertEqual(result.summary, "Deletion on chromosome 7 at q22, q36.")

if __name__ == "__main__":
    unittest.main()
