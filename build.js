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

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
