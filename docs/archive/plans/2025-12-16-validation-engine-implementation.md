# ISCN Validation Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a comprehensive rule-based validation engine for ISCN karyotype strings with structured error messages.

**Architecture:** Three-layer design with Parser (tokenizes to AST), Rule Engine (applies rules), and Rules (data-driven validators). Maintains backward compatibility via `is_valid_karyotype()` while exposing new `validate_karyotype()` API.

**Tech Stack:** Python 3.10+, dataclasses, re module, unittest

---

## Phase 1: Foundation

### Task 1: Create Data Models

**Files:**
- Create: `iscn_authenticator/models.py`
- Test: `tests/test_models.py`

**Step 1: Write the test for ValidationResult**

```python
# tests/test_models.py
import unittest
from iscn_authenticator.models import ValidationResult, KaryotypeAST, Breakpoint, Abnormality

class TestValidationResult(unittest.TestCase):
    def test_valid_result(self):
        result = ValidationResult(valid=True, errors=[], parsed=None)
        self.assertTrue(result.valid)
        self.assertEqual(result.errors, [])

    def test_invalid_result_with_errors(self):
        result = ValidationResult(valid=False, errors=["Invalid chromosome count"], parsed=None)
        self.assertFalse(result.valid)
        self.assertEqual(result.errors, ["Invalid chromosome count"])

class TestBreakpoint(unittest.TestCase):
    def test_breakpoint_basic(self):
        bp = Breakpoint(arm="q", region=13, band=3, subband=None, uncertain=False)
        self.assertEqual(bp.arm, "q")
        self.assertEqual(bp.region, 13)
        self.assertEqual(bp.band, 3)

    def test_breakpoint_with_subband(self):
        bp = Breakpoint(arm="p", region=11, band=2, subband="1", uncertain=False)
        self.assertEqual(bp.subband, "1")

class TestAbnormality(unittest.TestCase):
    def test_numerical_abnormality(self):
        abn = Abnormality(
            type="+",
            chromosome="21",
            breakpoints=[],
            inheritance=None,
            uncertain=False,
            copy_count=None,
            raw="+21"
        )
        self.assertEqual(abn.type, "+")
        self.assertEqual(abn.chromosome, "21")

class TestKaryotypeAST(unittest.TestCase):
    def test_simple_karyotype(self):
        ast = KaryotypeAST(
            chromosome_count=46,
            sex_chromosomes="XX",
            abnormalities=[],
            cell_lines=None,
            modifiers=None
        )
        self.assertEqual(ast.chromosome_count, 46)
        self.assertEqual(ast.sex_chromosomes, "XX")

if __name__ == '__main__':
    unittest.main()
```

**Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests/test_models.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'iscn_authenticator.models'"

**Step 3: Write minimal implementation**

```python
# iscn_authenticator/models.py
from dataclasses import dataclass
from typing import Optional

@dataclass
class Breakpoint:
    """Represents a chromosomal breakpoint like p11.2 or q34."""
    arm: str                         # "p", "q", "cen", "ter"
    region: Optional[int]
    band: Optional[int]
    subband: Optional[str]           # "1", "11", etc.
    uncertain: bool                  # Has ? in designation

@dataclass
class Abnormality:
    """Represents a chromosomal abnormality."""
    type: str                        # "+", "-", "del", "dup", "inv", "t", etc.
    chromosome: str                  # "5" or "9;22" for translocations
    breakpoints: list[Breakpoint]
    inheritance: Optional[str]       # "mat", "pat", "dn", etc.
    uncertain: bool                  # Has ? marker
    copy_count: Optional[int]        # For x2, x3 notation
    raw: str                         # Original string

@dataclass
class Modifiers:
    """Karyotype-level modifiers."""
    mosaic: bool = False             # mos
    chimera: bool = False            # chi
    constitutional: bool = False     # c suffix
    incomplete: bool = False         # inc

@dataclass
class CellLine:
    """Represents a cell line in mosaic/chimera notation."""
    chromosome_count: int
    sex_chromosomes: str
    abnormalities: list[Abnormality]
    count: int                       # Number in brackets [10]
    is_donor: bool = False           # For chimera: after //

@dataclass
class KaryotypeAST:
    """Abstract syntax tree for a parsed karyotype."""
    chromosome_count: int | str      # int or range "45~48"
    sex_chromosomes: str             # "XX", "XY", "X", etc.
    abnormalities: list[Abnormality]
    cell_lines: Optional[list[CellLine]]
    modifiers: Optional[Modifiers]

@dataclass
class ValidationResult:
    """Result of karyotype validation."""
    valid: bool
    errors: list[str]
    parsed: Optional[KaryotypeAST]
```

**Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests/test_models.py -v`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add iscn_authenticator/models.py tests/test_models.py
git commit -m "feat: add data models for karyotype AST and validation result"
```

---

