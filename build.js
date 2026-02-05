const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const dist = path.join(root, "dist");

const jsFiles = [
  "app.util.js",
  "app.config.js",
  "app.i18n.js",
  "app.routing.js",
  "app.state.js",
  "app.store.js",
  "app.data.js",
  "app.ui.js",
  "app.main.js"
];

function readFile(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

async function build() {
  fs.mkdirSync(dist, { recursive: true });

  const jsConcat = jsFiles.map(readFile).join("\n;\n");
  const jsResult = await esbuild.transform(jsConcat, {
    loader: "js",
    minify: true,
    target: "es2018"
  });
  fs.writeFileSync(path.join(dist, "app.bundle.min.js"), jsResult.code);

  const css = readFile("styles.css");
  const cssResult = await esbuild.transform(css, {
    loader: "css",
    minify: true
  });
  fs.writeFileSync(path.join(dist, "styles.min.css"), cssResult.code);
}

const watchMode = process.argv.includes("--watch");
const watchFiles = [...jsFiles, "styles.css"];

let building = false;
let pending = false;
let debounceTimer = null;

async function runBuild() {
  if (building) {
    pending = true;
    return;
  }
  building = true;
  try {
    await build();
    if (watchMode) {
      console.info(`[build] ok ${new Date().toLocaleTimeString()}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    building = false;
    if (pending) {
      pending = false;
      runBuild();
    }
  }
}

function scheduleBuild() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runBuild, 100);
}

runBuild().then(() => {
  if (!watchMode) return;
  console.info("[watch] waiting for changes...");
  watchFiles.forEach((file) => {
    const abs = path.join(root, file);
    fs.watch(abs, { persistent: true }, scheduleBuild);
  });
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
