# ISCN Validation Engine Design

## Overview

A comprehensive rule-based validation engine for ISCN (International System for Human Cytogenomic Nomenclature) karyotype strings. The validator parses karyotype notation into an AST, applies validation rules, and returns structured results with specific error messages.

## Architecture

Three-layer design:

1. **Parser** - Tokenizes karyotype strings into components
2. **Rule Engine** - Applies validation rules to parsed components
3. **Rules** - Data structures defining valid patterns, constraints, and error messages

```
Input: "46,XX,del(5)(q13q33)"
         |
    [Parser] --> KaryotypeAST(count=46, sex="XX", abnormalities=[Deletion(...)])
         |
    [Rule Engine] --> applies rules from rule definitions
         |
    [Result] --> ValidationResult(valid=True, errors=[], parsed=KaryotypeAST)
```

## Data Models

### Core Result

```python
@dataclass
class ValidationResult:
    valid: bool
    errors: list[str]
    parsed: KaryotypeAST | None
```

### AST Structures

```python
@dataclass
class KaryotypeAST:
    chromosome_count: int | str      # int or range "45~48"
    sex_chromosomes: str             # "XX", "XY", "X", "XXY", "U" (undisclosed)
    abnormalities: list[Abnormality]
    cell_lines: list[CellLine] | None
    modifiers: Modifiers | None

@dataclass
class CellLine:
    karyotype: KaryotypeAST
    count: int                       # Number in brackets [10]
    is_donor: bool                   # For chimera: after //

@dataclass
class Modifiers:
    mosaic: bool                     # mos
    chimera: bool                    # chi
    constitutional: bool             # c suffix
    incomplete: bool                 # inc

@dataclass
class Abnormality:
    type: str
    chromosome: str | tuple          # "5" or ("9", "22") for translocations
    breakpoints: list[Breakpoint]
    inheritance: str | None          # "mat", "pat", "dn", "inh", "dmat", "dpat", "dinh"
    uncertain: bool                  # Has ? marker
    copy_count: int | None           # For x2, x3 notation
    raw: str

@dataclass
class Breakpoint:
    arm: str                         # "p", "q", or "cen" (centromere), "ter"
    region: int | None
    band: int | None
    subband: str | None              # "1", "11", "1.1" etc.
    uncertain: bool                  # Has ? in designation
```

### Supported Abnormality Types

| Category | Types |
|----------|-------|
| Numerical | `+`, `-` |
| Structural | `del`, `dup`, `inv`, `ins`, `t`, `der`, `i`, `r`, `dic`, `idic`, `ider`, `rob`, `rec`, `fis`, `trc` |
| Complex | `add`, `mar`, `neo`, `hsr`, `dmin`, `trp`, `qdp`, `fra`, `tas`, `psu dic` |
| Chromoanagenesis | `cth`, `cha`, `cpx`, `cx` |

### Additional Notation Support

- Uncertainty: `?`, `~` (tilde for ranges)
- Alternative interpretations: `or`
- Detailed system: `pter->q13::` with `->` and `::`
- Inheritance: `mat`, `pat`, `dn`, `inh`, `dmat`, `dpat`, `dinh`

## Rule Engine

### Rule Structure

```python
@dataclass
class Rule:
    id: str                          # "CHR_COUNT_VALID"
    category: str                    # "chromosome_count", "sex_chromosomes", etc.
    description: str                 # Human-readable description
    validate: Callable[[Any, KaryotypeAST], list[str]]  # Returns error messages
```

### Rule Categories

1. `chromosome_count` - Valid range, coherence with sex chromosomes
2. `sex_chromosomes` - Valid combinations (X, XX, XY, XXY, etc.)
3. `coherence` - Count matches sex + abnormalities
4. `band_notation` - Valid arm (p/q), region, band, subband format
5. `chromosome_range` - Chromosome 1-22, X, Y only
6. `abnormality_syntax` - Each abnormality type has valid structure
7. `abnormality_semantics` - Breakpoints valid for chromosome, logical consistency
8. `mosaicism` - Cell line notation, counts in brackets

### Rule Application Flow

1. Parse string to AST (or fail with parse errors)
2. Apply rules by category in order
3. Collect all errors (don't stop at first)
4. Return `ValidationResult`

## File Structure

```
iscn_authenticator/
├── __init__.py
├── main.py              # Entry point, is_valid_karyotype() backward compat
├── parser.py            # Tokenizer + AST builder
├── models.py            # Dataclasses (ValidationResult, KaryotypeAST, etc.)
├── engine.py            # Rule engine that applies rules to AST
├── rules/
│   ├── __init__.py      # Exports all rules
│   ├── chromosome.py    # Chromosome count, sex chromosome rules
│   ├── band.py          # Band notation rules (p/q, region, band, subband)
│   ├── abnormalities.py # Rules for each abnormality type
│   ├── coherence.py     # Cross-field validation (count vs abnormalities)
│   └── mosaicism.py     # Cell line, chimera rules
└── data/
    ├── __init__.py
    ├── chromosomes.py   # Valid bands per chromosome (from ISCN)
    └── patterns.py      # Regex patterns for parsing
```

## API

### Backward Compatible

```python
def is_valid_karyotype(karyotype: str) -> bool:
    """Original API - returns bool only."""
    return validate_karyotype(karyotype).valid
```

### New API

```python
def validate_karyotype(karyotype: str) -> ValidationResult:
    """Returns full result with errors and parsed AST."""
    ...
```

## Implementation Phases

### Phase 1: Foundation
- Create `models.py` with all dataclasses
- Create `parser.py` - basic tokenizer for simple karyotypes (`46,XX`, `47,XY,+21`)
- Create `engine.py` - rule application framework
- Basic rules for chromosome count, sex chromosomes, coherence

### Phase 2: Core Abnormalities
- Extend parser for structural abnormalities (`del`, `dup`, `inv`, `t`)
- Rules for band notation validation
- Add `data/chromosomes.py` with valid bands per chromosome

### Phase 3: Advanced Abnormalities
- Parser support for all remaining types (`der`, `i`, `r`, `dic`, `rob`, `ins`, `trp`, `qdp`, etc.)
- Rules for each abnormality type
- Complex notation: detailed system (`pter->q13::`), uncertainty (`?`, `~`)

### Phase 4: Mosaicism & Polish
- Cell line parsing (`[10]/[20]`)
- Chimera notation (`//`)
- Inheritance markers (`mat`, `pat`, `dn`)
- Comprehensive test suite from ISCN 2024 examples

## Reference

Based on ISCN 2024 (International System for Human Cytogenomic Nomenclature).
