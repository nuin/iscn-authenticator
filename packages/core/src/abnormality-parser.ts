import type { Abnormality, Breakpoint } from "./types.js";
import { ParseError } from "./parse-error.js";
import {
  parseBreakpoint,
  parseBreakpoints,
  parseDoubleBreakpoints,
  parseInsertionBreakpoints,
  parseMultipleBreakpoints,
} from "./breakpoint-parser.js";

type BreakpointMode = "single" | "pair" | "double" | "multiple" | "insertion";
type StructuralPattern =
  | readonly [
    type: string,
    pattern: RegExp,
    mode: Exclude<BreakpointMode, "double">,
    formatLabel: string,
  ]
  | readonly [
    type: string,
    pattern: RegExp,
    mode: "double",
    formatLabel: string,
    countLabel: string,
  ];
type ParsedAbnormality =
  & Pick<Abnormality, "type" | "chromosome" | "breakpoints">
  & Partial<Pick<Abnormality, "copy_count" | "inheritance">>;

const STRUCTURAL_PATTERNS: readonly StructuralPattern[] = [
  ["del", /^del\((\d{1,2}|[XY])\)\(([^)]+)\)$/, "pair", "deletion"],
  [
    "add",
    /^add\((\d{1,2}|[XY])\)\(([^)]+)\)$/,
    "single",
    "additional material",
  ],
  ["dup", /^dup\((\d{1,2}|[XY])\)\(([^)]+)\)$/, "pair", "duplication"],
  ["dic", /^dic\(([^)]+)\)\(([^)]+)\)$/, "multiple", "dicentric"],
  ["idic", /^idic\((\d{1,2}|[XY])\)\(([^)]+)\)$/, "single", "isodicentric"],
  ["fra", /^fra\((\d{1,2}|[XY])\)\(([^)]+)\)$/, "single", "fragile site"],
  [
    "inv",
    /^inv\((\d{1,2}|[XY])\)\(([^)]+)\)$/,
    "double",
    "inversion",
    "Inversion",
  ],
  [
    "trp",
    /^trp\((\d{1,2}|[XY])\)\(([^)]+)\)$/,
    "double",
    "triplication",
    "Triplication",
  ],
  [
    "qdp",
    /^qdp\((\d{1,2}|[XY])\)\(([^)]+)\)$/,
    "double",
    "quadruplication",
    "Quadruplication",
  ],
  ["t", /^t\(([^)]+)\)\(([^)]+)\)$/, "multiple", "translocation"],
  ["ins", /^ins\(([^)]+)\)\(([^)]+)\)$/, "insertion", "insertion"],
  [
    "rob",
    /^rob\(([^)]+)\)\(([^)]+)\)$/,
    "multiple",
    "Robertsonian translocation",
  ],
];

const OPTIONAL_PATTERNS: readonly StructuralPattern[] = [
  ["hsr", /^hsr\((\d{1,2}|[XY])\)\(([^)]+)\)$/, "single", "HSR"],
  [
    "psu dic",
    /^psu\s*dic\(([^)]+)\)\(([^)]+)\)$/,
    "multiple",
    "pseudodicentric",
  ],
  ["ace", /^ace\((\d{1,2}|[XY])\)\(([^)]+)\)$/, "pair", "acentric"],
  ["tas", /^tas\(([^)]+)\)\(([^)]+)\)$/, "multiple", "telomeric association"],
  ["fis", /^fis\((\d{1,2}|[XY])\)\(([^)]+)\)$/, "single", "fission"],
  ["neo", /^neo\((\d{1,2}|[XY])\)\(([^)]+)\)$/, "single", "neocentromere"],
];

const CHROMOSOME_ONLY_PATTERNS: readonly (readonly [string, RegExp])[] = [
  ["der", /^der\((\d{1,2}|[XY])\)(.+)$/],
  ["rec", /^rec\((\d{1,2}|[XY])\)(.+)$/],
  ["upd", /^upd\((\d{1,2}|[XY])\)(mat|pat)?$/],
  ["cpx", /^cpx\(([^)]+)\)$/],
  ["cth", /^cth\(([^)]+)\)$/],
  ["cpy", /^cpy\(([^)]+)\)$/],
];

function structuralAbnormality(
  part: string,
  definition: StructuralPattern,
  match: RegExpMatchArray,
): ParsedAbnormality {
  const [type, , mode, , countLabel] = definition;
  let breakpoints: Breakpoint[];
  switch (mode) {
    case "single":
      breakpoints = [parseBreakpoint(match[2])];
      break;
    case "pair":
      breakpoints = parseBreakpoints(match[2]);
      break;
    case "double":
      breakpoints = parseDoubleBreakpoints(match[2], countLabel, part);
      break;
    case "multiple":
      breakpoints = parseMultipleBreakpoints(match[2]);
      break;
    case "insertion":
      if (![1, 2].includes(match[1].split(";").length) ||
        (match[1].includes(";") !== match[2].includes(";"))) {
        throw new ParseError(`Unsupported insertion chromosome/breakpoint layout: '${part}'`);
      }
      breakpoints = parseInsertionBreakpoints(match[2]);
      break;
  }
  return { type, chromosome: match[1], breakpoints };
}

