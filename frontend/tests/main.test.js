// main.js dapat diimpor di Node (start() hanya berjalan bila ada document), dan setiap aksi data-* di view/komponen terdaftar di peta aksinya:
// tombol dengan nama aksi yang tidak terdaftar akan diam saja ("Aksi … belum terdaftar" hanya muncul di konsol).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installShellActions } from "../js/core/render.js";

const js = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "js");
const sourceFiles = ["views", "components", "core"].flatMap(dir => fs.readdirSync(path.join(js, dir), { recursive: true }).filter(file => file.endsWith(".js")).map(file => path.join(js, dir, file)));

test("main.js dapat diimpor di Node tanpa menjalankan aplikasi", async () => {
  const main = await import(pathToFileURL(path.join(js, "main.js")).href);
  assert.equal(typeof main.controllerActions, "function");
});

test("setiap data-action/change/input/enter/submit di views/, components/ dan core/ terdaftar di main.js", async () => {
  const { controllerActions } = await import(pathToFileURL(path.join(js, "main.js")).href);
  // controller palsu: setiap metode ada (peta aksi hanya mengambil rujukannya)
  const anyController = new Proxy({}, { get: () => () => {} });
  const controllers = new Proxy({}, { get: () => anyController });
  const registered = new Set(Object.keys(controllerActions(controllers)));
  installShellActions({ registerActions: actions => Object.keys(actions).forEach(name => registered.add(name)), document: { addEventListener: () => {}, querySelector: () => null } });
  const used = new Map();
  for (const file of sourceFiles) {
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(text, /data-(action|change|input|enter|submit)=\$\{/, `${path.relative(js, file)}: nama aksi harus tertulis apa adanya`);
    for (const found of text.matchAll(/data-(?:action|change|input|enter|submit)="([^"]+)"/g)) used.set(found[1], path.relative(js, file));
  }
  assert.ok(used.size > 50, `aksi terkumpul: ${used.size}`);
  const missing = [...used].filter(([name]) => !registered.has(name)).map(([name, file]) => `${name} (${file})`);
  assert.deepEqual(missing, []);
});
