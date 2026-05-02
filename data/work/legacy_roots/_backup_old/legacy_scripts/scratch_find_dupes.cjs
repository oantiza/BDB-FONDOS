const fs = require('fs');
const lines = fs.readFileSync('cargador_lotes_v_2.js', 'utf8').split('\n');

const targets = [
  'const REGION_MAPPINGS =',
  'const IGNORE_KEYS =',
  'const REGION_LOOKUP =',
  'function cleanRegionKey',
  'function normalizeRegions',
  'function normalizeSectors',
  'function deriveAssetClassFromCategory',
  'function derivePrimaryRegion',
  'function deriveSubcategories',
  'function topSector',
  'function deriveAssetSubtype',
  'function deriveFlags',
  'async function extraerMSConGemini',
  'const manifestEntries =',
  'async function processPdfFile'
];

for (const target of targets) {
  const found = [];
  lines.forEach((line, i) => {
    if (line.includes(target)) found.push(i + 1);
  });
  console.log(`${target}: [${found.join(', ')}]`);
}
