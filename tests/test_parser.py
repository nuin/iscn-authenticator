# tests/test_parser.py
import unittest
from iscn_authenticator.parser import KaryotypeParser, ParseError


class TestKaryotypeParserBasic(unittest.TestCase):
    def setUp(self):
        self.parser = KaryotypeParser()

    def test_parse_normal_female(self):
        result = self.parser.parse("46,XX")
        self.assertEqual(result.chromosome_count, 46)
        self.assertEqual(result.sex_chromosomes, "XX")
        self.assertEqual(result.abnormalities, [])

    def test_parse_normal_male(self):
        result = self.parser.parse("46,XY")
        self.assertEqual(result.chromosome_count, 46)
        self.assertEqual(result.sex_chromosomes, "XY")

    def test_parse_turner_syndrome(self):
        result = self.parser.parse("45,X")
        self.assertEqual(result.chromosome_count, 45)
        self.assertEqual(result.sex_chromosomes, "X")

    def test_parse_klinefelter(self):
        result = self.parser.parse("47,XXY")
        self.assertEqual(result.chromosome_count, 47)
        self.assertEqual(result.sex_chromosomes, "XXY")

    def test_parse_triple_x(self):
        result = self.parser.parse("47,XXX")
        self.assertEqual(result.chromosome_count, 47)
        self.assertEqual(result.sex_chromosomes, "XXX")

    def test_parse_xyy(self):
        result = self.parser.parse("47,XYY")
        self.assertEqual(result.chromosome_count, 47)
        self.assertEqual(result.sex_chromosomes, "XYY")

    def test_parse_undisclosed_sex(self):
        result = self.parser.parse("46,U")
        self.assertEqual(result.chromosome_count, 46)
        self.assertEqual(result.sex_chromosomes, "U")

    def test_parse_empty_string_raises(self):
        with self.assertRaises(ParseError) as ctx:
            self.parser.parse("")
        self.assertIn("empty", str(ctx.exception).lower())

    def test_parse_missing_comma_raises(self):
        with self.assertRaises(ParseError) as ctx:
            self.parser.parse("46XX")
        self.assertIn("comma", str(ctx.exception).lower())

    def test_parse_invalid_count_raises(self):
        with self.assertRaises(ParseError) as ctx:
            self.parser.parse("foo,XX")
        self.assertIn("chromosome count", str(ctx.exception).lower())

    def test_parse_whitespace_handling(self):
        result = self.parser.parse("  46 , XX  ")
        self.assertEqual(result.chromosome_count, 46)
        self.assertEqual(result.sex_chromosomes, "XX")

    def test_parse_range_notation(self):
        result = self.parser.parse("45~48,XX")
        self.assertEqual(result.chromosome_count, "45~48")
        self.assertEqual(result.sex_chromosomes, "XX")


class TestParserNumericalAbnormalities(unittest.TestCase):
    def setUp(self):
        self.parser = KaryotypeParser()

    def test_parse_trisomy_21(self):
        result = self.parser.parse("47,XX,+21")
        self.assertEqual(len(result.abnormalities), 1)
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "+")
        self.assertEqual(abn.chromosome, "21")

    def test_parse_monosomy_7(self):
        result = self.parser.parse("45,XY,-7")
        self.assertEqual(len(result.abnormalities), 1)
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "-")
        self.assertEqual(abn.chromosome, "7")

    def test_parse_multiple_numerical(self):
        result = self.parser.parse("48,XY,+18,+21")
        self.assertEqual(len(result.abnormalities), 2)
        self.assertEqual(result.abnormalities[0].chromosome, "18")
        self.assertEqual(result.abnormalities[1].chromosome, "21")

    def test_parse_sex_chromosome_gain(self):
        result = self.parser.parse("48,XXXY,+X")
        self.assertEqual(len(result.abnormalities), 1)
        self.assertEqual(result.abnormalities[0].chromosome, "X")

    def test_parse_sex_chromosome_loss(self):
        result = self.parser.parse("45,XY,-Y")
        self.assertEqual(len(result.abnormalities), 1)
        self.assertEqual(result.abnormalities[0].type, "-")
        self.assertEqual(result.abnormalities[0].chromosome, "Y")


if __name__ == '__main__':
    unittest.main()
