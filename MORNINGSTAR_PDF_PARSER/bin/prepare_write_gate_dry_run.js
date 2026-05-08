#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const {
  DECISIONS,
  buildWriteGatePlan,
  ensureDir,
  normalizeIsin,
  readJson,
  writeGateArtifacts,
} = require("../src/lib/write_gate");

const repoRoot = path.resolve(__dirname, "..", "..");

function printHelp() {
  console.log(`BDB Parser Write Gate Dry-Run

Genera diff/manifests para un futuro write controlado. Este CLI no escribe en Firestore.

Opciones:
  --parser-artifact <path>      Artifact parser dry-run JSON.
  --classification <path>       Policy classification JSON.
  --output-dir <path>           Carpeta de manifests.
  --approve-isin <ISIN>         Aprueba un REVIEW por ISIN. Repetible o CSV.
  --max-write-candidates <n>    Limite de candidatos. Default: 5.
  --current-docs-dir <path>     Snapshots JSON locales por ISIN para diff offline.
  --fetch-snapshots             Lee Firestore solo lectura para los ISINs indicados.
  --only-isin <ISIN>            Limita el gate a un ISIN. Repetible o CSV.
  --snapshot-limit <n>          Maximo de snapshots Firestore read-only. Default: 5.
  --collection <name>           Coleccion Firestore. Default: funds_v3.
  --project <id>                Project ID para ADC si hace falta. Default: bdb-fondos.
  --help                        Muestra esta ayuda.

Default:
  --parser-artifact MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_latest.json
  --classification artifacts/bdb_parser_audit/parser_dryrun_medium_policy_classification.json
  --output-dir MORNINGSTAR_PDF_PARSER/artifacts/write_gate
`);
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {
    parserArtifact: "MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_latest.json",
    classification: "artifacts/bdb_parser_audit/parser_dryrun_medium_policy_classification.json",
    outputDir: "MORNINGSTAR_PDF_PARSER/artifacts/write_gate",
    approvedIsins: [],
    onlyIsins: [],
    maxWriteCandidates: 5,
    snapshotLimit: 5,
    currentDocsDir: null,
    fetchSnapshots: false,
    collection: "funds_v3",
    project: "bdb-fondos",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case "--parser-artifact":
        args.parserArtifact = argv[++index];
        break;
      case "--classification":
        args.classification = argv[++index];
        break;
      case "--output-dir":
        args.outputDir = argv[++index];
        break;
      case "--approve-isin":
        args.approvedIsins.push(...splitList(argv[++index]));
        break;
      case "--max-write-candidates":
        args.maxWriteCandidates = Number(argv[++index]);
        break;
      case "--current-docs-dir":
        args.currentDocsDir = argv[++index];
        break;
      case "--fetch-snapshots":
        args.fetchSnapshots = true;
        break;
      case "--only-isin":
        args.onlyIsins.push(...splitList(argv[++index]));
        break;
      case "--snapshot-limit":
        args.snapshotLimit = Number(argv[++index]);
        break;
      case "--collection":
        args.collection = argv[++index];
        break;
      case "--project":
        args.project = argv[++index];
        break;
      case "--write":
      case "--confirm-write":
        throw new Error("WRITE_FLAGS_FORBIDDEN_IN_DRY_RUN_GATE");
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        throw new Error(`UNKNOWN_ARG: ${token}`);
    }
  }

  args.approvedIsins = args.approvedIsins.map(normalizeIsin).filter(Boolean);
  args.onlyIsins = args.onlyIsins.map(normalizeIsin).filter(Boolean);

  if (!Number.isFinite(args.maxWriteCandidates) || args.maxWriteCandidates < 0) {
    throw new Error("INVALID_ARG: --max-write-candidates must be a non-negative number");
  }
  if (!Number.isFinite(args.snapshotLimit) || args.snapshotLimit < 0) {
    throw new Error("INVALID_ARG: --snapshot-limit must be a non-negative number");
  }
  if (args.fetchSnapshots && args.onlyIsins.length === 0) {
    throw new Error("FETCH_SNAPSHOTS_REQUIRES_ONLY_ISIN");
  }
  if (args.fetchSnapshots && args.onlyIsins.length > args.snapshotLimit) {
    throw new Error("FETCH_SNAPSHOTS_LIMIT_EXCEEDED");
  }

  return args;
}

function resolveFromRepo(value) {
  if (!value) return value;
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

function loadCurrentDocsFromDir(currentDocsDir) {
  if (!currentDocsDir) return {};

  const resolvedDir = resolveFromRepo(currentDocsDir);
  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`CURRENT_DOCS_DIR_NOT_FOUND: ${resolvedDir}`);
  }

  const docs = {};
  for (const file of fs.readdirSync(resolvedDir)) {
    if (!file.toLowerCase().endsWith(".json")) continue;
    const filePath = path.join(resolvedDir, file);
    const parsed = readJson(filePath);
    const isin = normalizeIsin(parsed.isin || path.basename(file, ".json"));
    if (!isin) continue;
    docs[isin] = parsed;
  }
  return docs;
}