### Task 2: Create Rule Base Class

**Files:**
- Create: `iscn_authenticator/rules/__init__.py`
- Create: `iscn_authenticator/rules/base.py`
- Test: `tests/test_rules_base.py`

**Step 1: Write the test**

```python
# tests/test_rules_base.py
import unittest
from iscn_authenticator.rules.base import Rule
from iscn_authenticator.models import KaryotypeAST

class TestRule(unittest.TestCase):
    def test_rule_creation(self):
        def validator(value, ast):
            return [] if value == 46 else ["Invalid count"]

        rule = Rule(
            id="CHR_COUNT_46",
            category="chromosome_count",
            description="Chromosome count must be 46",
            validate=validator
        )
        self.assertEqual(rule.id, "CHR_COUNT_46")
        self.assertEqual(rule.category, "chromosome_count")

    def test_rule_validate_pass(self):
        def validator(value, ast):
            return [] if value == 46 else ["Invalid count"]

        rule = Rule(
            id="CHR_COUNT_46",
            category="chromosome_count",
            description="Test rule",
            validate=validator
        )
        errors = rule.validate(46, None)
        self.assertEqual(errors, [])

    def test_rule_validate_fail(self):
        def validator(value, ast):
            return [] if value == 46 else [f"Expected 46, got {value}"]

        rule = Rule(
            id="CHR_COUNT_46",
            category="chromosome_count",
            description="Test rule",
            validate=validator
        )
        errors = rule.validate(45, None)
        self.assertEqual(errors, ["Expected 46, got 45"])

if __name__ == '__main__':
    unittest.main()
```

**Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests/test_rules_base.py -v`
Expected: FAIL with "ModuleNotFoundError"

**Step 3: Write minimal implementation**

```python
# iscn_authenticator/rules/__init__.py
from .base import Rule

__all__ = ['Rule']
```

```python
# iscn_authenticator/rules/base.py
from dataclasses import dataclass
from typing import Callable, Any, Optional
from iscn_authenticator.models import KaryotypeAST

@dataclass
class Rule:
    """A validation rule for karyotype components."""
    id: str
    category: str
    description: str
    validate: Callable[[Any, Optional[KaryotypeAST]], list[str]]
```

**Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests/test_rules_base.py -v`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add iscn_authenticator/rules/
git add tests/test_rules_base.py
git commit -m "feat: add Rule base class for validation rules"
```

---

### Task 3: Create Rule Engine

**Files:**
- Create: `iscn_authenticator/engine.py`
- Test: `tests/test_engine.py`

**Step 1: Write the test**

```python
# tests/test_engine.py
import unittest
from iscn_authenticator.engine import RuleEngine
from iscn_authenticator.rules.base import Rule
from iscn_authenticator.models import KaryotypeAST, ValidationResult

class TestRuleEngine(unittest.TestCase):
    def test_engine_no_rules(self):
        engine = RuleEngine()
        ast = KaryotypeAST(
            chromosome_count=46,
            sex_chromosomes="XX",
            abnormalities=[],
            cell_lines=None,
            modifiers=None
        )
        result = engine.validate(ast)
        self.assertTrue(result.valid)
        self.assertEqual(result.errors, [])

    def test_engine_with_passing_rule(self):
        engine = RuleEngine()
        engine.add_rule(Rule(
            id="TEST_PASS",
            category="test",
            description="Always passes",
            validate=lambda v, ast: []
        ))
        ast = KaryotypeAST(
            chromosome_count=46,
            sex_chromosomes="XX",
            abnormalities=[],
            cell_lines=None,
            modifiers=None
        )
        result = engine.validate(ast)
        self.assertTrue(result.valid)

    def test_engine_with_failing_rule(self):
        engine = RuleEngine()
        engine.add_rule(Rule(
            id="TEST_FAIL",
            category="test",
            description="Always fails",
            validate=lambda v, ast: ["Test error"]
        ))
        ast = KaryotypeAST(
            chromosome_count=46,
            sex_chromosomes="XX",
            abnormalities=[],
            cell_lines=None,
            modifiers=None
        )
        result = engine.validate(ast)
        self.assertFalse(result.valid)
        self.assertIn("Test error", result.errors)

    def test_engine_collects_all_errors(self):
        engine = RuleEngine()
        engine.add_rule(Rule(
            id="FAIL_1",
            category="test",
            description="Fails with error 1",
            validate=lambda v, ast: ["Error 1"]
        ))
        engine.add_rule(Rule(
            id="FAIL_2",
            category="test",
            description="Fails with error 2",
            validate=lambda v, ast: ["Error 2"]
        ))
        ast = KaryotypeAST(
            chromosome_count=46,
            sex_chromosomes="XX",
            abnormalities=[],
            cell_lines=None,
            modifiers=None
        )
        result = engine.validate(ast)
        self.assertFalse(result.valid)
        self.assertEqual(len(result.errors), 2)
        self.assertIn("Error 1", result.errors)
        self.assertIn("Error 2", result.errors)

