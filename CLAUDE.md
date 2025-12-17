# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ISCN Authenticator validates ISCN (International System for Human Cytogenomic Nomenclature) karyotype strings. The project has no external dependencies and uses Python's built-in `unittest` framework.

## Commands

**Run tests:**
```bash
python -m unittest tests/test_main.py
```

**Run a single test:**
```bash
python -m unittest tests.test_main.TestIsValidKaryotype.test_valid_karyotypes
```

**Run interactively:**
```bash
python iscn_authenticator/main.py
```

## Architecture

- `iscn_authenticator/main.py` - Core validation logic with `is_valid_karyotype()` as the main entry point
- `tests/test_main.py` - Test suite using unittest

The validation pipeline in `main.py`:
1. `_validate_total_chromosome_number()` - Validates chromosome count is numeric
2. `_validate_sex_chromosomes()` - Validates sex chromosome notation (X/Y combinations)
3. `_validate_coherence()` - Checks chromosome count matches sex chromosome count (e.g., 46 requires 2 sex chromosomes)
4. `_validate_abnormalities()` - Validates abnormality notation including deletions (`del()`) and numeric changes (`+21`, `-7`)

## ISCN Reference

The PDF `Iscn 2024 An International System for Human Cytogenomic Nomenclature` in the project root contains the authoritative nomenclature specification.
