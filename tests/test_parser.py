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


class TestParserIsochromosomes(unittest.TestCase):
    def setUp(self):
        self.parser = KaryotypeParser()

    def test_parse_isochromosome_short_form(self):
        """Test i(17q) - short form with arm in parentheses."""
        result = self.parser.parse("46,XX,i(17q)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "i")
        self.assertEqual(abn.chromosome, "17")
        self.assertEqual(len(abn.breakpoints), 1)
        self.assertEqual(abn.breakpoints[0].arm, "q")

    def test_parse_isochromosome_long_form(self):
        """Test i(17)(q10) - long form with breakpoint."""
        result = self.parser.parse("46,XX,i(17)(q10)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "i")
        self.assertEqual(abn.chromosome, "17")
        self.assertEqual(len(abn.breakpoints), 1)
        self.assertEqual(abn.breakpoints[0].arm, "q")
        self.assertEqual(abn.breakpoints[0].region, 1)
        self.assertEqual(abn.breakpoints[0].band, 0)

    def test_parse_isochromosome_p_arm(self):
        """Test i(9p) - isochromosome of p arm."""
        result = self.parser.parse("46,XY,i(9p)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "i")
        self.assertEqual(abn.chromosome, "9")
        self.assertEqual(abn.breakpoints[0].arm, "p")

    def test_parse_isochromosome_x_chromosome(self):
        """Test i(Xq) - isochromosome of X chromosome q arm."""
        result = self.parser.parse("46,X,i(Xq)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "i")
        self.assertEqual(abn.chromosome, "X")
        self.assertEqual(abn.breakpoints[0].arm, "q")


class TestParserRingChromosomes(unittest.TestCase):
    def setUp(self):
        self.parser = KaryotypeParser()

    def test_parse_ring_simple(self):
        """Test r(1) - simple ring chromosome."""
        result = self.parser.parse("46,XX,r(1)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "r")
        self.assertEqual(abn.chromosome, "1")
        self.assertEqual(len(abn.breakpoints), 0)

    def test_parse_ring_with_breakpoints(self):
        """Test r(1)(p36q42) - ring with breakpoints."""
        result = self.parser.parse("46,XY,r(1)(p36q42)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "r")
        self.assertEqual(abn.chromosome, "1")
        self.assertEqual(len(abn.breakpoints), 2)
        self.assertEqual(abn.breakpoints[0].arm, "p")
        self.assertEqual(abn.breakpoints[0].region, 3)
        self.assertEqual(abn.breakpoints[0].band, 6)
        self.assertEqual(abn.breakpoints[1].arm, "q")
        self.assertEqual(abn.breakpoints[1].region, 4)
        self.assertEqual(abn.breakpoints[1].band, 2)

    def test_parse_ring_x_chromosome(self):
        """Test r(X) - ring X chromosome."""
        result = self.parser.parse("45,X,r(X)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "r")
        self.assertEqual(abn.chromosome, "X")


class TestParserMarkerChromosomes(unittest.TestCase):
    def setUp(self):
        self.parser = KaryotypeParser()

    def test_parse_marker_single(self):
        """Test +mar - single marker chromosome."""
        result = self.parser.parse("47,XX,+mar")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "+mar")
        self.assertEqual(abn.chromosome, "mar")

    def test_parse_marker_multiple(self):
        """Test +2mar - two marker chromosomes."""
        result = self.parser.parse("48,XY,+2mar")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "+mar")
        self.assertEqual(abn.copy_count, 2)

    def test_parse_marker_numbered(self):
        """Test +mar1 - numbered marker."""
        result = self.parser.parse("47,XX,+mar1")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "+mar")
        self.assertEqual(abn.chromosome, "mar1")


class TestParserDerivativeChromosomes(unittest.TestCase):
    def setUp(self):
        self.parser = KaryotypeParser()

    def test_parse_derivative_translocation(self):
        """Test der(22)t(9;22)(q34;q11.2) - Philadelphia chromosome."""
        result = self.parser.parse("46,XX,der(22)t(9;22)(q34;q11.2)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "der")
        self.assertEqual(abn.chromosome, "22")
        self.assertIn("t(9;22)", abn.raw)

    def test_parse_derivative_deletion(self):
        """Test der(1)del(1)(p31) - derivative from deletion."""
        result = self.parser.parse("46,XY,der(1)del(1)(p31)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "der")
        self.assertEqual(abn.chromosome, "1")
        self.assertIn("del(1)", abn.raw)

    def test_parse_derivative_sex_chromosome(self):
        """Test der(X) - derivative X chromosome."""
        result = self.parser.parse("46,X,der(X)t(X;8)(p22;q24)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "der")
        self.assertEqual(abn.chromosome, "X")


class TestParserDoubleMinutesAndHSR(unittest.TestCase):
    def setUp(self):
        self.parser = KaryotypeParser()

    def test_parse_dmin(self):
        """Test dmin - double minutes."""
        result = self.parser.parse("47,XX,+21,dmin")
        # Find dmin abnormality
        dmin_abn = [a for a in result.abnormalities if a.type == "dmin"][0]
        self.assertEqual(dmin_abn.type, "dmin")

    def test_parse_hsr(self):
        """Test hsr - homogeneously staining region."""
        result = self.parser.parse("46,XX,hsr")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "hsr")

    def test_parse_hsr_with_location(self):
        """Test hsr(1)(p22) - HSR at specific location."""
        result = self.parser.parse("46,XY,hsr(1)(p22)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "hsr")
        self.assertEqual(abn.chromosome, "1")
        self.assertEqual(len(abn.breakpoints), 1)
        self.assertEqual(abn.breakpoints[0].arm, "p")


class TestParserMosaicism(unittest.TestCase):
    def setUp(self):
        self.parser = KaryotypeParser()

    def test_parse_mosaic_two_cell_lines(self):
        """Test 47,XX,+21[10]/46,XX[20] - mosaic with counts."""
        result = self.parser.parse("47,XX,+21[10]/46,XX[20]")
        self.assertIsNotNone(result.cell_lines)
        self.assertEqual(len(result.cell_lines), 2)
        # First cell line: 47,XX,+21[10]
        self.assertEqual(result.cell_lines[0].chromosome_count, 47)
        self.assertEqual(result.cell_lines[0].sex_chromosomes, "XX")
        self.assertEqual(len(result.cell_lines[0].abnormalities), 1)
        self.assertEqual(result.cell_lines[0].count, 10)
        # Second cell line: 46,XX[20]
        self.assertEqual(result.cell_lines[1].chromosome_count, 46)
        self.assertEqual(result.cell_lines[1].sex_chromosomes, "XX")
        self.assertEqual(result.cell_lines[1].abnormalities, [])
        self.assertEqual(result.cell_lines[1].count, 20)

    def test_parse_mosaic_without_counts(self):
        """Test 47,XX,+21/46,XX - mosaic without cell counts."""
        result = self.parser.parse("47,XX,+21/46,XX")
        self.assertIsNotNone(result.cell_lines)
        self.assertEqual(len(result.cell_lines), 2)
        self.assertEqual(result.cell_lines[0].count, 0)  # No count specified
        self.assertEqual(result.cell_lines[1].count, 0)

    def test_parse_mosaic_three_lines(self):
        """Test mosaic with three cell lines."""
        result = self.parser.parse("47,XX,+21[5]/46,XX,del(5)(q13)[10]/46,XX[15]")
        self.assertIsNotNone(result.cell_lines)
        self.assertEqual(len(result.cell_lines), 3)
        self.assertEqual(result.cell_lines[0].count, 5)
        self.assertEqual(result.cell_lines[1].count, 10)
        self.assertEqual(result.cell_lines[2].count, 15)
        # Second line has deletion
        self.assertEqual(len(result.cell_lines[1].abnormalities), 1)
        self.assertEqual(result.cell_lines[1].abnormalities[0].type, "del")


class TestParserUncertainty(unittest.TestCase):
    def setUp(self):
        self.parser = KaryotypeParser()

    def test_parse_uncertain_numerical(self):
        """Test ?+21 - uncertain trisomy."""
        result = self.parser.parse("47,XX,?+21")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "+")
        self.assertEqual(abn.chromosome, "21")
        self.assertTrue(abn.uncertain)

    def test_parse_uncertain_deletion(self):
        """Test ?del(5)(q13) - uncertain deletion."""
        result = self.parser.parse("46,XX,?del(5)(q13)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "del")
        self.assertTrue(abn.uncertain)

    def test_parse_uncertain_translocation(self):
        """Test ?t(9;22)(q34;q11) - uncertain translocation."""
        result = self.parser.parse("46,XX,?t(9;22)(q34;q11)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.type, "t")
        self.assertTrue(abn.uncertain)

    def test_parse_certain_abnormality(self):
        """Test del(5)(q13) - certain deletion (no ?)."""
        result = self.parser.parse("46,XX,del(5)(q13)")
        abn = result.abnormalities[0]
        self.assertFalse(abn.uncertain)


if __name__ == '__main__':
    unittest.main()
