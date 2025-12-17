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
    NUMERICAL_ABNORMALITY_PATTERN = re.compile(r'^([+-])(\d{1,2}|[XY])$')
    DELETION_PATTERN = re.compile(r'^del\((\d{1,2}|[XY])\)\(([^)]+)\)$')
    DUPLICATION_PATTERN = re.compile(r'^dup\((\d{1,2}|[XY])\)\(([^)]+)\)$')
    INVERSION_PATTERN = re.compile(r'^inv\((\d{1,2}|[XY])\)\(([^)]+)\)$')
    TRANSLOCATION_PATTERN = re.compile(r'^t\(([^)]+)\)\(([^)]+)\)$')
    BREAKPOINT_PATTERN = re.compile(r'^([pq])(\d+)(?:\.(\d+))?$')

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

    def _parse_duplication(self, part: str) -> Abnormality:
        """Parse a duplication abnormality."""
        match = self.DUPLICATION_PATTERN.match(part)
        if not match:
            raise ParseError(f"Invalid duplication format: '{part}'")

        chromosome = match.group(1)
        breakpoint_str = match.group(2)

        # Parse breakpoints (could be single or double)
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

    def _parse_inversion(self, part: str) -> Abnormality:
        """Parse an inversion abnormality."""
        match = self.INVERSION_PATTERN.match(part)
        if not match:
            raise ParseError(f"Invalid inversion format: '{part}'")

        chromosome = match.group(1)
        breakpoint_str = match.group(2)

        # Inversions always have two breakpoints
        breakpoints = []
        double_bp = re.match(r'^([pq]\d+(?:\.\d+)?)([pq]\d+(?:\.\d+)?)$', breakpoint_str)
        if double_bp:
            breakpoints.append(self._parse_breakpoint(double_bp.group(1)))
            breakpoints.append(self._parse_breakpoint(double_bp.group(2)))
        else:
            raise ParseError(f"Inversion requires two breakpoints: '{part}'")

        return Abnormality(
            type="inv",
            chromosome=chromosome,
            breakpoints=breakpoints,
            inheritance=None,
            uncertain=False,
            copy_count=None,
            raw=part
        )

    def _parse_translocation(self, part: str) -> Abnormality:
        """Parse a translocation abnormality."""
        match = self.TRANSLOCATION_PATTERN.match(part)
        if not match:
            raise ParseError(f"Invalid translocation format: '{part}'")

        chromosomes_str = match.group(1)  # e.g., "9;22" or "1;3;5"
        breakpoints_str = match.group(2)  # e.g., "q34;q11.2" or "p32;q21;q31"

        # Parse breakpoints (semicolon-separated)
        bp_parts = breakpoints_str.split(';')
        breakpoints = [self._parse_breakpoint(bp.strip()) for bp in bp_parts]

        return Abnormality(
            type="t",
            chromosome=chromosomes_str,
            breakpoints=breakpoints,
            inheritance=None,
            uncertain=False,
            copy_count=None,
            raw=part
        )

    def _parse_abnormalities(self, parts: list[str]) -> list[Abnormality]:
        """Parse abnormality parts."""
        abnormalities = []
        for part in parts:
            part = part.strip()
            if not part:
                continue

            # Try numerical abnormality (+21, -7, +X, -Y)
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

            # Try deletion
            if part.startswith('del('):
                abnormalities.append(self._parse_deletion(part))
                continue

            # Try duplication
            if part.startswith('dup('):
                abnormalities.append(self._parse_duplication(part))
                continue

            # Try inversion
            if part.startswith('inv('):
                abnormalities.append(self._parse_inversion(part))
                continue

            # Try translocation
            if part.startswith('t('):
                abnormalities.append(self._parse_translocation(part))
                continue

            # Unknown abnormality type (will be expanded in later tasks)
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
