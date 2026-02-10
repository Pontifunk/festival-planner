const fs = require("fs");
const path = require("path");

const root = process.cwd();
const dist = path.join(root, "dist-site");

function mustExist(relativePath, label) {
  const filePath = path.join(dist, relativePath);
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size === 0) {
      throw new Error(`${label} is empty`);
    }
  } catch (err) {
    throw new Error(`${label} missing at ${filePath}`);
  }
}

function checkSitemap() {
  const sitemapPath = path.join(dist, "sitemap.xml");
  const xml = fs.readFileSync(sitemapPath, "utf8");
  const hasXmlHeader = xml.trimStart().startsWith("<?xml");
  const hasRoot =
    xml.includes("<urlset") || xml.includes("<sitemapindex");
  if (!hasXmlHeader || !hasRoot) {
    throw new Error("sitemap.xml does not look like valid XML");
  }
}

function run() {
  if (!fs.existsSync(dist)) {
    throw new Error(`dist-site not found at ${dist}`);
  }
  mustExist("index.html", "index.html");
  mustExist("styles.css", "styles.css");
  mustExist("app.main.js", "app.main.js");
  mustExist("sitemap.xml", "sitemap.xml");
  checkSitemap();
  console.log("Smoke check passed.");
}

try {
  run();
} catch (err) {
  console.error(`Smoke check failed: ${err.message}`);
  process.exit(1);
}
