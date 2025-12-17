# tests/test_rules_abnormality.py
import unittest
from iscn_authenticator.rules.abnormality import (
    numerical_chromosome_valid_rule,
    breakpoint_arm_valid_rule,
    inversion_two_breakpoints_rule,
    translocation_breakpoint_count_rule,
)
from iscn_authenticator.models import KaryotypeAST, Abnormality, Breakpoint


class TestNumericalChromosomeRule(unittest.TestCase):
    def test_valid_autosome_gain(self):
        abn = Abnormality("+", "21", [], None, False, None, "+21")
        ast = KaryotypeAST(47, "XX", [abn], None, None)
        errors = numerical_chromosome_valid_rule.validate(ast, abn)
        self.assertEqual(errors, [])

    def test_valid_autosome_loss(self):
        abn = Abnormality("-", "7", [], None, False, None, "-7")
        ast = KaryotypeAST(45, "XY", [abn], None, None)
        errors = numerical_chromosome_valid_rule.validate(ast, abn)
        self.assertEqual(errors, [])

    def test_valid_sex_chromosome_x(self):
        abn = Abnormality("+", "X", [], None, False, None, "+X")
        ast = KaryotypeAST(47, "XXX", [abn], None, None)
        errors = numerical_chromosome_valid_rule.validate(ast, abn)
        self.assertEqual(errors, [])

    def test_valid_sex_chromosome_y(self):
        abn = Abnormality("-", "Y", [], None, False, None, "-Y")
        ast = KaryotypeAST(45, "X", [abn], None, None)
        errors = numerical_chromosome_valid_rule.validate(ast, abn)
        self.assertEqual(errors, [])

    def test_invalid_chromosome_0(self):
        abn = Abnormality("+", "0", [], None, False, None, "+0")
        ast = KaryotypeAST(47, "XX", [abn], None, None)
        errors = numerical_chromosome_valid_rule.validate(ast, abn)
        self.assertIn("Invalid chromosome", errors[0])

    def test_invalid_chromosome_23(self):
        abn = Abnormality("+", "23", [], None, False, None, "+23")
        ast = KaryotypeAST(47, "XX", [abn], None, None)
        errors = numerical_chromosome_valid_rule.validate(ast, abn)
        self.assertIn("Invalid chromosome", errors[0])

    def test_invalid_chromosome_99(self):
        abn = Abnormality("+", "99", [], None, False, None, "+99")
        ast = KaryotypeAST(47, "XX", [abn], None, None)
        errors = numerical_chromosome_valid_rule.validate(ast, abn)
        self.assertIn("Invalid chromosome", errors[0])

    def test_skips_non_numerical(self):
        abn = Abnormality("del", "5", [], None, False, None, "del(5)(q13)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = numerical_chromosome_valid_rule.validate(ast, abn)
        self.assertEqual(errors, [])


class TestBreakpointArmRule(unittest.TestCase):
    def test_valid_p_arm(self):
        bp = Breakpoint("p", 1, 3, None, False)
        abn = Abnormality("del", "5", [bp], None, False, None, "del(5)(p13)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = breakpoint_arm_valid_rule.validate(ast, abn)
        self.assertEqual(errors, [])

    def test_valid_q_arm(self):
        bp = Breakpoint("q", 2, 1, None, False)
        abn = Abnormality("del", "5", [bp], None, False, None, "del(5)(q21)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = breakpoint_arm_valid_rule.validate(ast, abn)
        self.assertEqual(errors, [])

    def test_skips_numerical_abnormality(self):
        abn = Abnormality("+", "21", [], None, False, None, "+21")
        ast = KaryotypeAST(47, "XX", [abn], None, None)
        errors = breakpoint_arm_valid_rule.validate(ast, abn)
        self.assertEqual(errors, [])


class TestInversionTwoBreakpointsRule(unittest.TestCase):
    def test_valid_two_breakpoints(self):
        bp1 = Breakpoint("p", 1, 2, None, False)
        bp2 = Breakpoint("q", 1, 3, None, False)
        abn = Abnormality("inv", "9", [bp1, bp2], None, False, None, "inv(9)(p12q13)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = inversion_two_breakpoints_rule.validate(ast, abn)
        self.assertEqual(errors, [])

    def test_invalid_one_breakpoint(self):
        bp1 = Breakpoint("p", 1, 2, None, False)
        abn = Abnormality("inv", "9", [bp1], None, False, None, "inv(9)(p12)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = inversion_two_breakpoints_rule.validate(ast, abn)
        self.assertIn("two breakpoints", errors[0].lower())

    def test_invalid_three_breakpoints(self):
        bp1 = Breakpoint("p", 1, 2, None, False)
        bp2 = Breakpoint("q", 1, 3, None, False)
        bp3 = Breakpoint("q", 2, 1, None, False)
        abn = Abnormality("inv", "9", [bp1, bp2, bp3], None, False, None, "inv(9)(p12q13q21)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = inversion_two_breakpoints_rule.validate(ast, abn)
        self.assertIn("two breakpoints", errors[0].lower())

    def test_skips_non_inversion(self):
        bp1 = Breakpoint("q", 1, 3, None, False)
        abn = Abnormality("del", "5", [bp1], None, False, None, "del(5)(q13)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = inversion_two_breakpoints_rule.validate(ast, abn)
        self.assertEqual(errors, [])


class TestDeletionBreakpointRule(unittest.TestCase):
    def test_valid_terminal_deletion_one_breakpoint(self):
        """Terminal deletion has one breakpoint."""
        from iscn_authenticator.rules.abnormality import deletion_breakpoint_rule
        bp1 = Breakpoint("q", 1, 3, None, False)
        abn = Abnormality("del", "5", [bp1], None, False, None, "del(5)(q13)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = deletion_breakpoint_rule.validate(ast, abn)
        self.assertEqual(errors, [])

    def test_valid_interstitial_deletion_two_breakpoints_same_arm(self):
        """Interstitial deletion has two breakpoints on same arm."""
        from iscn_authenticator.rules.abnormality import deletion_breakpoint_rule
        bp1 = Breakpoint("q", 1, 3, None, False)
        bp2 = Breakpoint("q", 3, 3, None, False)
        abn = Abnormality("del", "5", [bp1, bp2], None, False, None, "del(5)(q13q33)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = deletion_breakpoint_rule.validate(ast, abn)
        self.assertEqual(errors, [])

    def test_invalid_interstitial_deletion_different_arms(self):
        """Interstitial deletion cannot have breakpoints on different arms."""
        from iscn_authenticator.rules.abnormality import deletion_breakpoint_rule
        bp1 = Breakpoint("p", 1, 2, None, False)
        bp2 = Breakpoint("q", 1, 3, None, False)
        abn = Abnormality("del", "5", [bp1, bp2], None, False, None, "del(5)(p12q13)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = deletion_breakpoint_rule.validate(ast, abn)
        self.assertIn("same arm", errors[0].lower())

    def test_invalid_deletion_three_breakpoints(self):
        """Deletion cannot have three breakpoints."""
        from iscn_authenticator.rules.abnormality import deletion_breakpoint_rule
        bp1 = Breakpoint("q", 1, 3, None, False)
        bp2 = Breakpoint("q", 2, 1, None, False)
        bp3 = Breakpoint("q", 3, 3, None, False)
        abn = Abnormality("del", "5", [bp1, bp2, bp3], None, False, None, "del(5)(q13q21q33)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = deletion_breakpoint_rule.validate(ast, abn)
        self.assertIn("one or two breakpoints", errors[0].lower())

    def test_skips_non_deletion(self):
        """Rule only applies to deletions."""
        from iscn_authenticator.rules.abnormality import deletion_breakpoint_rule
        bp1 = Breakpoint("q", 1, 3, None, False)
        bp2 = Breakpoint("q", 3, 3, None, False)
        abn = Abnormality("dup", "5", [bp1, bp2], None, False, None, "dup(5)(q13q33)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = deletion_breakpoint_rule.validate(ast, abn)
        self.assertEqual(errors, [])


class TestTranslocationBreakpointCountRule(unittest.TestCase):
    def test_valid_two_chromosome_two_breakpoint(self):
        bp1 = Breakpoint("q", 3, 4, None, False)
        bp2 = Breakpoint("q", 1, 1, "2", False)
        abn = Abnormality("t", "9;22", [bp1, bp2], None, False, None, "t(9;22)(q34;q11.2)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = translocation_breakpoint_count_rule.validate(ast, abn)
        self.assertEqual(errors, [])

    def test_valid_three_chromosome_three_breakpoint(self):
        bp1 = Breakpoint("p", 3, 2, None, False)
        bp2 = Breakpoint("q", 2, 1, None, False)
        bp3 = Breakpoint("q", 3, 1, None, False)
        abn = Abnormality("t", "1;3;5", [bp1, bp2, bp3], None, False, None, "t(1;3;5)(p32;q21;q31)")
        ast = KaryotypeAST(46, "XY", [abn], None, None)
        errors = translocation_breakpoint_count_rule.validate(ast, abn)
        self.assertEqual(errors, [])

    def test_invalid_two_chromosomes_one_breakpoint(self):
        bp1 = Breakpoint("q", 3, 4, None, False)
        abn = Abnormality("t", "9;22", [bp1], None, False, None, "t(9;22)(q34)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = translocation_breakpoint_count_rule.validate(ast, abn)
        self.assertIn("breakpoints", errors[0].lower())

    def test_invalid_three_chromosomes_two_breakpoints(self):
        bp1 = Breakpoint("p", 3, 2, None, False)
        bp2 = Breakpoint("q", 2, 1, None, False)
        abn = Abnormality("t", "1;3;5", [bp1, bp2], None, False, None, "t(1;3;5)(p32;q21)")
        ast = KaryotypeAST(46, "XY", [abn], None, None)
        errors = translocation_breakpoint_count_rule.validate(ast, abn)
        self.assertIn("breakpoints", errors[0].lower())

    def test_skips_non_translocation(self):
        bp1 = Breakpoint("p", 1, 2, None, False)
        bp2 = Breakpoint("q", 1, 3, None, False)
        abn = Abnormality("inv", "9", [bp1, bp2], None, False, None, "inv(9)(p12q13)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = translocation_breakpoint_count_rule.validate(ast, abn)
        self.assertEqual(errors, [])


class TestDuplicationBreakpointRule(unittest.TestCase):
    def test_valid_tandem_duplication_one_breakpoint(self):
        """Tandem duplication has one breakpoint."""
        from iscn_authenticator.rules.abnormality import duplication_breakpoint_rule
        bp1 = Breakpoint("q", 2, 1, None, False)
        abn = Abnormality("dup", "1", [bp1], None, False, None, "dup(1)(q21)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = duplication_breakpoint_rule.validate(ast, abn)
        self.assertEqual(errors, [])

    def test_valid_duplication_two_breakpoints_same_arm(self):
        """Duplication with two breakpoints on same arm."""
        from iscn_authenticator.rules.abnormality import duplication_breakpoint_rule
        bp1 = Breakpoint("q", 2, 1, None, False)
        bp2 = Breakpoint("q", 3, 1, None, False)
        abn = Abnormality("dup", "1", [bp1, bp2], None, False, None, "dup(1)(q21q31)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = duplication_breakpoint_rule.validate(ast, abn)
        self.assertEqual(errors, [])

    def test_invalid_duplication_different_arms(self):
        """Duplication cannot have breakpoints on different arms."""
        from iscn_authenticator.rules.abnormality import duplication_breakpoint_rule
        bp1 = Breakpoint("p", 1, 2, None, False)
        bp2 = Breakpoint("q", 2, 1, None, False)
        abn = Abnormality("dup", "1", [bp1, bp2], None, False, None, "dup(1)(p12q21)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = duplication_breakpoint_rule.validate(ast, abn)
        self.assertIn("same arm", errors[0].lower())

    def test_invalid_duplication_three_breakpoints(self):
        """Duplication cannot have three breakpoints."""
        from iscn_authenticator.rules.abnormality import duplication_breakpoint_rule
        bp1 = Breakpoint("q", 2, 1, None, False)
        bp2 = Breakpoint("q", 2, 5, None, False)
        bp3 = Breakpoint("q", 3, 1, None, False)
        abn = Abnormality("dup", "1", [bp1, bp2, bp3], None, False, None, "dup(1)(q21q25q31)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = duplication_breakpoint_rule.validate(ast, abn)
        self.assertIn("one or two breakpoints", errors[0].lower())

    def test_skips_non_duplication(self):
        """Rule only applies to duplications."""
        from iscn_authenticator.rules.abnormality import duplication_breakpoint_rule
        bp1 = Breakpoint("q", 1, 3, None, False)
        bp2 = Breakpoint("q", 3, 3, None, False)
        abn = Abnormality("del", "5", [bp1, bp2], None, False, None, "del(5)(q13q33)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = duplication_breakpoint_rule.validate(ast, abn)
        self.assertEqual(errors, [])


if __name__ == '__main__':
    unittest.main()
