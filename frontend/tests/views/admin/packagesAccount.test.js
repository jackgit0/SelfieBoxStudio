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

test("paket: diskon dan baris paket hanya-baca (tanpa form, tanpa Simpan), harga rupiah, kolom kosong \"-\", nilai di-escape, + Tambah paket", () => {
  const out = render(packagesView(stateWith({ packages: packageList, discount })));
  for (const text of ["Diskon utama", "Harga baru hanya berlaku untuk booking berikutnya.", "Tambah paket"]) assert.ok(out.includes(text), text);
  assert.ok(!out.includes("<form"));
  assert.ok(!out.includes("<input"));
  assert.ok(!out.includes("Simpan"));
  assert.match(out, /<p style="margin-top:8px"><b>10%<\/b> · Promo &quot;Merdeka&quot;<\/p>/);
  assert.match(out, /data-action="admin:startEdit" data-key="discount" aria-label="Ubah diskon utama">Ubah<\/button>/);
  assert.match(out, /<tr><td>Basic &lt;x&gt;<\/td><td>Rp ?50\.000<\/td><td>3<\/td><td>15<\/td><td>2x6<\/td><td>Glossy<\/td>/);
  assert.match(out, /<td>Lama<\/td><td>Rp ?10\.000<\/td><td>1<\/td><td>5<\/td><td>-<\/td><td>-<\/td>/);
  assert.match(out, /data-action="admin:startEdit" data-key="package-1" aria-label="Ubah Basic &lt;x&gt;">Ubah<\/button>/);
  assert.match(out, /data-action="admin:startEdit" data-key="package-new"><svg[^]*<\/svg> Tambah paket<\/button>/);
  assert.match(render(packagesView(stateWith({ packages: [], discount: { pct: 0, label: "" } }))), /<span class="m">Tidak ada diskon\.<\/span>/);
});

test("paket: mode ubah → hanya baris itu jadi form package-form-<id> dengan Simpan + Batal; diskon → form dengan Simpan + Batal", () => {
  let out = render(packagesView(stateWith({ packages: packageList, discount, editing: "package-1" })));
  assert.match(out, /<form id="package-form-1"[^>]*data-submit="admin:savePackage" data-id="1"/);
  assert.ok(out.includes('form="package-form-1" name="name" data-edit-focus value="Basic &lt;x&gt;"'));
  assert.match(out, /form="package-form-1">Simpan<\/button> <button class="btn sm ghost" type="button" data-action="admin:cancelEdit">Batal<\/button>/);
  assert.ok(!out.includes("package-form-3"));
  assert.ok(!out.includes('data-action="admin:deletePackage" data-id="1"'));
  assert.ok(!out.includes("saveDiscount"));
  out = render(packagesView(stateWith({ packages: packageList, discount, editing: "package-new" })));
  assert.match(out, /<form id="package-form-new"[^>]*data-submit="admin:addPackage"/);
  for (const name of ["name", "price", "photo_count", "dur", "strip_size", "strip_material"]) assert.match(out, new RegExp(`form="package-form-new" name="${name}"`), name);
  assert.match(out, /form="package-form-new">Tambah<\/button> <button class="btn sm ghost" type="button" data-action="admin:cancelEdit">Batal<\/button>/);
  assert.ok(!out.includes("Tambah paket"));
  out = render(packagesView(stateWith({ packages: packageList, discount, editing: "discount" })));
  assert.match(out, /<form[^>]*data-submit="admin:saveDiscount"/);
  assert.ok(out.includes("Isi 0 untuk menonaktifkan."));
  assert.match(out, /id="d_pct" data-edit-focus name="pct"[^>]*value="10"/);
  assert.ok(out.includes('value="Promo &quot;Merdeka&quot;"'));
  assert.match(out, /<button class="btn sm" type="submit">Simpan<\/button><button class="btn sm ghost" type="button" data-action="admin:cancelEdit">Batal<\/button>/);
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
  let out = render(packagesView(stateWith({ packages: packageList, discount, editing: "package-1", drafts: { "package-1": { name: "Basic Baru", price: "-5", photo_count: "3", dur: "15", strip_size: "2x6", strip_material: "Glossy" }, "package-new": { name: "Premium" }, discount: { pct: "120", label: "x" } } })));
  assert.ok(out.includes('form="package-form-1" name="name" data-edit-focus value="Basic Baru"'));
  const drafts = { "package-new": { name: "Premium" }, discount: { pct: "120", label: "x" } };
  out = render(packagesView(stateWith({ packages: packageList, discount, editing: "package-new", drafts })));
  assert.ok(out.includes('form="package-form-new" name="name" data-edit-focus value="Premium"'));
  out = render(packagesView(stateWith({ packages: packageList, discount, editing: "discount", drafts })));
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
