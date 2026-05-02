#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function listFiles(dir, suffix) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(suffix)).map((f) => path.join(dir, f));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

const VALID_STATUSES = new Set(["draft", "approved", "rejected", "deprecated"]);
const VALID_OPS = new Set(["set", "unset", "append_unique", "remove_values"]);

function validateOverride(obj) {
  const errors = [];
  const required = ["schema_version", "override_id", "isin", "status", "author", "created_at", "reason", "operations"];

  for (const key of required) {
    if (!(key in obj)) errors.push(`missing:${key}`);
  }

  if (obj.status && !VALID_STATUSES.has(obj.status)) {
    errors.push(`invalid_status:${obj.status}`);
  }

  if (!Array.isArray(obj.operations) || !obj.operations.length) {
    errors.push("operations_empty");
  } else {
    obj.operations.forEach((op, i) => {
      if (!VALID_OPS.has(op.op)) errors.push(`op_${i}_invalid:${op.op}`);
      if (!op.path) errors.push(`op_${i}_missing_path`);
      if (!op.reason) errors.push(`op_${i}_missing_reason`);
    });
  }

  return errors;
}

const dir = path.resolve(process.argv[2] || "./05_overrides");
const files = listFiles(dir, ".override.json");

let bad = 0;

for (const file of files) {
  try {
    const obj = readJson(file);
    const errors = validateOverride(obj);
    if (errors.length) {
      bad++;
      console.error(`❌ ${path.basename(file)} -> ${errors.join(" | ")}`);
    } else {
      console.log(`✅ ${path.basename(file)}`);
    }
  } catch (e) {
    bad++;
    console.error(`❌ ${path.basename(file)} -> ${e.message}`);
  }
}

process.exit(bad ? 2 : 0);