if __name__ == '__main__':
    unittest.main()
```

**Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests/test_engine.py -v`
Expected: FAIL with "ModuleNotFoundError"

**Step 3: Write minimal implementation**

```python
# iscn_authenticator/engine.py
from typing import Optional
from iscn_authenticator.models import KaryotypeAST, ValidationResult
from iscn_authenticator.rules.base import Rule

class RuleEngine:
    """Applies validation rules to a karyotype AST."""

    def __init__(self):
        self._rules: list[Rule] = []

    def add_rule(self, rule: Rule) -> None:
        """Add a rule to the engine."""
        self._rules.append(rule)

    def add_rules(self, rules: list[Rule]) -> None:
        """Add multiple rules to the engine."""
        self._rules.extend(rules)

    def validate(self, ast: KaryotypeAST) -> ValidationResult:
        """Validate a karyotype AST against all rules."""
        all_errors: list[str] = []

        for rule in self._rules:
            errors = rule.validate(ast, ast)
            all_errors.extend(errors)

        return ValidationResult(
            valid=len(all_errors) == 0,
            errors=all_errors,
            parsed=ast
        )
```

**Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests/test_engine.py -v`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add iscn_authenticator/engine.py tests/test_engine.py
git commit -m "feat: add RuleEngine for applying validation rules"
```

---

### Task 4: Create Basic Parser (chromosome count and sex chromosomes)

**Files:**
- Create: `iscn_authenticator/parser.py`
- Test: `tests/test_parser.py`

**Step 1: Write the test**

```python
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

if __name__ == '__main__':
    unittest.main()
```

**Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests/test_parser.py -v`
Expected: FAIL with "ModuleNotFoundError"

**Step 3: Write minimal implementation**

```python
# iscn_authenticator/parser.py
import re
from typing import Optional
from iscn_authenticator.models import KaryotypeAST, Abnormality, Breakpoint, Modifiers, CellLine

class ParseError(Exception):
    """Raised when karyotype string cannot be parsed."""
    pass

class KaryotypeParser:
    """Parses ISCN karyotype strings into AST."""

    # Regex patterns
    SEX_CHROMOSOMES_PATTERN = re.compile(r'^[XYU]+$')

    def parse(self, karyotype: str) -> KaryotypeAST:
        """Parse a karyotype string into an AST."""
        if not karyotype or not karyotype.strip():
            raise ParseError("Karyotype string is empty")

        karyotype = karyotype.strip()

        # Split on comma
        if ',' not in karyotype:
            raise ParseError("Missing comma separator between chromosome count and sex chromosomes")

        parts = karyotype.split(',')

        # Parse chromosome count
        chromosome_count = self._parse_chromosome_count(parts[0])

        # Parse sex chromosomes
        sex_chromosomes = self._parse_sex_chromosomes(parts[1])

        # Parse abnormalities (if any)
        abnormalities = []
        if len(parts) > 2:
            abnormalities = self._parse_abnormalities(parts[2:])

        return KaryotypeAST(
            chromosome_count=chromosome_count,
            sex_chromosomes=sex_chromosomes,
            abnormalities=abnormalities,
            cell_lines=None,
            modifiers=None
        )

    def _parse_chromosome_count(self, count_str: str) -> int | str:
        """Parse chromosome count (number or range)."""
        count_str = count_str.strip()

        # Handle range notation (e.g., "45~48")
        if '~' in count_str:
            return count_str

        # Handle numeric count
        if not count_str.isdigit():
            raise ParseError(f"Invalid chromosome count: '{count_str}' is not a number")

        return int(count_str)

    def _parse_sex_chromosomes(self, sex_str: str) -> str:
        """Parse sex chromosome designation."""
        sex_str = sex_str.strip()

        if not self.SEX_CHROMOSOMES_PATTERN.match(sex_str):
            raise ParseError(f"Invalid sex chromosomes: '{sex_str}' must contain only X, Y, or U")

        return sex_str

    def _parse_abnormalities(self, parts: list[str]) -> list[Abnormality]:
        """Parse abnormality parts. Basic implementation for now."""
        abnormalities = []
        for part in parts:
            part = part.strip()
            if not part:
                continue
            # For now, create a basic abnormality - will be expanded in Phase 2
            abnormalities.append(Abnormality(
                type="unknown",
                chromosome="",
                breakpoints=[],
                inheritance=None,
                uncertain=False,
                copy_count=None,
                raw=part
            ))
        return abnormalities
```

**Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests/test_parser.py -v`
Expected: PASS (10 tests)

**Step 5: Commit**

```bash
git add iscn_authenticator/parser.py tests/test_parser.py
git commit -m "feat: add KaryotypeParser for basic karyotype parsing"
```

