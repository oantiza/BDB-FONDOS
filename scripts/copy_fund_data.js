const admin = require("firebase-admin");

try {
    const serviceAccount = require("./service-account.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
} catch (e) {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
    }
}

const db = admin.firestore();

async function main() {
    const SOURCE_ISIN = "ES0159201013";
    const TARGET_ISIN = "AAAAAAAAAAA";

    console.log(`Copying data from ${SOURCE_ISIN} to ${TARGET_ISIN}...`);

    // 1. Fetch Source Docs
    const srcFundRef = db.collection("funds_v3").doc(SOURCE_ISIN);
    const srcHistRef = db.collection("historico_vl_v2").doc(SOURCE_ISIN);

    const [srcFundSnap, srcHistSnap] = await Promise.all([
        srcFundRef.get(),
        srcHistRef.get()
    ]);

    if (!srcFundSnap.exists) {
        console.error(`Source Fund ${SOURCE_ISIN} not found in funds_v3`);
        return;
    }

    // 2. Prepare Fund Data Update
    const srcData = srcFundSnap.data();

    // Fields to copy (exclude identity and name)
    const updateData = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Copy complex objects if they exist
    const fieldsToCopy = ['ms', 'derived', 'metrics', 'std_perf', 'std_extra', 'manual', 'quality', 'currency', 'asset_class', 'category_morningstar'];

    fieldsToCopy.forEach(field => {
        if (srcData[field] !== undefined) {
            updateData[field] = srcData[field];
        }
    });

    // Special case: Ensure we don't overwrite name if we want to keep "CARTERA BOLSA"
    // The user said "COPIA LOS DATOS", usually meaning technical data. 
    // We will preserve the name "CARTERA BOLSA" if it exists in target, else copy source name.
    // Actually, we are updating, so if we don't include 'name' in updateData, the existing name stays.
    // We do NOT include 'name' or 'isin' in updateData.

    // 3. Update Target Fund
    await db.collection("funds_v3").doc(TARGET_ISIN).update(updateData);
    console.log(`Updated funds_v3/${TARGET_ISIN} with data from source.`);

    // 4. Update Target History
    if (srcHistSnap.exists) {
        const srcHistData = srcHistSnap.data();
        const histPayload = {
            isin: TARGET_ISIN,
            currency: srcHistData.currency || "EUR",
            history: srcHistData.history || [],
            source: `copy_from_${SOURCE_ISIN}`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (srcHistData.series) histPayload.series = srcHistData.series; // Copy legacy if exists

        await db.collection("historico_vl_v2").doc(TARGET_ISIN).set(histPayload);
        console.log(`Overwritten historico_vl_v2/${TARGET_ISIN} with history from source (${(histPayload.history || []).length} points).`);
    } else {
        console.warn(`Source History ${SOURCE_ISIN} not found. Target history not updated.`);
    }

    console.log("Copy operation complete.");
}

main().catch(console.error);
