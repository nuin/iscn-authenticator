import json
import os
from typing import Optional
from .models import Abnormality, ExplainResult, KaryotypeAST, KaryotypeNode

ABNORMALITY_NAMES = {
    "+": "Gain",
    "-": "Loss",
    "del": "Deletion",
    "dup": "Duplication",
    "inv": "Inversion",
    "t": "Translocation",
    "i": "Isochromosome",
    "r": "Ring chromosome",
    "ins": "Insertion",
    "add": "Additional material",
    "trp": "Triplication",
    "dic": "Dicentric chromosome",
    "idic": "Isodicentric chromosome",
    "fra": "Fragile site",
    "rob": "Robertsonian translocation",
    "mar": "Marker chromosome",
}

def format_breakpoints(node: Abnormality) -> str:
    """Formats breakpoints into a human-readable string."""
    if not node.breakpoints:
        return ""
    bps = []
    for bp in node.breakpoints:
        s = bp.arm + str(bp.region or "") + str(bp.band or "")
        if bp.subband:
            s += "." + bp.subband
        bps.append(s)
    return f" at {', '.join(bps)}"

def generate_template_explanation(node: KaryotypeNode) -> ExplainResult:
    """Generates a deterministic, mechanical description of an AST node."""
    summary = ""
    detail = ""

    if isinstance(node, Abnormality):
        type_name = ABNORMALITY_NAMES.get(node.type, node.type)
        bp_text = format_breakpoints(node)

        if node.type in ("+", "-"):
            summary = f"{type_name} of chromosome {node.chromosome}."
            detail = f"The karyotype indicates a {type_name.lower()} of an entire chromosome {node.chromosome}."
        elif node.type == "mar":
            summary = "Marker chromosome."
            detail = "An unidentified extra structurally abnormal chromosome (ESAC) is present."
        else:
            summary = f"{type_name} on chromosome {node.chromosome}{bp_text}."
            detail = f"A {type_name.lower()} was identified on chromosome {node.chromosome}{bp_text}."

        if node.inheritance:
            inh_map = {
                "mat": "maternally inherited",
                "pat": "paternally inherited",
                "dn": "de novo (not inherited)",
            }
            inh_text = inh_map.get(node.inheritance, f"inherited ({node.inheritance})")
            summary += f" ({node.inheritance})"
            detail += f" This abnormality is {inh_text}."

    elif isinstance(node, KaryotypeAST):
        count = node.chromosome_count
        sex = node.sex_chromosomes
        abncount = len(node.abnormalities)

        summary = f"{count},{sex} karyotype with {abncount} abnormalities."
        detail = f"This is a {sex} karyotype with a total chromosome count of {count}. "
        if abncount == 0:
            detail += "No structural or numerical abnormalities were detected."
        else:
            detail += f"There are {abncount} abnormality/abnormalities described."

    return ExplainResult(
        summary=summary,
        detail=detail,
        citation=None,
        refs={},
        confidence="template"
    )

def generate_signature(node: KaryotypeNode) -> str:
    """Generates a canonical signature for a KaryotypeNode."""
    if isinstance(node, Abnormality):
        sig = f"{node.type}({node.chromosome})"
        if node.breakpoints:
            bps = []
            for bp in node.breakpoints:
                s = bp.arm + str(bp.region or "") + str(bp.band or "")
                if bp.subband:
                    s += "." + bp.subband
                bps.append(s)
            separator = ";" if ";" in node.chromosome else ""
            sig = f"{node.type}({node.chromosome})({separator.join(bps)})"
        elif node.type in ("+", "-"):
            # Numerical gain/loss: +21, -X etc.
            sig = f"{node.type}{node.chromosome}"
        return sig
    else:
        # KaryotypeAST
        sig = f"{node.chromosome_count},{node.sex_chromosomes}"
        if node.abnormalities:
            # Recursively generate signatures for all abnormalities and sort them
            abns = sorted([generate_signature(a) for a in node.abnormalities])
            sig += f",{','.join(abns)}"
        return sig

_curated_data = None

def load_curated_data():
    """Loads curated data from the shared JSON file."""
    global _curated_data
    if _curated_data is not None:
        return _curated_data

    # Find the data file relative to this script
    # TS: packages/core/data/explains/curated.json
    # Py: iscn_authenticator/explain.py
    # From project root: packages/core/data/explains/curated.json
    
    # We'll look in the packages/core/data/explains/curated.json from the project root
    # or a copy if we were installed as a package. For now, we'll try to find it
    # relative to the project root.
    
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        json_path = os.path.join(base_dir, "packages", "core", "data", "explains", "curated.json")
        
        # If not found (e.g. installed via pip), check internal package data if we added it
        if not os.path.exists(json_path):
             # Fallback to local copy if it exists (for packaged version)
             json_path = os.path.join(os.path.dirname(__file__), "data", "curated.json")

        if os.path.exists(json_path):
            with open(json_path, "r") as f:
                _curated_data = json.load(f)
        else:
            _curated_data = {"signatures": {}}
    except Exception:
        _curated_data = {"signatures": {}}
    
    return _curated_data

def lookup_curated_explanation(node: KaryotypeNode) -> Optional[ExplainResult]:
    """
    Looks up a curated explanation for a given node.
    Uses a hierarchy of matching:
    1. Exact canonical signature (type, chromosome, breakpoints)
    2. Structural signature (type, chromosome)
    """
    data = load_curated_data()
    signatures = data.get("signatures", {})
    
    # 1. Try exact canonical signature
    exact_sig = generate_signature(node)
    curated = signatures.get(exact_sig)
    
    # 2. Try structural signature (type + chromosome only)
    if not curated and isinstance(node, Abnormality) and node.breakpoints:
        structural_sig = f"{node.type}({node.chromosome})"
        curated = signatures.get(structural_sig)

    if curated:
        return ExplainResult(
            summary=curated["summary"],
            detail=curated["detail"],
            citation=curated.get("citation"),
            refs=curated.get("refs", {}),
            confidence="curated"
        )
    return None

def explain(node: KaryotypeNode, on_miss=None) -> ExplainResult:
    """
    Explains a Karyotype AST node in human-readable terms.
    
    If on_miss is provided, it should be a callable that takes the canonical
    signature string as its only argument.
    """
    curated = lookup_curated_explanation(node)
    if curated:
        return curated
    
    if on_miss:
        on_miss(generate_signature(node))
        
    return generate_template_explanation(node)
