/* update_retrocessions_funds_v3.js
   - Lee exportar retros.xlsx (Hoja1: isin, retro)
   - Actualiza SOLO funds_v3/{isin}.manual.costs.retrocession
   - DRY-RUN por defecto. Usa --apply para aplicar.
*/

const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const admin = require("firebase-admin");

const APPLY = process.argv.includes("--apply");
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT; // opcional
const INPUT_XLSX = process.argv[2] || "exportar retros.xlsx";

function normIsin(x) {
  return String(x || "").trim().toUpperCase();
}

// retro viene en decimal (0.005 = 0.5%). Aun así, normalizamos defensivo:
// - Si alguien metiera "0.5%" o "0,5%" lo intenta parsear.
// - Si viniera 0.5 (50%) lo convertimos a 0.005 solo si parece porcentaje ( > 1.5 )
function normRetro(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v > 1.5) return v / 100;     // 5 -> 0.05
    return v;                        // 0.005 -> 0.005
  }
  const s = String(v).trim().replace("%", "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n > 1.5) return n / 100;
  return n;
}

async function main() {
  if (!fs.existsSync(INPUT_XLSX)) {
    throw new Error(`No existe el fichero: ${INPUT_XLSX}`);
  }

  // Firebase Admin (usa ADC si estás logueado con gcloud, o GOOGLE_APPLICATION_CREDENTIALS)
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: PROJECT_ID,
      credential: admin.credential.applicationDefault(),
    });
  }

  const db = admin.firestore();
  const col = db.collection("funds_v3");

  const wb = XLSX.readFile(INPUT_XLSX);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

  // Construye mapa ISIN -> retro
  const map = new Map();
  const dupes = [];
  for (const r of rows) {
    const isin = normIsin(r.isin);
    const retro = normRetro(r.retro);
    if (!isin) continue;

    if (map.has(isin)) dupes.push(isin);
    map.set(isin, retro);
  }

  console.log(`Filas leídas: ${rows.length}`);
  console.log(`ISIN únicos: ${map.size}`);
  if (dupes.length) console.log(`⚠️ Duplicados en Excel (se queda el último): ${[...new Set(dupes)].slice(0, 10).join(", ")}${dupes.length > 10 ? "..." : ""}`);

  // Lee docs existentes y prepara updates
  const toUpdate = [];
  const missing = [];
  const unchanged = [];

  // BulkWriter es lo más rápido y seguro
  const bulk = db.bulkWriter();
  bulk.onWriteError((err) => {
    console.error("WriteError:", err.documentRef.path, err.message);
    // reintenta algunas veces
    if (err.failedAttempts < 3) return true;
    return false;
  });

  for (const [isin, retro] of map.entries()) {
    const ref = col.doc(isin);
    const snap = await ref.get();
    if (!snap.exists) {
      missing.push(isin);
      continue;
    }

    const data = snap.data() || {};
    const current = data?.manual?.costs?.retrocession;

    // Si es igual, no hacemos nada
    if (current === retro) {
      unchanged.push(isin);
      continue;
    }

    toUpdate.push({ isin, from: current ?? null, to: retro });

    if (APPLY) {
      bulk.update(ref, {
        "manual.costs.retrocession": retro ?? null,
        "manual.costs.retrocession_source": path.basename(INPUT_XLSX),
        "manual.costs.retrocession_updatedAt": admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  if (APPLY) {
    await bulk.close();
  }

  // Report
  const report = {
    mode: APPLY ? "APPLY" : "DRY-RUN",
    input: INPUT_XLSX,
    total_excel_rows: rows.length,
    unique_isins: map.size,
    updates: toUpdate.length,
    missing_in_funds_v3: missing.length,
    unchanged: unchanged.length,
  };

  console.log("\n=== RESUMEN ===");
  console.table(report);

  // Guarda report detallado
  const out = {
    ...report,
    updates_detail: toUpdate.slice(0, 50),
    missing_sample: missing.slice(0, 50),
  };
  fs.writeFileSync("retro_update_report.json", JSON.stringify(out, null, 2), "utf8");
  console.log("✅ Report guardado en retro_update_report.json");

  if (!APPLY) {
    console.log("\n(Esto fue DRY-RUN) Para aplicar de verdad:");
    console.log(`node update_retrocessions_funds_v3.js "${INPUT_XLSX}" --apply`);
  }
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
