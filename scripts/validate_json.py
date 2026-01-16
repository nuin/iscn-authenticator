#!/usr/bin/env python3
"""JSON wrapper for ISCN karyotype validation.

Usage:
    python scripts/validate_json.py "46,XX"
    echo "46,XX" | python scripts/validate_json.py

Outputs JSON to stdout with structure:
{
    "valid": true/false,
    "errors": [...],
    "parsed": {...} or null
}
"""
import json
import sys
from dataclasses import asdict, is_dataclass
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from iscn_authenticator.main import validate_karyotype


def to_json_serializable(obj):
    """Convert dataclass instances to JSON-serializable dicts recursively."""
    if is_dataclass(obj) and not isinstance(obj, type):
        return {k: to_json_serializable(v) for k, v in asdict(obj).items()}
    elif isinstance(obj, list):
        return [to_json_serializable(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: to_json_serializable(v) for k, v in obj.items()}
    else:
        return obj


def main():
    # Get karyotype from command line or stdin
    if len(sys.argv) > 1:
        karyotype = sys.argv[1]
    else:
        karyotype = sys.stdin.read().strip()

    if not karyotype:
        result = {
            "valid": False,
            "errors": ["No karyotype provided"],
            "parsed": None
        }
        print(json.dumps(result))
        sys.exit(2)

    try:
        validation_result = validate_karyotype(karyotype)
        result = to_json_serializable(validation_result)
        print(json.dumps(result, indent=2))
        sys.exit(0 if validation_result.valid else 1)
    except Exception as e:
        result = {
            "valid": False,
            "errors": [f"Validation error: {str(e)}"],
            "parsed": None
        }
        print(json.dumps(result))
        sys.exit(2)


if __name__ == "__main__":
    main()