function parseIsochromosome(part: string): ParsedAbnormality {
  const short = part.match(/^i\((\d{1,2}|[XY])([pq])\)$/);
  if (short) {
    return {
      type: "i",
      chromosome: short[1],
      breakpoints: [{
        arm: short[2],
        region: 1,
        band: 0,
        subband: null,
        uncertain: false,
      }],
    };
  }
  const long = part.match(/^i\((\d{1,2}|[XY])\)\(([^)]+)\)$/);
  if (long) {
    return {
      type: "i",
      chromosome: long[1],
      breakpoints: [parseBreakpoint(long[2])],
    };
  }
  throw new ParseError(`Invalid isochromosome format: '${part}'`);
}

function parseRing(part: string): ParsedAbnormality {
  const simple = part.match(/^r\((\d{1,2}|[XY])\)$/);
  if (simple) {
    return { type: "r", chromosome: simple[1], breakpoints: [] };
  }
  const located = part.match(/^r\((\d{1,2}|[XY])\)\(([^)]+)\)$/);
  if (located) {
    return {
      type: "r",
      chromosome: located[1],
      breakpoints: parseBreakpoints(located[2]),
    };
  }
  throw new ParseError(`Invalid ring chromosome format: '${part}'`);
}

function parseAbnormality(part: string): ParsedAbnormality {
  const numerical = part.match(/^([+-])(\d{1,2}|[XY])(c)?$/);
  if (numerical) {
    return {
      type: numerical[1] + (numerical[3] === "c" ? "c" : ""),
      chromosome: numerical[2],
      breakpoints: [],
    };
  }
  if (["idem", "sl", "sdl", "dmin", "hsr", "inc"].includes(part)) {
    return { type: part, chromosome: "", breakpoints: [] };
  }
  for (const definition of STRUCTURAL_PATTERNS) {
    if (!part.startsWith(`${definition[0]}(`)) continue;
    const match = part.match(definition[1]);
    if (!match) {
      throw new ParseError(`Invalid ${definition[3]} format: '${part}'`);
    }
    return structuralAbnormality(part, definition, match);
  }
  if (part.startsWith("i(")) return parseIsochromosome(part);
  if (part.startsWith("r(")) return parseRing(part);
  const marker = part.match(/^\+(\d*)mar(\d*)$/);
  if (marker) {
    return {
      type: "+mar",
      chromosome: "mar" + (marker[2] || ""),
      breakpoints: [],
      copy_count: marker[1] ? parseInt(marker[1], 10) : null,
    };
  }
  for (const definition of OPTIONAL_PATTERNS) {
    const match = part.match(definition[1]);
    if (match) return structuralAbnormality(part, definition, match);
  }
  for (const [type, pattern] of CHROMOSOME_ONLY_PATTERNS) {
    const match = part.match(pattern);
    if (match) {
      const parsed: ParsedAbnormality = {
        type,
        chromosome: match[1],
        breakpoints: [],
      };
      if (type === "upd" && match[2]) parsed.inheritance = match[2];
      return parsed;
    }
  }
  return { type: "unknown", chromosome: "", breakpoints: [] };
}

function parseWithMetadata(raw: string): Abnormality {
  let part = raw.replaceAll("−", "-");
  const uncertain = part.startsWith("?");
  if (uncertain) part = part.slice(1);
  const copy = part.match(/[x×](\d+)$/);
  const copyCount = copy ? Number(copy[1]) : null;
  if (copyCount !== null && (!Number.isSafeInteger(copyCount) || copyCount <= 0)) {
    throw new ParseError("Abnormality copy count must be a positive safe integer");
  }
  if (copy) part = part.slice(0, -copy[0].length);
  const inheritance =
    ["umat", "upat", "mat", "pat", "dn"].find((suffix) =>
      part.endsWith(suffix)
    ) ?? null;
  if (inheritance) part = part.slice(0, -inheritance.length);
  const {
    type,
    chromosome,
    breakpoints,
    inheritance: parsedInheritance = inheritance,
    copy_count: parsedCopyCount = copyCount,
  } = parseAbnormality(part);
  return {
    type,
    chromosome,
    breakpoints,
    inheritance: parsedInheritance,
    uncertain,
    copy_count: parsedCopyCount,
    raw,
  };
}

export function parseAbnormalities(parts: string[]): Abnormality[] {
  return parts.map((part) => part.trim()).filter(Boolean).map(
    parseWithMetadata,
  );
}
