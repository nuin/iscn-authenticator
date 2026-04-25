import bandsDataRaw from "../data/ideogram/bands.json" with { type: "json" };

export interface Band {
  name: string;
  start: number;
  end: number;
  stain: string;
}

export type ChromosomeBands = Record<string, Band[]>;

const bandsData = bandsDataRaw as unknown as ChromosomeBands;

/**
 * Returns the band data for a specific chromosome.
 * @param chrom - The chromosome name (e.g., "1", "X").
 */
export function getChromosomeBands(chrom: string): Band[] {
  return bandsData[chrom] || [];
}

/**
 * Maps an ISCN band string (e.g., "q13.1") to a base pair range on a chromosome.
 */
export function mapBandToRange(chrom: string, bandName: string): { start: number; end: number } | null {
  const bands = getChromosomeBands(chrom);
  if (bands.length === 0) return null;

  // Find all bands that are equal to or children of the requested band
  const matches = bands.filter(b => {
    // 1. Exact match (e.g., q13.1 === q13.1)
    if (b.name === bandName) return true;
    
    // 2. Parent-child match via dot (e.g., bandName="q11" matches b.name="q11.2")
    if (b.name.startsWith(bandName + ".")) return true;
    
    // 3. Subband match (e.g., bandName="q11.2" matches b.name="q11.21")
    // If the bandName already contains a dot, any continuation is hierarchical
    if (bandName.includes('.') && b.name.startsWith(bandName)) return true;
    
    return false;
  });

  if (matches.length === 0) return null;

  const start = Math.min(...matches.map(m => m.start));
  const end = Math.max(...matches.map(m => m.end));

  return { start, end };
}

/**
 * Returns all available chromosome names.
 */
export function getAvailableChromosomes(): string[] {
  return Object.keys(bandsData);
}
