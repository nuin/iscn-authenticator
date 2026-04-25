import type { Abnormality, ExplainResult, KaryotypeAST, KaryotypeNode } from "../types.js";

/**
 * Determines if a node is an Abnormality.
 */
function isAbnormality(node: KaryotypeNode): node is Abnormality {
  return (node as Abnormality).type !== undefined && (node as Abnormality).chromosome !== undefined;
}

/**
 * Determines if a node is a KaryotypeAST.
 */
function isKaryotypeAST(node: KaryotypeNode): node is KaryotypeAST {
  return (node as KaryotypeAST).sex_chromosomes !== undefined;
}

/**
 * Formats breakpoints into a human-readable string.
 */
function formatBreakpoints(node: Abnormality): string {
  if (node.breakpoints.length === 0) return "";
  const bps = node.breakpoints.map((bp) => {
    let s = bp.arm + (bp.region ?? "") + (bp.band ?? "");
    if (bp.subband) s += "." + bp.subband;
    return s;
  });
  return ` at ${bps.join(", ")}`;
}

const ABNORMALITY_NAMES: Record<string, string> = {
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
};

/**
 * Generates a deterministic, mechanical description of an AST node.
 */
export function generateTemplateExplanation(node: KaryotypeNode): ExplainResult {
  let summary = "";
  let detail = "";

  if (isAbnormality(node)) {
    const typeName = ABNORMALITY_NAMES[node.type] || node.type;
    const bpText = formatBreakpoints(node);

    if (node.type === "+" || node.type === "-") {
      summary = `${typeName} of chromosome ${node.chromosome}.`;
      detail = `The karyotype indicates a ${typeName.toLowerCase()} of an entire chromosome ${node.chromosome}.`;
    } else if (node.type === "mar") {
      summary = "Marker chromosome.";
      detail = "An unidentified extra structurally abnormal chromosome (ESAC) is present.";
    } else {
      summary = `${typeName} on chromosome ${node.chromosome}${bpText}.`;
      detail = `A ${typeName.toLowerCase()} was identified on chromosome ${node.chromosome}${bpText}.`;
    }

    if (node.inheritance) {
      const inhMap: Record<string, string> = {
        mat: "maternally inherited",
        pat: "paternally inherited",
        dn: "de novo (not inherited)",
      };
      const inhText = inhMap[node.inheritance] || `inherited (${node.inheritance})`;
      summary += ` (${node.inheritance})`;
      detail += ` This abnormality is ${inhText}.`;
    }
  } else if (isKaryotypeAST(node)) {
    const count = node.chromosome_count;
    const sex = node.sex_chromosomes;
    const abncount = node.abnormalities.length;

    summary = `${count},${sex} karyotype with ${abncount} abnormalities.`;
    detail = `This is a ${sex} karyotype with a total chromosome count of ${count}. `;
    if (abncount === 0) {
      detail += "No structural or numerical abnormalities were detected.";
    } else {
      detail += `There are ${abncount} abnormality/abnormalities described.`;
    }
  }

  return {
    summary,
    detail,
    citation: null,
    refs: {},
    confidence: "template",
  };
}
