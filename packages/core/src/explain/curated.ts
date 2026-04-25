import type { Abnormality, ExplainResult, KaryotypeNode } from "../types.js";
import curatedDataRaw from "../../data/explains/curated.json" with { type: "json" };

interface CuratedEntry {
  summary: string;
  detail: string;
  citation?: { section: string; page?: number };
  refs?: { omim?: string[]; hpo?: string[]; clinvar?: string[] };
}

interface CuratedData {
  signatures: Record<string, CuratedEntry>;
}

const curatedData = curatedDataRaw as unknown as CuratedData;

/**
 * Generates a canonical signature for a KaryotypeNode.
 * For KaryotypeAST: "{count},{sex},{abn1},{abn2}..."
 * For Abnormality: "{type}({chromosome})({breakpoints})"
 */
export function generateSignature(node: KaryotypeNode): string {
  if (isAbnormality(node)) {
    let sig = `${node.type}(${node.chromosome})`;
    if (node.breakpoints.length > 0) {
      const bps = node.breakpoints.map((bp) => {
        let s = bp.arm + (bp.region ?? "") + (bp.band ?? "");
        if (bp.subband) s += "." + bp.subband;
        return s;
      });
      const separator = node.chromosome.includes(";") ? ";" : "";
      sig = `${node.type}(${node.chromosome})(${bps.join(separator)})`;
    } else if (node.type === "+" || node.type === "-") {
      // Numerical gain/loss: +21, -X etc.
      sig = `${node.type}${node.chromosome}`;
    }
    return sig;
  } else {
    // KaryotypeAST
    let sig = `${node.chromosome_count},${node.sex_chromosomes}`;
    if (node.abnormalities.length > 0) {
      // Recursively generate signatures for all abnormalities and sort them
      const abns = node.abnormalities.map((a) => generateSignature(a)).sort();
      sig += `,${abns.join(",")}`;
    }
    return sig;
  }
}

/**
 * Looks up a curated explanation for a given node.
 * Uses a hierarchy of matching:
 * 1. Exact canonical signature (type, chromosome, breakpoints)
 * 2. Structural signature (type, chromosome)
 */
export function lookupCuratedExplanation(node: KaryotypeNode): ExplainResult | null {
  const signatures = curatedData.signatures;
  
  // 1. Try exact canonical signature
  const exactSig = generateSignature(node);
  if (signatures[exactSig]) {
    return createResult(signatures[exactSig]);
  }

  // 2. Try structural signature (type + chromosome only)
  if (isAbnormality(node) && node.breakpoints.length > 0) {
    const structuralSig = `${node.type}(${node.chromosome})`;
    if (signatures[structuralSig]) {
      return createResult(signatures[structuralSig]);
    }
  }

  return null;
}

function createResult(curated: CuratedEntry): ExplainResult {
  return {
    summary: curated.summary,
    detail: curated.detail,
    citation: curated.citation || null,
    refs: curated.refs || {},
    confidence: "curated",
  };
}

function isAbnormality(node: KaryotypeNode): node is Abnormality {
  return (node as Abnormality).type !== undefined && (node as Abnormality).chromosome !== undefined;
}
