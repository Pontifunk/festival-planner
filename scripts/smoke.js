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

function checkIndexReferences() {
  const indexPath = path.join(dist, "index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  if (!html.includes("styles.css")) {
    throw new Error("index.html does not reference styles.css");
  }
  if (!html.includes("app.main.js")) {
    throw new Error("index.html does not reference app.main.js");
  }
  if (!html.toLowerCase().includes("<!doctype html")) {
    throw new Error("index.html missing doctype");
  }
}

function run() {
  if (!fs.existsSync(dist)) {
    throw new Error(`dist-site not found at ${dist}`);
  }
  mustExist("index.html", "index.html");
  mustExist("404.html", "404.html");
  mustExist("styles.css", "styles.css");
  mustExist("app.main.js", "app.main.js");
  mustExist("sitemap.xml", "sitemap.xml");
  mustExist("robots.txt", "robots.txt");
  mustExist("manifest.webmanifest", "manifest.webmanifest");
  mustExist("service-worker.js", "service-worker.js");
  checkSitemap();
  checkIndexReferences();
  console.log("Smoke check passed.");
}

try {
  run();
} catch (err) {
  console.error(`Smoke check failed: ${err.message}`);
  process.exit(1);
}
