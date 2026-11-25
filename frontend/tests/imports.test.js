// Setiap modul inti, model, komponen, view, controller, dan config dapat diimpor di Node tanpa window/document/localStorage (architecture.md → Code style).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const js = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "js");
const modules = ["config.js", ...["core", "models", "components", "views", "controllers"].flatMap(dir => fs.readdirSync(path.join(js, dir), { recursive: true }).filter(file => file.endsWith(".js")).map(file => `${dir}/${file}`))];

test("tidak ada window/document/localStorage di lingkungan tes", () => {
  for (const name of ["window", "document", "localStorage", "location"]) assert.equal(typeof globalThis[name], "undefined", name);
});

for (const file of modules) {
  test(`${file} dapat diimpor di Node`, async () => {
    await import(pathToFileURL(path.join(js, file)).href);
  });
}

test("config.js: API_BASE kosong untuk localhost, URL Render untuk domain lain", async () => {
  const config = await import(pathToFileURL(path.join(js, "config.js")).href);
  assert.equal(config.API_BASE, "");
  assert.equal(config.apiBaseFor("localhost"), "");
  assert.equal(config.apiBaseFor("127.0.0.1"), "");
  assert.equal(config.apiBaseFor("selfieboxstudio.onrender.com"), "https://selfieboxstudio.onrender.com");
  // jaringan lokal (mis. HP di Wi-Fi yang sama membuka laptop) = backend yang menyajikan halaman, bukan Render
  for (const host of ["192.168.1.7", "10.0.0.5", "172.16.0.2", "172.31.255.1", "0.0.0.0"]) assert.equal(config.apiBaseFor(host), "", host);
  for (const host of ["172.15.0.1", "172.32.0.1", "8.8.8.8", "example.com"]) assert.equal(config.apiBaseFor(host), "https://selfieboxstudio.onrender.com", host);
  assert.equal(config.STUDIO_ADDRESS, "Jl. Veteran No. 3"); // alamat usaha di Contact Us; studio tidak punya alamat
  assert.equal(config.BRAND, "SelfieBox Studio");
  for (const name of ["GOOGLE_CLIENT_ID", "CS_WA", "CS_EMAIL"]) assert.equal(typeof config[name], "string", name);
});

// main.js dan berkas lama tidak bisa diimpor di Node (menyentuh window), jadi nama ganda di import-nya dicek dari teks:
// dua binding bernama sama membuat modul gagal di-parse di browser ("Identifier … has already been declared")
test("setiap berkas JS: tidak ada nama import ganda", () => {
  const files = fs.readdirSync(js, { recursive: true }).filter(file => file.endsWith(".js"));
  for (const file of files) {
    const text = fs.readFileSync(path.join(js, file), "utf8");
    const names = [];
    for (const match of text.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
      for (const entry of match[1].split(",").map(part => part.trim()).filter(Boolean)) names.push(entry.split(/\s+as\s+/).pop());
    }
    for (const match of text.matchAll(/import\s+\*\s+as\s+(\w+)\s+from/g)) names.push(match[1]);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    assert.deepEqual(duplicates, [], file);
  }
});
