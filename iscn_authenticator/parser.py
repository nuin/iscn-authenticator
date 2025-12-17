# iscn_authenticator/parser.py
"""Parser for ISCN karyotype strings."""
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