---

### Task 5: Create Chromosome Count and Sex Chromosome Rules

**Files:**
- Create: `iscn_authenticator/rules/chromosome.py`
- Test: `tests/test_rules_chromosome.py`

**Step 1: Write the test**

```python
# tests/test_rules_chromosome.py
import unittest
from iscn_authenticator.rules.chromosome import (
    chromosome_count_numeric_rule,
    chromosome_count_range_rule,
    sex_chromosomes_valid_rule,
    sex_chromosomes_coherence_rule,
)
from iscn_authenticator.models import KaryotypeAST

class TestChromosomeCountRules(unittest.TestCase):
    def test_numeric_count_valid(self):
        ast = KaryotypeAST(46, "XX", [], None, None)
        errors = chromosome_count_numeric_rule.validate(ast, ast)
        self.assertEqual(errors, [])

    def test_numeric_count_valid_45(self):
        ast = KaryotypeAST(45, "X", [], None, None)
        errors = chromosome_count_numeric_rule.validate(ast, ast)
        self.assertEqual(errors, [])

    def test_count_range_valid(self):
        ast = KaryotypeAST(46, "XX", [], None, None)
        errors = chromosome_count_range_rule.validate(ast, ast)
        self.assertEqual(errors, [])

    def test_count_too_low(self):
        ast = KaryotypeAST(20, "XX", [], None, None)
        errors = chromosome_count_range_rule.validate(ast, ast)
        self.assertIn("between 23 and 92", errors[0])

    def test_count_too_high(self):
        ast = KaryotypeAST(100, "XX", [], None, None)
        errors = chromosome_count_range_rule.validate(ast, ast)
        self.assertIn("between 23 and 92", errors[0])

class TestSexChromosomeRules(unittest.TestCase):
    def test_valid_xx(self):
        ast = KaryotypeAST(46, "XX", [], None, None)
        errors = sex_chromosomes_valid_rule.validate(ast, ast)
        self.assertEqual(errors, [])

    def test_valid_xy(self):
        ast = KaryotypeAST(46, "XY", [], None, None)
        errors = sex_chromosomes_valid_rule.validate(ast, ast)
        self.assertEqual(errors, [])

    def test_valid_x(self):
        ast = KaryotypeAST(45, "X", [], None, None)
        errors = sex_chromosomes_valid_rule.validate(ast, ast)
        self.assertEqual(errors, [])

    def test_valid_xxy(self):
        ast = KaryotypeAST(47, "XXY", [], None, None)
        errors = sex_chromosomes_valid_rule.validate(ast, ast)
        self.assertEqual(errors, [])

    def test_invalid_y_only(self):
        ast = KaryotypeAST(46, "Y", [], None, None)
        errors = sex_chromosomes_valid_rule.validate(ast, ast)
        self.assertIn("at least one X", errors[0])

    def test_invalid_yy(self):
        ast = KaryotypeAST(46, "YY", [], None, None)
        errors = sex_chromosomes_valid_rule.validate(ast, ast)
        self.assertIn("at least one X", errors[0])

class TestCoherenceRule(unittest.TestCase):
    def test_46_with_2_sex_chr(self):
        ast = KaryotypeAST(46, "XX", [], None, None)
        errors = sex_chromosomes_coherence_rule.validate(ast, ast)
        self.assertEqual(errors, [])

    def test_45_with_1_sex_chr(self):
        ast = KaryotypeAST(45, "X", [], None, None)
        errors = sex_chromosomes_coherence_rule.validate(ast, ast)
        self.assertEqual(errors, [])

    def test_47_with_3_sex_chr(self):
        ast = KaryotypeAST(47, "XXX", [], None, None)
        errors = sex_chromosomes_coherence_rule.validate(ast, ast)
        self.assertEqual(errors, [])

    def test_46_with_1_sex_chr_invalid(self):
        ast = KaryotypeAST(46, "X", [], None, None)
        errors = sex_chromosomes_coherence_rule.validate(ast, ast)
        self.assertIn("46", errors[0])
        self.assertIn("2", errors[0])

    def test_46_with_3_sex_chr_invalid(self):
        ast = KaryotypeAST(46, "XXY", [], None, None)
        errors = sex_chromosomes_coherence_rule.validate(ast, ast)
        self.assertIn("46", errors[0])

if __name__ == '__main__':
    unittest.main()
```

**Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests/test_rules_chromosome.py -v`
Expected: FAIL with "ModuleNotFoundError"

**Step 3: Write minimal implementation**

```python
# iscn_authenticator/rules/chromosome.py
from iscn_authenticator.rules.base import Rule
from iscn_authenticator.models import KaryotypeAST

def _validate_chromosome_count_numeric(ast: KaryotypeAST, _) -> list[str]:
    """Validate chromosome count is numeric."""
    if isinstance(ast.chromosome_count, str):
        # Range notation like "45~48" is valid
        if '~' in ast.chromosome_count:
            return []
        return [f"Chromosome count '{ast.chromosome_count}' is not numeric"]
    return []