function filterArtifactsByIsin(parserArtifact, classificationArtifact, onlyIsins) {
  if (!onlyIsins || onlyIsins.length === 0) {
    return { parserArtifact, classificationArtifact };
  }

  const allowed = new Set(onlyIsins.map(normalizeIsin));
  const proposed = {};
  for (const [isin, payload] of Object.entries(parserArtifact.proposed_payload_by_isin || {})) {
    const normalized = normalizeIsin(isin || (payload && payload.isin));
    if (allowed.has(normalized)) {
      proposed[normalized] = payload;
    }
  }

  const rows = Array.isArray(classificationArtifact.rows)
    ? classificationArtifact.rows.filter((row) => allowed.has(normalizeIsin(row.isin || row.ISIN)))
    : [];

  return {
    parserArtifact: {
      ...parserArtifact,
      proposed_payload_by_isin: proposed,
      isins_processed: (parserArtifact.isins_processed || []).filter((isin) =>
        allowed.has(normalizeIsin(isin))
      ),
    },
    classificationArtifact: {
      ...classificationArtifact,
      rows,
    },
  };
}

function serializeFirestoreData(data) {
  if (!data) return null;
  return JSON.parse(JSON.stringify(data));
}

function initFirestoreReadOnly(projectId) {
  const admin = require("firebase-admin");
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: projectId || undefined,
    });
  }
  return admin.firestore();
}

async function fetchFirestoreSnapshots({ isins, collection, projectId, timestamp }) {
  const db = initFirestoreReadOnly(projectId);
  const snapshots = {};

  for (const isin of isins) {
    let docSnapshot = await db.collection(collection).doc(isin).get();
    let lookupStrategy = "document_id";
    let documentId = isin;

    if (!docSnapshot.exists) {
      const querySnapshot = await db.collection(collection).where("isin", "==", isin).limit(1).get();
      lookupStrategy = "isin_field_query";
      if (!querySnapshot.empty) {
        docSnapshot = querySnapshot.docs[0];
        documentId = docSnapshot.id;
      }
    }

    const documentExists = Boolean(docSnapshot && docSnapshot.exists);
    snapshots[isin] = {
      isin,
      document_exists: documentExists,
      document_id: documentExists ? documentId : null,
      current_firestore_doc: documentExists ? serializeFirestoreData(docSnapshot.data() || {}) : null,
      timestamp,
      source: `${collection} read-only`,
      lookup_strategy: lookupStrategy,
      dry_run: true,
      write_executed: false,
    };
  }

  return snapshots;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const parserArtifactPath = resolveFromRepo(args.parserArtifact);
  const classificationPath = resolveFromRepo(args.classification);
  const outputDir = resolveFromRepo(args.outputDir);

  const loadedParserArtifact = readJson(parserArtifactPath);
  const loadedClassificationArtifact = readJson(classificationPath);
  const { parserArtifact, classificationArtifact } = filterArtifactsByIsin(
    loadedParserArtifact,
    loadedClassificationArtifact,
    args.onlyIsins
  );
  const currentDocsByIsin = loadCurrentDocsFromDir(args.currentDocsDir);

  if (args.fetchSnapshots) {
    Object.assign(
      currentDocsByIsin,
      await fetchFirestoreSnapshots({
        isins: args.onlyIsins,
        collection: args.collection,
        projectId: args.project,
        timestamp: new Date().toISOString(),
      })
    );
  }

  ensureDir(outputDir);
  const plan = buildWriteGatePlan({
    parserArtifact,
    classificationArtifact,
    currentDocsByIsin,
    approvedIsins: args.approvedIsins,
    maxWriteCandidates: args.maxWriteCandidates,
  });
  const written = writeGateArtifacts({ plan, outputDir });

  console.log("PARSER_WRITE_GATE_DRY_RUN_ONLY");
  console.log(`dry_run=${plan.dry_run}`);
  console.log(`write_executed=${plan.write_executed}`);
  console.log(`write_candidates=${plan.counts[DECISIONS.WRITE_CANDIDATE] || 0}`);
  console.log(`review_requires_approval=${plan.counts[DECISIONS.REVIEW_REQUIRES_EXPLICIT_APPROVAL] || 0}`);
  console.log(`blocked=${plan.counts[DECISIONS.BLOCKED_NEVER_WRITE] || 0}`);
  console.log(`approval_rejections=${plan.approval_rejections.length}`);
  console.log(`snapshots_loaded=${Object.keys(currentDocsByIsin).length}`);
  console.log(`output_dir=${written.output_dir}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  fetchFirestoreSnapshots,
  filterArtifactsByIsin,
  initFirestoreReadOnly,
  loadCurrentDocsFromDir,
  parseArgs,
  resolveFromRepo,
};
