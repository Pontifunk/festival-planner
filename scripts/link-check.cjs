const fs = require("fs");
const path = require("path");
const markdownLinkCheck = require("markdown-link-check");

const ROOT = process.cwd();
const DOC_FILES = [
  path.join(ROOT, "README.md"),
  path.join(ROOT, "README.de.md")
];

const docsDir = path.join(ROOT, "docs");
if (fs.existsSync(docsDir)) {
  for (const name of fs.readdirSync(docsDir)) {
    if (name.toLowerCase().endsWith(".md")) DOC_FILES.push(path.join(docsDir, name));
  }
}

function checkFile(filePath) {
  return new Promise((resolve) => {
    const content = fs.readFileSync(filePath, "utf8");
    markdownLinkCheck(
      content,
      {
        baseUrl: `file://${path.dirname(filePath)}/`,
        timeout: "5000",
        ignorePatterns: [
          /^mailto:/,
          /^tel:/,
          /^#/,
          /localhost/
        ]
      },
      (err, results) => {
        if (err) {
          resolve([{ filePath, message: err.message || String(err) }]);
          return;
        }
        const dead = (results || []).filter((r) => r.status === "dead");
        resolve(dead.map((d) => ({ filePath, message: `${d.status}: ${d.link}` })));
      }
    );
  });
}

(async () => {
  const allFailures = [];
  for (const filePath of DOC_FILES) {
    const failures = await checkFile(filePath);
    allFailures.push(...failures);
  }

  if (!allFailures.length) {
    console.log(`link check passed (${DOC_FILES.length} files)`);
    return;
  }

  for (const failure of allFailures) {
    const rel = path.relative(ROOT, failure.filePath).replaceAll("\\", "/");
    console.error(`${rel}: ${failure.message}`);
  }
  process.exit(1);
})();