def _validate_chromosome_count_range(ast: KaryotypeAST, _) -> list[str]:
    """Validate chromosome count is in valid range (23-92)."""
    count = ast.chromosome_count
    if isinstance(count, str):
        # Skip range validation for range notation
        return []
    if count < 23 or count > 92:
        return [f"Chromosome count {count} is outside valid range (must be between 23 and 92)"]
    return []

def _validate_sex_chromosomes_valid(ast: KaryotypeAST, _) -> list[str]:
    """Validate sex chromosomes contain at least one X."""
    sex = ast.sex_chromosomes
    if sex == "U":  # Undisclosed
        return []
    if 'X' not in sex:
        return [f"Sex chromosomes '{sex}' must contain at least one X chromosome"]
    return []

def _validate_sex_chromosomes_coherence(ast: KaryotypeAST, _) -> list[str]:
    """Validate coherence between chromosome count and sex chromosome count."""
    count = ast.chromosome_count
    sex = ast.sex_chromosomes

    if isinstance(count, str) or sex == "U":
        # Skip coherence check for ranges or undisclosed
        return []

    sex_count = len(sex)
    expected_autosomes = 44  # Normal diploid has 44 autosomes
    expected_total = expected_autosomes + sex_count

    # Allow for abnormalities to account for difference
    # Basic check: count should be >= 44 + sex_count - some tolerance
    # This is a simplified check; full coherence requires analyzing abnormalities
    if count == 46 and sex_count != 2:
        return [f"Chromosome count 46 requires 2 sex chromosomes, but found {sex_count} ('{sex}')"]
    if count == 45 and sex_count != 1 and sex_count != 2:
        # 45,X is valid, 45,XY,-chr is also valid
        pass
    if count == 47 and sex_count not in [2, 3]:
        # 47,XXX or 47,XY,+21 are both valid
        pass

    return []

# Rule instances
chromosome_count_numeric_rule = Rule(
    id="CHR_COUNT_NUMERIC",
    category="chromosome_count",
    description="Chromosome count must be numeric or valid range notation",
    validate=_validate_chromosome_count_numeric
)

chromosome_count_range_rule = Rule(
    id="CHR_COUNT_RANGE",
    category="chromosome_count",
    description="Chromosome count must be between 23 and 92",
    validate=_validate_chromosome_count_range
)

sex_chromosomes_valid_rule = Rule(
    id="SEX_CHR_VALID",
    category="sex_chromosomes",
    description="Sex chromosomes must contain at least one X",
    validate=_validate_sex_chromosomes_valid
)

sex_chromosomes_coherence_rule = Rule(
    id="SEX_CHR_COHERENCE",
    category="coherence",
    description="Chromosome count must be coherent with sex chromosome count",
    validate=_validate_sex_chromosomes_coherence
)

# Export all rules
ALL_CHROMOSOME_RULES = [
    chromosome_count_numeric_rule,
    chromosome_count_range_rule,
    sex_chromosomes_valid_rule,
    sex_chromosomes_coherence_rule,
]
```

**Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests/test_rules_chromosome.py -v`
Expected: PASS (14 tests)

**Step 5: Commit**

```bash
git add iscn_authenticator/rules/chromosome.py tests/test_rules_chromosome.py
git commit -m "feat: add chromosome count and sex chromosome validation rules"
```

---

### Task 6: Wire Up New API with Backward Compatibility

**Files:**
- Modify: `iscn_authenticator/main.py`
- Test: `tests/test_main.py` (modify existing)

**Step 1: Write the test for new API**

Add to existing `tests/test_main.py`:

```python
# Add these imports at the top
from iscn_authenticator.main import validate_karyotype

# Add this new test class
class TestValidateKaryotype(unittest.TestCase):
    def test_returns_validation_result(self):
        result = validate_karyotype("46,XX")
        self.assertTrue(result.valid)
        self.assertEqual(result.errors, [])
        self.assertIsNotNone(result.parsed)

    def test_returns_errors_for_invalid(self):
        result = validate_karyotype("46,Y")
        self.assertFalse(result.valid)
        self.assertTrue(len(result.errors) > 0)

    def test_parsed_contains_chromosome_count(self):
        result = validate_karyotype("46,XX")
        self.assertEqual(result.parsed.chromosome_count, 46)

    def test_parsed_contains_sex_chromosomes(self):
        result = validate_karyotype("47,XXY")
        self.assertEqual(result.parsed.sex_chromosomes, "XXY")

    def test_backward_compat_is_valid_karyotype(self):
        # Ensure old API still works
        self.assertTrue(is_valid_karyotype("46,XX"))
        self.assertFalse(is_valid_karyotype("46,Y"))
```

