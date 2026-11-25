// View Daftar Properti dan Daftar Pose admin: baris hanya-baca (Ubah/Hapus), mode ubah satu baris (form sendiri lewat atribut form=, Simpan/Batal),
// unggah foto, tombol + Tambah yang membuka baris tambah, draf
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAdminState } from "../../../js/controllers/AdminController.js";
import { propertiesView } from "../../../js/views/admin/properties.js";
import { posesView } from "../../../js/views/admin/poses.js";
import { sampleState } from "../../helpers/fixtures.js";
import { flat } from "../../helpers/markup.js";

const render = (view, admin) => flat(view({ ...sampleState(), admin: { ...createAdminState(), ...admin } }));
const property = (overrides = {}) => ({ id: 4, name: "Topi <b>", category: "Kacamata", qty: 2, img: "/media/t.jpg", ...overrides });

test("properti: Memuat…; baris hanya-baca (foto, nama di-escape, kategori, qty, Ubah, Hapus) tanpa form dan tanpa Simpan", () => {
  assert.match(render(propertiesView, {}), /Memuat…/);
  const out = render(propertiesView, { properties: [property(), property({ id: 5, name: "Rompi", category: "Rompi", qty: 0, img: "" })] });
  assert.ok(!out.includes("<form"));
  assert.ok(!out.includes("<input"));
  assert.ok(!out.includes("Simpan"));
  assert.match(out, /<span class="pthumb ro" style="background-image:url\('\/media\/t\.jpg'\)" role="img" aria-label="Foto Topi &lt;b&gt;"><\/span><\/td><td>Topi &lt;b&gt;<\/td><td>Kacamata<\/td><td>2<\/td>/);
  assert.match(out, /<button class="btn sm ghost" type="button" data-action="admin:startEdit" data-key="property-4" aria-label="Ubah Topi &lt;b&gt;">Ubah<\/button> <button class="btn sm ghost" type="button" data-action="admin:deleteProperty" data-id="4">Hapus<\/button>/);
  assert.match(out, /<span class="pthumb ro" style="" role="img" aria-label="Foto Rompi"><svg/);
  assert.match(out, /<td>0 <span class="tag no">Habis<\/span><\/td>/);
  assert.match(out, /data-action="admin:startEdit" data-key="property-new"><svg[^]*<\/svg> Tambah properti<\/button>/);
  assert.ok(out.includes('Qty 0 = properti ditampilkan "Habis" di halaman studio. Kategori "Background" menjadi background, selain itu aksesori.'));
});

test("properti: mode ubah hanya baris admin.editing → form property-form-<id>, unggah foto, isian, Simpan + Batal, tanpa Hapus", () => {
  const out = render(propertiesView, { properties: [property(), property({ id: 5, name: "Rompi", category: "Rompi" })], editing: "property-4" });
  assert.match(out, /<form id="property-form-4" novalidate data-submit="admin:saveProperty" data-id="4"><\/form>/);
  assert.ok(!out.includes('property-form-5"'));
  assert.match(out, /data-key="property-5" aria-label="Ubah Rompi">Ubah<\/button>/);
  assert.match(out, /<label class="pthumb" style="background-image:url\('\/media\/t\.jpg'\)"><input type="file" accept="image\/\*" hidden form="property-form-4" data-change="admin:uploadPropertyImage" data-key="4" aria-label="Foto Topi &lt;b&gt;"><\/label>/);
  assert.match(out, /<input form="property-form-4" name="name" data-edit-focus value="Topi &lt;b&gt;" placeholder="Nama properti" aria-label="Nama properti">/);
  assert.match(out, /name="category"[^>]*><option value="Background" >Background<\/option>.*<option value="Kacamata" selected>Kacamata<\/option>/s);
  assert.match(out, /<input form="property-form-4" name="qty" type="number" min="0" value="2" style="width:80px" aria-label="Qty">/);
  assert.match(out, /<button class="btn sm" type="submit" form="property-form-4">Simpan<\/button> <button class="btn sm ghost" type="button" data-action="admin:cancelEdit">Batal<\/button><\/td>/);
  assert.ok(!out.includes('data-action="admin:deleteProperty" data-id="4"'));
  assert.ok(!out.includes("property-form-new"));
});

