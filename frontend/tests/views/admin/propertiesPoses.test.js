// View Daftar Properti dan Daftar Pose admin: baris dengan form sendiri (atribut form=), unggah foto properti dan pose, baris tambah, draf
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAdminState } from "../../../js/controllers/AdminController.js";
import { propertiesView } from "../../../js/views/admin/properties.js";
import { posesView } from "../../../js/views/admin/poses.js";
import { sampleState } from "../../helpers/fixtures.js";
import { flat } from "../../helpers/markup.js";

const render = (view, admin) => flat(view({ ...sampleState(), admin: { ...createAdminState(), ...admin } }));
const property = (overrides = {}) => ({ id: 4, name: "Topi <b>", category: "Kacamata", qty: 2, img: "/media/t.jpg", ...overrides });

test("properti: Memuat…; baris dengan form property-form-<id>, foto, nama di-escape, kategori terpilih, qty, Simpan dan Hapus", () => {
  assert.match(render(propertiesView, {}), /Memuat…/);
  const out = render(propertiesView, { properties: [property()] });
  assert.match(out, /<form id="property-form-4" novalidate data-submit="admin:saveProperty" data-id="4"><\/form>/);
  assert.match(out, /<label class="pthumb" style="background-image:url\('\/media\/t\.jpg'\)"><input type="file" accept="image\/\*" hidden form="property-form-4" data-change="admin:uploadPropertyImage" data-key="4" aria-label="Foto Topi &lt;b&gt;"><\/label>/);
  assert.match(out, /<input form="property-form-4" name="name" value="Topi &lt;b&gt;" placeholder="Nama properti" aria-label="Nama properti">/);
  assert.match(out, /name="category"[^>]*><option value="Background" >Background<\/option>.*<option value="Kacamata" selected>Kacamata<\/option>/s);
  assert.match(out, /<input form="property-form-4" name="qty" type="number" min="0" value="2" style="width:80px" aria-label="Qty">/);
  assert.match(out, /<button class="btn sm" type="submit" form="property-form-4">Simpan<\/button> <button class="btn sm ghost" type="button" data-action="admin:deleteProperty" data-id="4">Hapus<\/button>/);
  assert.ok(out.includes('Qty 0 = properti ditampilkan "Habis" di halaman studio. Kategori "Background" menjadi background, selain itu aksesori.'));
});

test("properti: baris tambah (Topi, qty 1, ikon unggah) dengan + Tambah; gambar baru dan draf tampil; pencarian", () => {
  const out = render(propertiesView, { properties: [property(), property({ id: 5, name: "Rompi", category: "Rompi" })], images: { "property-new": "/media/n.jpg" }, drafts: { "property-5": { name: "Rompi Baru", category: "Rompi", qty: "0" } }, query: "rompi" });
  assert.ok(!out.includes("Topi &lt;b&gt;"));
  assert.match(out, /name="name" value="Rompi Baru"/);
  assert.match(out, /<form id="property-form-new" novalidate data-submit="admin:addProperty"><\/form>/);
  assert.match(out, /<label class="pthumb" style="background-image:url\('\/media\/n\.jpg'\)"><input[^>]*data-key="new"/);
  assert.match(out, /<button class="btn sm" type="submit" form="property-form-new">\+ Tambah<\/button><\/td>/);
  const fresh = render(propertiesView, { properties: [] });
  assert.match(fresh, /<label class="pthumb" style=""><svg/);
  assert.match(fresh, /<option value="Topi" selected>Topi<\/option>/);
  assert.match(fresh, /name="qty" type="number" min="0" value="1"/);
});

test("pose: Memuat…; baris dengan form pose-form-<id>, foto (unggah), jumlah orang terpilih, tanpa nama, Simpan/Hapus", () => {
  assert.match(render(posesView, {}), /Memuat…/);
  const out = render(posesView, { poses: [{ id: 6, img_url: "/media/a.jpg", people_range_id: 2 }, { id: 7, img_url: "/img/pose-placeholder.jpg", people_range_id: 1 }] });
  assert.match(out, /<th>Foto<\/th><th>Jumlah orang<\/th><th><\/th>/);
  assert.match(out, /<form id="pose-form-6" novalidate data-submit="admin:savePose" data-id="6"><\/form>/);
  assert.match(out, /<label class="pthumb" style="background-image:url\('\/media\/a\.jpg'\)"><input type="file" accept="image\/\*" hidden form="pose-form-6" data-change="admin:uploadPoseImage" data-key="6" aria-label="Foto pose 3-5 orang"><\/label>/);
  assert.match(out, /<label class="pthumb" style="background-image:url\('\/img\/pose-placeholder\.jpg'\)">/);
  assert.match(out, /<option value="2" selected>3-5 orang<\/option>/);
  assert.match(out, /data-action="admin:deletePose" data-id="6">Hapus<\/button>/);
  assert.ok(!out.includes('name="nama"'));
  assert.ok(out.includes("Foto wajib diunggah saat menambah pose."));
});

test("pose: baris tambah (ikon unggah, Foto pose baru, + Tambah); foto baru dan draf jumlah orang tampil; kotak cari tidak menyaring", () => {
  const fresh = render(posesView, { poses: [] });
  assert.match(fresh, /<form id="pose-form-new" novalidate data-submit="admin:addPose"><\/form>/);
  assert.match(fresh, /<label class="pthumb" style=""><svg[^]*?data-change="admin:uploadPoseImage" data-key="new" aria-label="Foto pose baru">/);
  assert.match(fresh, /form="pose-form-new">\+ Tambah<\/button>/);
  const out = render(posesView, { poses: [{ id: 7, img_url: "/media/a.jpg", people_range_id: 1 }], images: { "pose-new": "/media/n.jpg", "pose-7": "/media/b.jpg" }, drafts: { "pose-7": { people_range_id: "2" } }, query: "apa saja" });
  assert.match(out, /background-image:url\('\/media\/n\.jpg'\)"><input[^>]*data-key="new"/);
  assert.match(out, /background-image:url\('\/media\/b\.jpg'\)"><input[^>]*data-key="7"/);
  assert.match(out, /id="po7r"[^>]*>(?:(?!<\/select>)[^])*<option value="2" selected>/);
});
