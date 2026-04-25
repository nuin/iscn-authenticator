import { gunzip } from "https://deno.land/x/compress@v0.4.5/mod.ts";

const UCSC_URL = "http://hgdownload.cse.ucsc.edu/goldenpath/hg38/database/cytoBand.txt.gz";

async function fetchBands() {
  console.log(`Fetching cytobands from ${UCSC_URL}...`);
  const response = await fetch(UCSC_URL);
  if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
  
  const compressed = new Uint8Array(await response.arrayBuffer());
  const decompressed = gunzip(compressed);
  const text = new TextDecoder().decode(decompressed);
  
  const lines = text.trim().split("\n");
  const bands: any = {};
  
  for (const line of lines) {
    const [chrom, start, end, name, stain] = line.split("\t");
    // Only autosomes and sex chromosomes
    if (!/^chr([1-9]|1[0-9]|2[0-2]|[XY])$/.test(chrom)) continue;
    
    const chrName = chrom.replace("chr", "");
    if (!bands[chrName]) bands[chrName] = [];
    
    bands[chrName].push({
      name,
      start: parseInt(start),
      end: parseInt(end),
      stain
    });
  }
  
  const outDir = "packages/core/data/ideogram";
  await Deno.mkdir(outDir, { recursive: true });
  await Deno.writeTextFile(`${outDir}/bands.json`, JSON.stringify(bands, null, 2));
  
  console.log(`Processed ${Object.keys(bands).length} chromosomes. Saved to ${outDir}/bands.json`);
}

fetchBands();
