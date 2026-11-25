// View Paket & Diskon dan Akun Admin
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAdminState } from "../../../js/controllers/AdminController.js";
import { packagesView } from "../../../js/views/admin/packages.js";
import { accountView } from "../../../js/views/admin/account.js";
import { sampleState } from "../../helpers/fixtures.js";
import { flat } from "../../helpers/markup.js";

const stateWith = admin => ({ ...sampleState(), admin: { ...createAdminState(), ...admin } });
const render = view => flat(view);
const packageList = [{ id: 1, name: "Basic <x>", price: 50000, photo_count: 3, dur: 15, strip_size: "2x6", strip_material: "Glossy", active: 1 }, { id: 3, name: "Lama", price: 10000, photo_count: 1, dur: 5, strip_size: "", strip_material: "", active: 0 }];
const discount = { pct: 10, label: "Promo \"Merdeka\"" };

test("paket: memuat sampai paket dan diskon ada", () => {
  assert.match(render(packagesView(stateWith({ packages: packageList }))), /Memuat…/);
  assert.match(render(packagesView(stateWith({ discount }))), /Memuat…/);
});

test("paket: form diskon utama, baris paket terikat ke form masing-masing, nilai di-escape", () => {
  const out = render(packagesView(stateWith({ packages: packageList, discount })));
  for (const text of ["Diskon utama", "Isi 0 untuk menonaktifkan.", "Harga baru hanya berlaku untuk booking berikutnya.", "+ Tambah paket"]) assert.ok(out.includes(text), text);
  assert.match(out, /<form[^>]*data-submit="admin:saveDiscount"/);
  assert.match(out, /name="pct"[^>]*value="10"/);
  assert.ok(out.includes('value="Promo &quot;Merdeka&quot;"'));
  assert.match(out, /<form id="package-form-1"[^>]*data-submit="admin:savePackage" data-id="1"/);
  assert.match(out, /<form id="package-form-new"[^>]*data-submit="admin:addPackage"/);
  assert.ok(out.includes('form="package-form-1" name="name" value="Basic &lt;x&gt;"'));
  for (const name of ["name", "price", "photo_count", "dur", "strip_size", "strip_material"]) assert.match(out, new RegExp(`form="package-form-new" name="${name}"`), name);
});

test("paket: tag aktif/nonaktif, tombol Aktifkan hanya untuk paket nonaktif, Hapus untuk semua", () => {
  const out = render(packagesView(stateWith({ packages: packageList, discount })));
  assert.match(out, /<span class="tag ok">aktif<\/span>/);
  assert.match(out, /<span class="tag no">nonaktif<\/span>/);
  assert.equal((out.match(/data-action="admin:activatePackage"/g) || []).length, 1);
  assert.match(out, /data-action="admin:activatePackage" data-id="3"/);
  assert.equal((out.match(/data-action="admin:deletePackage"/g) || []).length, 2);
});

test("paket: draf yang gagal disimpan mengisi baris itu", () => {
  const out = render(packagesView(stateWith({ packages: packageList, discount, drafts: { "package-1": { name: "Basic Baru", price: "-5", photo_count: "3", dur: "15", strip_size: "2x6", strip_material: "Glossy" }, "package-new": { name: "Premium" }, discount: { pct: "120", label: "x" } } })));
  assert.ok(out.includes('form="package-form-1" name="name" value="Basic Baru"'));
  assert.ok(out.includes('form="package-form-new" name="name" value="Premium"'));
  assert.match(out, /name="pct"[^>]*value="120"/);
});

test("akun admin: username terisi, password kosong, label wajib saat must_change, draf username menang", () => {
  let out = render(accountView(stateWith({ me: { username: "admin<1>", must_change: false } })));
  for (const text of ["Akun Admin", "Password baru minimal 8 karakter", "(kosongkan jika tidak diganti)", "Ulangi password baru"]) assert.ok(out.includes(text), text);
  assert.match(out, /<form[^>]*data-submit="admin:saveAccount"/);
  assert.match(out, /name="username"[^>]*value="admin&lt;1&gt;"/);
  for (const name of ["current_password", "new_password", "new_password_repeat"]) assert.match(out, new RegExp(`type="password" name="${name}"`), name);
  assert.ok(!/type="password" name="[a-z_]+" value=/.test(out));
  out = render(accountView(stateWith({ me: { username: "admin", must_change: true }, drafts: { account: { username: "baru" } } })));
  assert.ok(out.includes("Password baru (wajib)"));
  assert.match(out, /name="username"[^>]*value="baru"/);
});
