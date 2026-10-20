import type { Breakpoint } from "./types.js";
import { ParseError } from "./parse-error.js";

const BREAKPOINT_PATTERN = /^([pq])([1-9][0-9]?)(?:\.(\d+))?(\?)?$/;
const DOUBLE_BREAKPOINT_PATTERN = /^([pq]\d+(?:\.\d+)?\??)([pq]\d+(?:\.\d+)?\??)$/;
const UNCERTAIN_PAIR_PATTERN = /^([pq]\d+(?:\.\d+)?\??)([pq]\d+(?:\.\d+)?\??)$/;

export function parseBreakpoint(value: string): Breakpoint {
  const match = value.match(BREAKPOINT_PATTERN);
  if (!match) {
    throw new ParseError(`Invalid breakpoint format: '${value}'`);
  }
  const regionBand = match[2];
  return {
    arm: match[1],
    region: parseInt(regionBand[0], 10),
    band: regionBand.length >= 2 ? parseInt(regionBand.slice(1), 10) : null,
    subband: match[3] || null,
    uncertain: match[4] === "?",
  };
}

export function parseBreakpoints(value: string): Breakpoint[] {
  const pair = value.match(UNCERTAIN_PAIR_PATTERN);
  return pair ? pair.slice(1).map(parseBreakpoint) : [parseBreakpoint(value)];
}

export function parseMultipleBreakpoints(value: string): Breakpoint[] {
  return value.split(";").map((bp) => parseBreakpoint(bp.trim()));
}

export function parseDoubleBreakpoints(
  value: string,
  label: string,
  raw: string,
): Breakpoint[] {
  const pair = value.match(DOUBLE_BREAKPOINT_PATTERN);
  if (!pair) {
    throw new ParseError(`${label} requires two breakpoints: '${raw}'`);
  }
  return pair.slice(1).map(parseBreakpoint);
}

export function parseInsertionBreakpoints(value: string): Breakpoint[] {
  if (value.includes(";")) {
    const parts = value.split(";");
    if (parts.length !== 2) throw new ParseError(`Invalid insertion breakpoints: '${value}'`);
    const first = parseBreakpoint(parts[0].trim());
    const segment = parts[1].trim();
    const pair = segment.match(DOUBLE_BREAKPOINT_PATTERN);
    return [
      first,
      ...(pair
        ? pair.slice(1).map(parseBreakpoint)
        : [parseBreakpoint(segment)]),
    ];
  }
  const triple = value.match(
    /^([pq]\d+(?:\.\d+)?\??)([pq]\d+(?:\.\d+)?\??)([pq]\d+(?:\.\d+)?\??)$/,
  );
  if (!triple) {
    throw new ParseError(`Invalid insertion breakpoints: '${value}'`);
  }
  return triple.slice(1).map(parseBreakpoint);
}
