const fs = require("fs");
const admin = require("firebase-admin");

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
const OUT = process.argv[2] || "missing_ms_stars.csv";

function csvEscape(v) {
  const s = (v ?? "").toString();
  if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: PROJECT_ID,
      credential: admin.credential.applicationDefault(),
    });
  }

  const db = admin.firestore();
  const snap = await db.collection("funds_v3").get();

  const rows = [];
  let total = 0;

  snap.forEach((doc) => {
    total++;
    const d = doc.data() || {};
    const isin = doc.id;
    const name = d.name || d.legal_name || "";
    const stars = d?.ms?.rating_stars ?? null;
    const overall = d?.ms?.rating_overall ?? null;

    const missing = stars === null || stars === undefined || stars === "" || Number.isNaN(Number(stars));
    if (missing) {
      rows.push({ isin, name, rating_stars: stars, rating_overall: overall });
    }
  });

  const header = ["isin", "name", "rating_stars", "rating_overall"];
  const lines = [header.join(",")].concat(
    rows.map((r) => header.map((k) => csvEscape(r[k])).join(","))
  );

  fs.writeFileSync(OUT, lines.join("\n"), "utf8");

  console.log(`Total fondos funds_v3: ${total}`);
  console.log(`Sin ms.rating_stars: ${rows.length}`);
  console.log(`Guardado: ${OUT}`);
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
