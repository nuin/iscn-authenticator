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


class TestParserDeletions(unittest.TestCase):
    def setUp(self):
        self.parser = KaryotypeParser()

    def test_parse_terminal_deletion(self):
        result = self.parser.parse("46,XX,del(5)(q13)")
        self.assertEqual(len(result.abnormalities), 1)
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "del")
        self.assertEqual(abn.chromosome, "5")
        self.assertEqual(len(abn.breakpoints), 1)
        self.assertEqual(abn.breakpoints[0].arm, "q")
        self.assertEqual(abn.breakpoints[0].region, 1)
        self.assertEqual(abn.breakpoints[0].band, 3)

    def test_parse_interstitial_deletion(self):
        result = self.parser.parse("46,XX,del(5)(q13q33)")
        self.assertEqual(len(result.abnormalities), 1)
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "del")
        self.assertEqual(len(abn.breakpoints), 2)
        self.assertEqual(abn.breakpoints[0].arm, "q")
        self.assertEqual(abn.breakpoints[1].arm, "q")
        self.assertEqual(abn.breakpoints[1].region, 3)
        self.assertEqual(abn.breakpoints[1].band, 3)

    def test_parse_deletion_with_subband(self):
        result = self.parser.parse("46,XY,del(7)(p11.2)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.breakpoints[0].subband, "2")
        self.assertEqual(abn.breakpoints[0].region, 1)
        self.assertEqual(abn.breakpoints[0].band, 1)

    def test_parse_deletion_x_chromosome(self):
        result = self.parser.parse("46,X,del(X)(p22)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.chromosome, "X")
        self.assertEqual(abn.breakpoints[0].arm, "p")
        self.assertEqual(abn.breakpoints[0].region, 2)
        self.assertEqual(abn.breakpoints[0].band, 2)

    def test_parse_deletion_p_arm(self):
        result = self.parser.parse("46,XY,del(1)(p36)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.breakpoints[0].arm, "p")
        self.assertEqual(abn.breakpoints[0].region, 3)
        self.assertEqual(abn.breakpoints[0].band, 6)


class TestParserDuplications(unittest.TestCase):
    def setUp(self):
        self.parser = KaryotypeParser()

    def test_parse_duplication(self):
        result = self.parser.parse("46,XX,dup(1)(p31p22)")
        self.assertEqual(len(result.abnormalities), 1)
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "dup")
        self.assertEqual(abn.chromosome, "1")
        self.assertEqual(len(abn.breakpoints), 2)

    def test_parse_tandem_duplication(self):
        result = self.parser.parse("46,XY,dup(7)(q11.2q22)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.breakpoints[0].arm, "q")
        self.assertEqual(abn.breakpoints[1].arm, "q")
        self.assertEqual(abn.breakpoints[0].subband, "2")

    def test_parse_single_breakpoint_duplication(self):
        result = self.parser.parse("46,XX,dup(3)(q21)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "dup")
        self.assertEqual(len(abn.breakpoints), 1)
        self.assertEqual(abn.breakpoints[0].arm, "q")


class TestParserInversions(unittest.TestCase):
    def setUp(self):
        self.parser = KaryotypeParser()

    def test_parse_pericentric_inversion(self):
        result = self.parser.parse("46,XX,inv(9)(p12q13)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "inv")
        self.assertEqual(abn.chromosome, "9")
        self.assertEqual(len(abn.breakpoints), 2)
        self.assertEqual(abn.breakpoints[0].arm, "p")
        self.assertEqual(abn.breakpoints[1].arm, "q")

    def test_parse_paracentric_inversion(self):
        result = self.parser.parse("46,XY,inv(3)(q21q26)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.breakpoints[0].arm, "q")
        self.assertEqual(abn.breakpoints[1].arm, "q")
        self.assertEqual(abn.breakpoints[0].region, 2)
        self.assertEqual(abn.breakpoints[0].band, 1)
        self.assertEqual(abn.breakpoints[1].region, 2)
        self.assertEqual(abn.breakpoints[1].band, 6)

    def test_parse_inversion_with_subband(self):
        result = self.parser.parse("46,XY,inv(2)(p11.2q13)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.breakpoints[0].subband, "2")


class TestParserTranslocations(unittest.TestCase):
    def setUp(self):
        self.parser = KaryotypeParser()

    def test_parse_reciprocal_translocation(self):
        result = self.parser.parse("46,XX,t(9;22)(q34;q11.2)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "t")
        self.assertEqual(abn.chromosome, "9;22")
        self.assertEqual(len(abn.breakpoints), 2)
        self.assertEqual(abn.breakpoints[0].arm, "q")
        self.assertEqual(abn.breakpoints[1].arm, "q")
        self.assertEqual(abn.breakpoints[1].subband, "2")

    def test_parse_three_way_translocation(self):
        result = self.parser.parse("46,XY,t(1;3;5)(p32;q21;q31)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.chromosome, "1;3;5")
        self.assertEqual(len(abn.breakpoints), 3)
        self.assertEqual(abn.breakpoints[0].arm, "p")
        self.assertEqual(abn.breakpoints[1].arm, "q")
        self.assertEqual(abn.breakpoints[2].arm, "q")

    def test_parse_translocation_sex_chromosome(self):
        result = self.parser.parse("46,X,t(X;18)(p11.2;q21)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.chromosome, "X;18")
        self.assertEqual(len(abn.breakpoints), 2)


if __name__ == '__main__':
    unittest.main()
