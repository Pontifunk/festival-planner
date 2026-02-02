import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const IGNORE_DIRS = new Set([".git", "node_modules", "data", "icons"]);
const ALLOWED_TEXT = new Set(["DE", "EN", "FP", "W1", "W2"]);

async function collectHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      files.push(...await collectHtmlFiles(join(dir, entry.name)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

function hasLetters(text) {
  return /[A-Za-zÄÖÜäöüß]/.test(text);
}

async function collectFiles(dir, exts) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      files.push(...await collectFiles(join(dir, entry.name), exts));
      continue;
    }
    if (entry.isFile() && exts.some(ext => entry.name.endsWith(ext))) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

async function scanFile(file) {
  const content = await readFile(file, "utf8");
  const lines = content.split(/\r?\n/);
  const results = [];
  let inScript = false;
  let inStyle = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.includes("<script")) inScript = true;
    if (line.includes("<style")) inStyle = true;
    if (inScript || inStyle) {
      if (line.includes("</script>")) inScript = false;
      if (line.includes("</style>")) inStyle = false;
      continue;
    }
    if (line.includes("data-i18n") || line.includes("data-i18n-key")) continue;
    const matches = line.matchAll(/>([^<]+)</g);
    for (const match of matches) {
      const raw = match[1].trim();
      if (!raw || !hasLetters(raw)) continue;
      if (ALLOWED_TEXT.has(raw)) continue;
      results.push({ line: i + 1, text: raw });
    }
  }
  return results;
}

const dePath = join(ROOT, "i18n", "de.json");
const enPath = join(ROOT, "i18n", "en.json");
const deDict = JSON.parse(await readFile(dePath, "utf8"));
const enDict = JSON.parse(await readFile(enPath, "utf8"));
const i18nValues = new Set([
  ...Object.values(deDict).filter(v => typeof v === "string"),
  ...Object.values(enDict).filter(v => typeof v === "string")
]);

function normalizeValue(value) {
  return String(value || "").trim();
}

function isUrlLike(value) {
  return /^https?:\/\//i.test(value);
}

function hasInterpolation(value) {
  return /\$\{/.test(value);
}

function extractStringLiterals(content) {
  const results = [];
  const regex = /(["'`])(?:\\.|(?!\1)[^\\])*\1/g;
  for (const match of content.matchAll(regex)) {
    const raw = match[0];
    const quote = raw[0];
    if (quote === "`" && hasInterpolation(raw)) continue;
    const value = raw.slice(1, -1);
    results.push({ raw, value });
  }
  return results;
}

async function scanJsJson(file) {
  const content = await readFile(file, "utf8");
  const lines = content.split(/\r?\n/);
  const findings = [];
  const literals = extractStringLiterals(content);
  for (const { value } of literals) {
    const normalized = normalizeValue(value);
    if (!normalized || !hasLetters(normalized)) continue;
    if (ALLOWED_TEXT.has(normalized)) continue;
    if (isUrlLike(normalized)) continue;
    if (i18nValues.has(normalized)) continue;
    const line = lines.findIndex(l => l.includes(value));
    const lineNo = line >= 0 ? line + 1 : 1;
    findings.push({ line: lineNo, text: normalized });
  }
  return findings;
}

const files = await collectHtmlFiles(ROOT);
let hasFindings = false;

for (const file of files) {
  const hits = await scanFile(file);
  if (!hits.length) continue;
  hasFindings = true;
  for (const hit of hits) {
    const rel = file.replace(ROOT, "").replace(/^\\/, "");
    console.log(`${rel}:${hit.line} ${hit.text}`);
  }
}

const jsJsonFiles = await collectFiles(ROOT, [".js", ".mjs", ".json"]);
for (const file of jsJsonFiles) {
  if (file.includes(`${join(ROOT, "i18n")}`)) continue;
  if (file.includes(`${join(ROOT, "data")}`)) continue;
  const hits = await scanJsJson(file);
  if (!hits.length) continue;
  hasFindings = true;
  for (const hit of hits) {
    const rel = file.replace(ROOT, "").replace(/^\\/, "");
    console.log(`${rel}:${hit.line} ${hit.text}`);
  }
}

if (!hasFindings) {
  console.log("No non-i18n text nodes found in HTML/JS/JSON files.");
}