test("properti: + Tambah properti → baris tambah (Topi, qty 1, ikon unggah, Tambah + Batal), tombol tambah hilang; gambar baru dan draf tampil; pencarian", () => {
  const out = render(propertiesView, { properties: [property(), property({ id: 5, name: "Rompi", category: "Rompi" })], images: { "property-new": "/media/n.jpg" }, drafts: { "property-5": { name: "Rompi Baru", category: "Rompi", qty: "0" } }, editing: "property-5", query: "rompi" });
  assert.ok(!out.includes("Topi &lt;b&gt;"));
  assert.match(out, /name="name" data-edit-focus value="Rompi Baru"/);
  const adding = render(propertiesView, { properties: [property()], images: { "property-new": "/media/n.jpg" }, editing: "property-new" });
  assert.match(adding, /<form id="property-form-new" novalidate data-submit="admin:addProperty"><\/form>/);
  assert.match(adding, /<label class="pthumb" style="background-image:url\('\/media\/n\.jpg'\)"><input[^>]*data-key="new"/);
  assert.match(adding, /<button class="btn sm" type="submit" form="property-form-new">Tambah<\/button> <button class="btn sm ghost" type="button" data-action="admin:cancelEdit">Batal<\/button><\/td>/);
  assert.ok(!adding.includes("Tambah properti"));
  const fresh = render(propertiesView, { properties: [], editing: "property-new" });
  assert.match(fresh, /<label class="pthumb" style=""><svg/);
  assert.match(fresh, /<option value="Topi" selected>Topi<\/option>/);
  assert.match(fresh, /name="qty" type="number" min="0" value="1"/);
});

test("pose: Memuat…; baris hanya-baca (foto, jumlah orang, Ubah, Hapus) tanpa form dan tanpa Simpan; + Tambah pose", () => {
  assert.match(render(posesView, {}), /Memuat…/);
  const out = render(posesView, { poses: [{ id: 6, img_url: "/media/a.jpg", people_range_id: 2 }, { id: 7, img_url: "/img/pose-placeholder.jpg", people_range_id: 1 }] });
  assert.match(out, /<th>Foto<\/th><th>Jumlah orang<\/th><th><\/th>/);
  assert.ok(!out.includes("<form"));
  assert.ok(!out.includes("Simpan"));
  assert.match(out, /<span class="pthumb ro" style="background-image:url\('\/media\/a\.jpg'\)" role="img" aria-label="Foto pose 3-5 orang"><\/span><\/td><td>3-5 orang<\/td>/);
  assert.match(out, /data-action="admin:startEdit" data-key="pose-6" aria-label="Ubah pose 3-5 orang">Ubah<\/button> <button class="btn sm ghost" type="button" data-action="admin:deletePose" data-id="6">Hapus<\/button>/);
  assert.match(out, /data-action="admin:startEdit" data-key="pose-new"><svg[^]*<\/svg> Tambah pose<\/button>/);
  assert.ok(!out.includes('name="nama"'));
  assert.ok(out.includes("Foto wajib diunggah saat menambah pose."));
});

test("pose: mode ubah → form pose-form-<id>, unggah foto, jumlah orang terpilih (fokus), Simpan + Batal; foto baru dan draf tampil", () => {
  const out = render(posesView, { poses: [{ id: 6, img_url: "/media/a.jpg", people_range_id: 2 }, { id: 7, img_url: "/media/a.jpg", people_range_id: 1 }], images: { "pose-7": "/media/b.jpg" }, drafts: { "pose-7": { people_range_id: "2" } }, editing: "pose-7", query: "apa saja" });
  assert.match(out, /<form id="pose-form-7" novalidate data-submit="admin:savePose" data-id="7"><\/form>/);
  assert.ok(!out.includes('pose-form-6"'));
  assert.match(out, /background-image:url\('\/media\/b\.jpg'\)"><input type="file" accept="image\/\*" hidden form="pose-form-7" data-change="admin:uploadPoseImage" data-key="7"/);
  assert.match(out, /id="po7r"[^>]*data-edit-focus>(?:(?!<\/select>)[^])*<option value="2" selected>/);
  assert.match(out, /form="pose-form-7">Simpan<\/button> <button class="btn sm ghost" type="button" data-action="admin:cancelEdit">Batal<\/button>/);
});

test("pose: baris tambah (ikon unggah, Foto pose baru, Tambah + Batal) hanya saat editing pose-new; foto baru tampil", () => {
  const fresh = render(posesView, { poses: [], editing: "pose-new" });
  assert.match(fresh, /<form id="pose-form-new" novalidate data-submit="admin:addPose"><\/form>/);
  assert.match(fresh, /<label class="pthumb" style=""><svg[^]*?data-change="admin:uploadPoseImage" data-key="new" aria-label="Foto pose baru">/);
  assert.match(fresh, /form="pose-form-new">Tambah<\/button> <button class="btn sm ghost" type="button" data-action="admin:cancelEdit">Batal<\/button>/);
  assert.ok(!fresh.includes("Tambah pose"));
  const out = render(posesView, { poses: [], images: { "pose-new": "/media/n.jpg" }, editing: "pose-new" });
  assert.match(out, /background-image:url\('\/media\/n\.jpg'\)"><input[^>]*data-key="new"/);
});
