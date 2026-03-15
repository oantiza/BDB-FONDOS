const XLSX = require("xlsx");

const input = process.argv[2] || "exportar retros.xlsx";
const output = process.argv[3] || "exportar_retros_dedup.xlsx";

const wb = XLSX.readFile(input);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

const map = new Map();
for (const r of rows) {
  const isin = String(r.isin || "").trim().toUpperCase();
  if (!isin) continue;
  map.set(isin, { isin, retro: r.retro }); // se queda el último
}

const outRows = Array.from(map.values()).sort((a, b) => a.isin.localeCompare(b.isin));
const outWb = XLSX.utils.book_new();
const outWs = XLSX.utils.json_to_sheet(outRows);
XLSX.utils.book_append_sheet(outWb, outWs, "Hoja1");
XLSX.writeFile(outWb, output);

console.log(`OK: ${rows.length} filas -> ${outRows.length} ISIN únicos`);
console.log(`Guardado: ${output}`);