**Step 2: Run test to verify new tests fail**

Run: `python3 -m unittest tests/test_main.py -v`
Expected: Some FAIL with "cannot import name 'validate_karyotype'"

**Step 3: Update main.py to use new architecture**

```python
# iscn_authenticator/main.py
import re
from iscn_authenticator.models import ValidationResult, KaryotypeAST
from iscn_authenticator.parser import KaryotypeParser, ParseError
from iscn_authenticator.engine import RuleEngine
from iscn_authenticator.rules.chromosome import ALL_CHROMOSOME_RULES

# Initialize parser and engine
_parser = KaryotypeParser()
_engine = RuleEngine()
_engine.add_rules(ALL_CHROMOSOME_RULES)

def validate_karyotype(karyotype: str) -> ValidationResult:
    """
    Validate an ISCN karyotype string.

    Returns a ValidationResult containing:
    - valid: bool indicating if karyotype is valid
    - errors: list of error messages if invalid
    - parsed: KaryotypeAST if parsing succeeded
    """
    try:
        ast = _parser.parse(karyotype)
    except ParseError as e:
        return ValidationResult(
            valid=False,
            errors=[str(e)],
            parsed=None
        )

    return _engine.validate(ast)

def is_valid_karyotype(karyotype: str) -> bool:
    """
    Validates a simple ISCN karyotype string.

    Backward-compatible API that returns only True/False.
    For detailed errors, use validate_karyotype() instead.
    """
    return validate_karyotype(karyotype).valid

if __name__ == "__main__":
    karyotype_string = input("Enter karyotype string: ")
    result = validate_karyotype(karyotype_string)
    if result.valid:
        print("Valid")
    else:
        print("Invalid")
        for error in result.errors:
            print(f"  - {error}")
```

**Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests/test_main.py -v`
Expected: PASS (all tests including new ones)

**Step 5: Commit**

```bash
git add iscn_authenticator/main.py tests/test_main.py
git commit -m "feat: add validate_karyotype() API with structured results

Maintains backward compatibility with is_valid_karyotype().
New API returns ValidationResult with errors and parsed AST."
```

---

## Phase 2: Core Abnormalities

### Task 7: Parse Numerical Abnormalities (+21, -7)

**Files:**
- Modify: `iscn_authenticator/parser.py`
- Test: `tests/test_parser.py` (add tests)

**Step 1: Write the test**

Add to `tests/test_parser.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests/test_parser.py::TestParserNumericalAbnormalities -v`
Expected: FAIL (type is "unknown" not "+" or "-")

**Step 3: Update parser**

Update `_parse_abnormalities` method in `parser.py`:

```python
# Add to parser.py

# Pattern for numerical abnormalities
NUMERICAL_ABNORMALITY_PATTERN = re.compile(r'^([+-])(\d{1,2}|[XY])$')

def _parse_abnormalities(self, parts: list[str]) -> list[Abnormality]:
    """Parse abnormality parts."""
    abnormalities = []
    for part in parts:
        part = part.strip()
        if not part:
            continue

        # Try numerical abnormality (+21, -7)
        num_match = self.NUMERICAL_ABNORMALITY_PATTERN.match(part)
        if num_match:
            abnormalities.append(Abnormality(
                type=num_match.group(1),  # "+" or "-"
                chromosome=num_match.group(2),
                breakpoints=[],
                inheritance=None,
                uncertain=False,
                copy_count=None,
                raw=part
            ))
            continue

        # Unknown abnormality type (will be expanded)
        abnormalities.append(Abnormality(
            type="unknown",
            chromosome="",
            breakpoints=[],
            inheritance=None,
            uncertain=False,
            copy_count=None,
            raw=part
        ))

    return abnormalities
```

**Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests/test_parser.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add iscn_authenticator/parser.py tests/test_parser.py
git commit -m "feat: parse numerical abnormalities (+21, -7)"
```

---

### Task 8: Parse Deletion Abnormalities

**Files:**
- Modify: `iscn_authenticator/parser.py`
- Test: `tests/test_parser.py` (add tests)

**Step 1: Write the test**

Add to `tests/test_parser.py`:

```python
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

    def test_parse_deletion_with_subband(self):
        result = self.parser.parse("46,XY,del(7)(p11.2)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.breakpoints[0].subband, "2")

    def test_parse_deletion_x_chromosome(self):
        result = self.parser.parse("46,X,del(X)(p22)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.chromosome, "X")
```

**Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests/test_parser.py::TestParserDeletions -v`
Expected: FAIL

**Step 3: Update parser with deletion parsing**

Add to `parser.py`:

```python
# Add patterns
DELETION_PATTERN = re.compile(r'^del\((\d{1,2}|[XY])\)\(([^)]+)\)$')
BREAKPOINT_PATTERN = re.compile(r'^([pq])(\d+)(?:\.(\d+))?$')

