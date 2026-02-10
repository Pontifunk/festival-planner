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
  const hasUrl = xml.includes("<url>") || xml.includes("<sitemap>");
  if (!hasXmlHeader || !hasRoot) {
    throw new Error("sitemap.xml does not look like valid XML");
  }
  if (!hasUrl) {
    throw new Error("sitemap.xml contains no entries");
  }
}

function checkIndexReferences() {
  const indexPath = path.join(dist, "index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  if (!html.toLowerCase().includes("<!doctype html")) {
    throw new Error("index.html missing doctype");
  }
}

function listLocalAssets(html) {
  const assets = new Set();
  const patterns = [
    /<link[^>]+href=["']([^"']+)["']/gi,
    /<script[^>]+src=["']([^"']+)["']/gi,
    /<img[^>]+src=["']([^"']+)["']/gi,
  ];
  for (const regex of patterns) {
    let match = null;
    while ((match = regex.exec(html)) !== null) {
      const value = match[1];
      if (
        value &&
        !value.startsWith("http://") &&
        !value.startsWith("https://") &&
        !value.startsWith("//") &&
        !value.startsWith("data:")
      ) {
        assets.add(value.replace(/^\//, ""));
      }
    }
  }
  return [...assets];
}

function checkIndexHasCssAndJs() {
  const indexPath = path.join(dist, "index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  const cssLinks = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)];
  const jsScripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)];
  if (cssLinks.length === 0) {
    throw new Error("index.html has no stylesheet links");
  }
  if (jsScripts.length === 0) {
    throw new Error("index.html has no script tags with src");
  }
}

function checkIndexAssetsExist() {
  const indexPath = path.join(dist, "index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  const assets = listLocalAssets(html);
  for (const asset of assets) {
    const assetPath = path.join(dist, asset);
    if (!fs.existsSync(assetPath)) {
      throw new Error(`index.html references missing asset: ${asset}`);
    }
  }
}

function checkRobots() {
  const robotsPath = path.join(dist, "robots.txt");
  const content = fs.readFileSync(robotsPath, "utf8");
  if (!content.toLowerCase().includes("sitemap:")) {
    throw new Error("robots.txt missing Sitemap directive");
  }
}

function checkManifest() {
  const manifestPath = path.join(dist, "manifest.webmanifest");
  const text = fs.readFileSync(manifestPath, "utf8");
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("manifest.webmanifest is not valid JSON");
  }
  if (!data.name && !data.short_name) {
    throw new Error("manifest.webmanifest missing name/short_name");
  }
  if (!Array.isArray(data.icons) || data.icons.length === 0) {
    throw new Error("manifest.webmanifest missing icons");
  }
}

function checkServiceWorker() {
  const swPath = path.join(dist, "service-worker.js");
  const text = fs.readFileSync(swPath, "utf8");
  if (!text.includes("self.addEventListener")) {
    throw new Error("service-worker.js missing event listeners");
  }
}

function checkIndexStructure() {
  const indexPath = path.join(dist, "index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  const hasHtml = /<html[\s>]/i.test(html);
  const hasHead = /<head[\s>]/i.test(html);
  const hasBody = /<body[\s>]/i.test(html);
  if (!hasHtml || !hasHead || !hasBody) {
    throw new Error("index.html missing html/head/body structure");
  }
}

function checkSitemapUrls() {
  const sitemapPath = path.join(dist, "sitemap.xml");
  const xml = fs.readFileSync(sitemapPath, "utf8");
  const urlMatches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)];
  if (urlMatches.length === 0) {
    return;
  }
  for (const match of urlMatches) {
    const loc = match[1].trim();
    if (!/^https?:\/\/.+/i.test(loc)) {
      throw new Error(`sitemap.xml has non-absolute URL: ${loc}`);
    }
  }
}

function run() {
  if (!fs.existsSync(dist)) {
    throw new Error(`dist-site not found at ${dist}`);
  }
  mustExist("index.html", "index.html");
  mustExist("404.html", "404.html");
  mustExist("sitemap.xml", "sitemap.xml");
  mustExist("robots.txt", "robots.txt");
  mustExist("manifest.webmanifest", "manifest.webmanifest");
  mustExist("service-worker.js", "service-worker.js");
  checkSitemap();
  checkIndexReferences();
  checkIndexHasCssAndJs();
  checkIndexAssetsExist();
  checkRobots();
  checkManifest();
  checkServiceWorker();
  checkIndexStructure();
  checkSitemapUrls();
  console.log("Smoke check passed.");
}

try {
  run();
} catch (err) {
  console.error(`Smoke check failed: ${err.message}`);
  process.exit(1);
}
