/**
 * update_ms_stars_funds_v3.js
 *
 * - Lee CSV de Morningstar (ISIN + Morningstar Rating™) o CSV genérico (isin + rating_stars)
 * - Actualiza SOLO: funds_v3/{isin}.ms.rating_stars
 * - Añade trazabilidad: ms.rating_source, ms.rating_updatedAt
 * - DRY-RUN por defecto
 * - Usa --apply para escribir
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const APPLY = process.argv.includes("--apply");
const INPUT = process.argv[2] || "MorningstarIWT_ExcelExport (1).csv";
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;

function normIsin(x) {
  return String(x || "").trim().toUpperCase();
}

function normStars(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  // Morningstar Rating son estrellas 1-5 (a veces 0 = no rating). Aceptamos 0-5.
  if (n < 0 || n > 5) return null;
  // si viene 3.0, lo dejamos como 3
  return Math.round(n);
}

// CSV parser simple que soporta comillas
function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // "" dentro de quoted field => "
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }

    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCSV(file) {
  const raw = fs.readFileSync(file, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return [];

  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const delim = headerLine.includes(";") ? ";" : ",";

  function splitLine(line) {
    const out = [];
    let cur = "";
    let inQ = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
        continue;
      }

      if (ch === delim && !inQ) {
        out.push(cur);
        cur = "";
        continue;
      }

      cur += ch;
    }
    out.push(cur);
    return out;
  }

  const headers = splitLine(headerLine).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const cols = splitLine(line);
    const o = {};
    headers.forEach((h, i) => (o[h] = (cols[i] ?? "").trim()));
    return o;
  });
}

function pickField(row, candidates) {
  for (const k of candidates) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return null;
}

async function main() {
  if (!fs.existsSync(INPUT)) {
    throw new Error(`No existe el fichero: ${INPUT}`);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: PROJECT_ID,
      credential: admin.credential.applicationDefault(),
    });
  }

  const db = admin.firestore();
  const col = db.collection("funds_v3");

  const rows = parseCSV(INPUT);

  // Detecta columnas posibles
  const isinCandidates = ["isin", "ISIN", "\ufeffISIN", "﻿ISIN"];
  const starsCandidates = ["rating_stars", "Morningstar Rating™", "Morningstar Rating", "Morningstar Rating™ "];

  const map = new Map();
  const dupes = [];

  for (const r of rows) {
    const isinRaw = pickField(r, isinCandidates);
    const starsRaw = pickField(r, starsCandidates);

    const isin = normIsin(isinRaw);
    const stars = normStars(starsRaw);

    if (!isin) continue;

    if (map.has(isin)) dupes.push(isin);
    map.set(isin, stars);
  }

  if (dupes.length) {
    console.log(
      `⚠️ Duplicados en CSV (se queda el último): ${[...new Set(dupes)].slice(0, 15).join(", ")}${
        dupes.length > 15 ? "..." : ""
      }`
    );
  }

  const updates = [];
  const missing = [];
  const unchanged = [];

  const bulk = db.bulkWriter();
  bulk.onWriteError((err) => {
    console.error("WriteError:", err.documentRef.path, err.message);
    if (err.failedAttempts < 3) return true;
    return false;
  });

  for (const [isin, stars] of map.entries()) {
    const ref = col.doc(isin);
    const snap = await ref.get();

    if (!snap.exists) {
      missing.push(isin);
      continue;
    }

    const data = snap.data() || {};
    const current = data?.ms?.rating_stars ?? null;

    if (current === stars) {
      unchanged.push(isin);
      continue;
    }

    updates.push({ isin, from: current, to: stars });

    if (APPLY) {
      bulk.update(ref, {
        "ms.rating_stars": stars, // null si no hay rating
        "ms.rating_source": path.basename(INPUT),
        "ms.rating_updatedAt": admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  if (APPLY) await bulk.close();

  console.log("\n=== RESUMEN ===");
  console.table({
    mode: APPLY ? "APPLY" : "DRY-RUN",
    input: INPUT,
    unique_isins: map.size,
    updates: updates.length,
    missing_in_funds_v3: missing.length,
    unchanged: unchanged.length,
  });

  fs.writeFileSync(
    "ms_stars_update_report.json",
    JSON.stringify(
      {
        mode: APPLY ? "APPLY" : "DRY-RUN",
        input: INPUT,
        updates_preview: updates.slice(0, 80),
        missing_sample: missing.slice(0, 80),
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("✅ Report guardado en ms_stars_update_report.json");

  if (!APPLY) {
    console.log(`\n(DRY-RUN) Para aplicar:`);
    console.log(`node update_ms_stars_funds_v3.js "${INPUT}" --apply`);
  }
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