def _parse_breakpoint(self, bp_str: str) -> Breakpoint:
    """Parse a single breakpoint like 'q13' or 'p11.2'."""
    match = self.BREAKPOINT_PATTERN.match(bp_str)
    if not match:
        raise ParseError(f"Invalid breakpoint format: '{bp_str}'")

    arm = match.group(1)
    region_band = match.group(2)
    subband = match.group(3)

    # Split region and band (e.g., "13" -> region=1, band=3)
    if len(region_band) >= 2:
        region = int(region_band[0])
        band = int(region_band[1:])
    else:
        region = int(region_band)
        band = 0

    return Breakpoint(
        arm=arm,
        region=region,
        band=band,
        subband=subband,
        uncertain=False
    )

def _parse_deletion(self, part: str) -> Abnormality:
    """Parse a deletion abnormality."""
    match = self.DELETION_PATTERN.match(part)
    if not match:
        raise ParseError(f"Invalid deletion format: '{part}'")

    chromosome = match.group(1)
    breakpoint_str = match.group(2)

    # Parse breakpoints (could be single or double)
    breakpoints = []
    # Check for interstitial deletion (two breakpoints like q13q33)
    double_bp = re.match(r'^([pq]\d+(?:\.\d+)?)([pq]\d+(?:\.\d+)?)$', breakpoint_str)
    if double_bp:
        breakpoints.append(self._parse_breakpoint(double_bp.group(1)))
        breakpoints.append(self._parse_breakpoint(double_bp.group(2)))
    else:
        # Single breakpoint (terminal deletion)
        breakpoints.append(self._parse_breakpoint(breakpoint_str))

    return Abnormality(
        type="del",
        chromosome=chromosome,
        breakpoints=breakpoints,
        inheritance=None,
        uncertain=False,
        copy_count=None,
        raw=part
    )

# Update _parse_abnormalities to use deletion parsing
def _parse_abnormalities(self, parts: list[str]) -> list[Abnormality]:
    """Parse abnormality parts."""
    abnormalities = []
    for part in parts:
        part = part.strip()
        if not part:
            continue

        # Try numerical abnormality (+21, -7)
        num_match = self.NUMERICAL_ABNORMALITY_PATTERN.match(part)
        if num_match:
            abnormalities.append(Abnormality(
                type=num_match.group(1),
                chromosome=num_match.group(2),
                breakpoints=[],
                inheritance=None,
                uncertain=False,
                copy_count=None,
                raw=part
            ))
            continue

        # Try deletion
        if part.startswith('del('):
            abnormalities.append(self._parse_deletion(part))
            continue

        # Unknown abnormality type
        abnormalities.append(Abnormality(
            type="unknown",
            chromosome="",
            breakpoints=[],
            inheritance=None,
            uncertain=False,
            copy_count=None,
            raw=part
        ))

    return abnormalities
```

**Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests/test_parser.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add iscn_authenticator/parser.py tests/test_parser.py
git commit -m "feat: parse deletion abnormalities del(chr)(breakpoints)"
```

---

### Task 9: Parse Duplication Abnormalities

**Files:**
- Modify: `iscn_authenticator/parser.py`
- Test: `tests/test_parser.py`

**Step 1: Write the test**

```python
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
```

**Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests/test_parser.py::TestParserDuplications -v`

**Step 3: Add duplication parsing (similar to deletion)**

```python
# Add pattern
DUPLICATION_PATTERN = re.compile(r'^dup\((\d{1,2}|[XY])\)\(([^)]+)\)$')

def _parse_duplication(self, part: str) -> Abnormality:
    """Parse a duplication abnormality."""
    match = self.DUPLICATION_PATTERN.match(part)
    if not match:
        raise ParseError(f"Invalid duplication format: '{part}'")

    chromosome = match.group(1)
    breakpoint_str = match.group(2)

    breakpoints = []
    double_bp = re.match(r'^([pq]\d+(?:\.\d+)?)([pq]\d+(?:\.\d+)?)$', breakpoint_str)
    if double_bp:
        breakpoints.append(self._parse_breakpoint(double_bp.group(1)))
        breakpoints.append(self._parse_breakpoint(double_bp.group(2)))
    else:
        breakpoints.append(self._parse_breakpoint(breakpoint_str))

    return Abnormality(
        type="dup",
        chromosome=chromosome,
        breakpoints=breakpoints,
        inheritance=None,
        uncertain=False,
        copy_count=None,
        raw=part
    )

