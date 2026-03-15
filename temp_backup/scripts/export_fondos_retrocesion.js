/**
 * EXPORT FONDOS CON RETROCESIÓN
 * Busca en funds_v3 todos los fondos que tienen retrocesión > 0
 * y genera un archivo CSV con los resultados.
 * 
 * Ejecutar: node scripts/export_fondos_retrocesion.js
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Service account path
const SA_PATH = path.join(__dirname, "serviceAccountKey.json");

if (!fs.existsSync(SA_PATH)) {
    console.error("❌ No se encontró serviceAccountKey.json en", SA_PATH);
    process.exit(1);
}

const serviceAccount = require(SA_PATH);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();

async function main() {
    console.log("🔍 Buscando fondos con retrocesión en funds_v3...\n");

    const snapshot = await db.collection("funds_v3").get();
    console.log(`📝 Total documentos en funds_v3: ${snapshot.size}`);

    const funds = [];

    snapshot.forEach((doc) => {
        const data = doc.data();
        const retro = data.manual?.costs?.retrocession;

        if (retro !== undefined && retro !== null && retro > 0) {
            funds.push({
                isin: doc.id,
                name: data.name || data.fund_name || data.nombre || "N/A",
                retrocesion: retro,
                retrocesionPct: (retro * 100).toFixed(2),
                ter: data.manual?.costs?.ter || null,
                terPct: data.manual?.costs?.ter ? (data.manual.costs.ter * 100).toFixed(2) : "N/A",
                category: data.category || data.ms?.category || "N/A",
                currency: data.currency || data.ms?.currency || "N/A",
            });
        }
    });

    // Ordenar por retrocesión descendente
    funds.sort((a, b) => b.retrocesion - a.retrocesion);

    console.log(`\n✅ Fondos con retrocesión encontrados: ${funds.length}\n`);

    if (funds.length === 0) {
        console.log("No se encontraron fondos con retrocesión.");
        return;
    }

    // Generar CSV
    const separator = ";";
    const header = ["ISIN", "Nombre del Fondo", "Retrocesión (%)", "TER (%)", "Categoría", "Divisa"].join(separator);

    const rows = funds.map((f) => {
        const safeName = f.name.replace(/;/g, ",").replace(/"/g, '""');
        return [
            f.isin,
            `"${safeName}"`,
            f.retrocesionPct + "%",
            f.terPct !== "N/A" ? f.terPct + "%" : "N/A",
            f.category,
            f.currency,
        ].join(separator);
    });

    const csvContent = [header, ...rows].join("\n");

    // Guardar archivo
    const outputPath = path.join(__dirname, "..", "fondos_con_retrocesion.csv");
    fs.writeFileSync(outputPath, "\uFEFF" + csvContent, "utf-8"); // BOM for Excel compatibility

    console.log("─".repeat(60));
    console.log("📊 RESUMEN DE FONDOS CON RETROCESIÓN");
    console.log("─".repeat(60));

    // Mostrar tabla en consola
    console.log(`\n${"ISIN".padEnd(16)} ${"Retro %".padStart(8)}  Fondo`);
    console.log("─".repeat(60));
    funds.forEach((f) => {
        const shortName = f.name.length > 35 ? f.name.substring(0, 35) + "..." : f.name;
        console.log(`${f.isin.padEnd(16)} ${(f.retrocesionPct + "%").padStart(8)}  ${shortName}`);
    });

    console.log("─".repeat(60));
    console.log(`\n📁 Archivo guardado en: ${outputPath}`);
    console.log(`📊 Total fondos con retrocesión: ${funds.length}`);

    // Estadísticas adicionales
    const avgRetro = funds.reduce((sum, f) => sum + f.retrocesion, 0) / funds.length;
    const maxRetro = funds[0];
    const minRetro = funds[funds.length - 1];

    console.log(`\n📈 Estadísticas:`);
    console.log(`   Media retrocesión:  ${(avgRetro * 100).toFixed(2)}%`);
    console.log(`   Máxima retrocesión: ${maxRetro.retrocesionPct}% (${maxRetro.isin})`);
    console.log(`   Mínima retrocesión: ${minRetro.retrocesionPct}% (${minRetro.isin})`);
}

main()
    .then(() => {
        console.log("\n✅ Proceso completado.");
        process.exit(0);
    })
    .catch((e) => {
        console.error("❌ Error:", e);
        process.exit(1);
    });
