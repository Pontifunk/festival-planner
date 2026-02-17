#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const I18N_DIR = path.join(ROOT, "i18n");
const REPORTS_DIR = path.join(ROOT, "reports");
const DE_PATH = path.join(I18N_DIR, "de.json");
const EN_PATH = path.join(I18N_DIR, "en.json");

const SCAN_DIRS = [
  ROOT,
  path.join(ROOT, "tomorrowland"),
  path.join(ROOT, "legal"),
  path.join(ROOT, "about"),
  path.join(ROOT, "privacy"),
  path.join(ROOT, "impressum"),
  path.join(ROOT, "changelog")
];

const SKIP_DIR_NAMES = new Set([".git", "node_modules", "dist", "data", "icons", "reports"]);
const FILE_EXTENSIONS = new Set([".html", ".js", ".mjs", ".cjs"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectFiles(startDir, out = [], seen = new Set()) {
  if (!fs.existsSync(startDir)) return out;
  const real = fs.realpathSync(startDir);
  if (seen.has(real)) return out;
  seen.add(real);

  const entries = fs.readdirSync(startDir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      collectFiles(full, out, seen);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (FILE_EXTENSIONS.has(ext)) out.push(full);
  }
  return out;
}

function getLineNumber(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function addUsage(map, key, file, line) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push({ file: path.relative(ROOT, file).replaceAll("\\", "/"), line });
}

function extractKeysFromContent(content, file, usageMap) {
  const attrRegex = /data-i18n(?:-placeholder|-aria-label|-title)?\s*=\s*["']([a-z0-9_.-]+)["']/gi;
  const tRegex = /\bt\(\s*["']([a-z0-9_.-]+)["']\s*\)/gi;

  for (const regex of [attrRegex, tRegex]) {
    let match;
    while ((match = regex.exec(content))) {
      const key = match[1];
      addUsage(usageMap, key, file, getLineNumber(content, match.index));
    }
  }
}

function placeholdersOf(value) {
  if (typeof value !== "string") return [];
  return Array.from(new Set((value.match(/\{[a-zA-Z0-9_]+\}/g) || []).sort()));
}

function findNearDuplicates(allKeys) {
  const hits = [];
  const normalized = new Map();
  for (const key of allKeys) {
    const norm = key.replace(/[_.-]+/g, "");
    if (!normalized.has(norm)) normalized.set(norm, []);
    normalized.get(norm).push(key);
  }
  for (const list of normalized.values()) {
    if (list.length > 1) hits.push(list.sort());
  }
  return hits.sort((a, b) => a[0].localeCompare(b[0]));
}

function collectTerminologyIssues(dictDe, dictEn) {
  const issues = [];
  for (const [key, value] of Object.entries(dictDe)) {
    if (typeof value !== "string") continue;
    if (/Group Merge/i.test(value)) {
      issues.push({ key, lang: "de", issue: "DE-Wert enthält englischen Begriff 'Group Merge'" });
    }
  }
  for (const [key, value] of Object.entries(dictEn)) {
    if (typeof value !== "string") continue;
    if (/Gruppenabgleich/i.test(value)) {
      issues.push({ key, lang: "en", issue: "EN-Wert enthält deutschen Begriff 'Gruppenabgleich'" });
    }
  }
  return issues;
}

function toMarkdown(report) {
  const lines = [];
  lines.push("# i18n Audit Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push("## Missing keys");
  lines.push("");
  lines.push("| Key | Missing in | Used in | Suggested translation |");
  lines.push("|---|---|---|---|");
  if (!report.missingKeys.length) {
    lines.push("| - | - | - | - |");
  } else {
    for (const row of report.missingKeys) {
      lines.push(`| ${row.key} | ${row.missingIn.join(", ")} | ${row.usedIn || "-"} | ${row.suggestedTranslation || "-"} |`);
    }
  }
  lines.push("");
  lines.push("## Unused keys");
  lines.push("");
  lines.push("| Key | Present in |");
  lines.push("|---|---|");
  if (!report.unusedKeys.length) {
    lines.push("| - | - |");
  } else {
    for (const row of report.unusedKeys) {
      lines.push(`| ${row.key} | ${row.presentIn.join(", ")} |`);
    }
  }
  lines.push("");
  lines.push("## Placeholder mismatches");
  lines.push("");
  lines.push("| Key | de placeholders | en placeholders |");
  lines.push("|---|---|---|");
  if (!report.placeholderMismatches.length) {
    lines.push("| - | - | - |");
  } else {
    for (const row of report.placeholderMismatches) {
      lines.push(`| ${row.key} | ${row.de.join(" ")} | ${row.en.join(" ")} |`);
    }
  }
  lines.push("");
  lines.push("## Terminology inconsistencies");
  lines.push("");
  if (!report.terminologyInconsistencies.length) {
    lines.push("- none");
  } else {
    for (const issue of report.terminologyInconsistencies) {
      lines.push(`- ${issue.lang}:${issue.key} - ${issue.issue}`);
    }
  }
  lines.push("");
  lines.push("## Near duplicate keys (best effort)");
  lines.push("");
  if (!report.nearDuplicateKeys.length) {
    lines.push("- none");
  } else {
    for (const list of report.nearDuplicateKeys) {
      lines.push(`- ${list.join(", ")}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function main() {
  const de = readJson(DE_PATH);
  const en = readJson(EN_PATH);

  const usageMap = new Map();
  const files = Array.from(new Set(SCAN_DIRS.flatMap((d) => collectFiles(d))));
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    extractKeysFromContent(content, file, usageMap);
  }

  const deKeys = new Set(Object.keys(de));
  const enKeys = new Set(Object.keys(en));
  const usedKeys = new Set(usageMap.keys());
  const allDictKeys = new Set([...deKeys, ...enKeys]);

  const missingKeys = [];
  for (const key of usedKeys) {
    const missingIn = [];
    if (!deKeys.has(key)) missingIn.push("de");
    if (!enKeys.has(key)) missingIn.push("en");
    if (!missingIn.length) continue;
    const uses = usageMap.get(key) || [];
    const firstUse = uses[0];
    missingKeys.push({
      key,
      missingIn,
      usedIn: firstUse ? `${firstUse.file}:${firstUse.line}` : "",
      suggestedTranslation: ""
    });
  }

  const unusedKeys = [];
  for (const key of allDictKeys) {
    if (usedKeys.has(key)) continue;
    const presentIn = [];
    if (deKeys.has(key)) presentIn.push("de");
    if (enKeys.has(key)) presentIn.push("en");
    unusedKeys.push({ key, presentIn });
  }

  const placeholderMismatches = [];
  for (const key of allDictKeys) {
    if (!(deKeys.has(key) && enKeys.has(key))) continue;
    const dePh = placeholdersOf(de[key]);
    const enPh = placeholdersOf(en[key]);
    if (JSON.stringify(dePh) !== JSON.stringify(enPh)) {
      placeholderMismatches.push({ key, de: dePh, en: enPh });
    }
  }

  const terminologyInconsistencies = collectTerminologyIssues(de, en);
  const nearDuplicateKeys = findNearDuplicates([...allDictKeys]);

  missingKeys.sort((a, b) => a.key.localeCompare(b.key));
  unusedKeys.sort((a, b) => a.key.localeCompare(b.key));
  placeholderMismatches.sort((a, b) => a.key.localeCompare(b.key));

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalUsedKeys: usedKeys.size,
      totalDictKeys: allDictKeys.size,
      missingKeyCount: missingKeys.length,
      unusedKeyCount: unusedKeys.length,
      placeholderMismatchCount: placeholderMismatches.length,
      terminologyIssueCount: terminologyInconsistencies.length
    },
    missingKeys,
    unusedKeys,
    placeholderMismatches,
    terminologyInconsistencies,
    nearDuplicateKeys
  };

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORTS_DIR, "i18n-report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(REPORTS_DIR, "i18n-report.md"), toMarkdown(report) + "\n", "utf8");

  console.log(`i18n audit: ${report.summary.missingKeyCount} missing, ${report.summary.placeholderMismatchCount} placeholder mismatch, ${report.summary.unusedKeyCount} unused.`);

  if (report.summary.missingKeyCount > 0 || report.summary.placeholderMismatchCount > 0) {
    process.exit(1);
  }
}

main();