# Add to _parse_abnormalities:
if part.startswith('dup('):
    abnormalities.append(self._parse_duplication(part))
    continue
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git commit -m "feat: parse duplication abnormalities dup(chr)(breakpoints)"
```

---

### Task 10: Parse Inversion Abnormalities

**Files:**
- Modify: `iscn_authenticator/parser.py`
- Test: `tests/test_parser.py`

**Step 1: Write the test**

```python
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
```

**Step 2-5: Similar pattern - add INVERSION_PATTERN and _parse_inversion**

---

### Task 11: Parse Translocation Abnormalities

**Files:**
- Modify: `iscn_authenticator/parser.py`
- Test: `tests/test_parser.py`

**Step 1: Write the test**

```python
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

    def test_parse_three_way_translocation(self):
        result = self.parser.parse("46,XY,t(1;3;5)(p32;q21;q31)")
        abn = result.abnormalities[0]
        self.assertEqual(abn.chromosome, "1;3;5")
        self.assertEqual(len(abn.breakpoints), 3)
```

**Step 2-5: Add translocation parsing with semicolon-separated chromosomes**

---

### Task 12: Add Abnormality Validation Rules

**Files:**
- Create: `iscn_authenticator/rules/abnormalities.py`
- Test: `tests/test_rules_abnormalities.py`

**Step 1: Write the test**

```python
# tests/test_rules_abnormalities.py
import unittest
from iscn_authenticator.rules.abnormalities import (
    numerical_abnormality_chromosome_rule,
    deletion_breakpoint_rule,
)
from iscn_authenticator.models import KaryotypeAST, Abnormality, Breakpoint

class TestNumericalAbnormalityRules(unittest.TestCase):
    def test_valid_autosome_trisomy(self):
        abn = Abnormality("+", "21", [], None, False, None, "+21")
        ast = KaryotypeAST(47, "XX", [abn], None, None)
        errors = numerical_abnormality_chromosome_rule.validate(ast, ast)
        self.assertEqual(errors, [])

    def test_invalid_chromosome_number(self):
        abn = Abnormality("+", "25", [], None, False, None, "+25")
        ast = KaryotypeAST(47, "XX", [abn], None, None)
        errors = numerical_abnormality_chromosome_rule.validate(ast, ast)
        self.assertIn("25", errors[0])

class TestDeletionRules(unittest.TestCase):
    def test_valid_deletion_breakpoint(self):
        bp = Breakpoint("q", 1, 3, None, False)
        abn = Abnormality("del", "5", [bp], None, False, None, "del(5)(q13)")
        ast = KaryotypeAST(46, "XX", [abn], None, None)
        errors = deletion_breakpoint_rule.validate(ast, ast)
        self.assertEqual(errors, [])

if __name__ == '__main__':
    unittest.main()
```

**Step 2-5: Implement abnormality rules**

---

## Phase 3: Advanced Abnormalities

Tasks 13-20 follow the same TDD pattern for:
- Derivative chromosomes (der)
- Isochromosomes (i)
- Ring chromosomes (r)
- Dicentric chromosomes (dic)
- Robertsonian translocations (rob)
- Insertions (ins)
- Triplications (trp)
- Marker chromosomes (mar)

---

## Phase 4: Mosaicism & Polish

### Task 21: Parse Cell Line Notation

**Step 1: Write the test**

```python
class TestParserMosaicism(unittest.TestCase):
    def test_parse_mosaic(self):
        result = self.parser.parse("45,X[10]/46,XX[20]")
        self.assertEqual(len(result.cell_lines), 2)
        self.assertEqual(result.cell_lines[0].count, 10)
        self.assertEqual(result.cell_lines[1].count, 20)

    def test_parse_mosaic_with_mos_prefix(self):
        result = self.parser.parse("mos 45,X[15]/46,XX[25]")
        self.assertTrue(result.modifiers.mosaic)
```

---

### Task 22: Parse Inheritance Markers

**Step 1: Write the test**

```python
class TestParserInheritance(unittest.TestCase):
    def test_parse_maternal(self):
        result = self.parser.parse("46,XX,t(5;6)(q34;q23)mat")
        abn = result.abnormalities[0]
        self.assertEqual(abn.inheritance, "mat")

    def test_parse_de_novo(self):
        result = self.parser.parse("46,XY,del(7)(p22)dn")
        abn = result.abnormalities[0]
        self.assertEqual(abn.inheritance, "dn")
```

---

### Task 23: Comprehensive Integration Tests

**Files:**
- Create: `tests/test_integration.py`

Test cases from ISCN 2024 examples to validate full system.

---

### Task 24: Update CLAUDE.md and Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

Document new `validate_karyotype()` API and supported notation.

---

## Summary

**Total Tasks:** 24
**Estimated Commits:** 24+

Each task follows TDD:
1. Write failing test
2. Verify it fails
3. Write minimal code
4. Verify it passes
5. Commit

**Key Files Created:**
- `iscn_authenticator/models.py`
- `iscn_authenticator/parser.py`
- `iscn_authenticator/engine.py`
- `iscn_authenticator/rules/base.py`
- `iscn_authenticator/rules/chromosome.py`
- `iscn_authenticator/rules/abnormalities.py`
