// View Daftar Studio admin: accordion, form ubah, Tambah Studio dengan galat isian, Ringkasan Studio, kartu Berhasil
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAdminState } from "../../../js/controllers/AdminController.js";
import { studiosView } from "../../../js/views/admin/studios.js";
import { sampleState } from "../../helpers/fixtures.js";
import { flat } from "../../helpers/markup.js";

const now = new Date(2026, 10, 25, 9, 0);
const studio = (overrides = {}) => ({ id: 3, name: "Melati <b>", status: "AVAILABLE", description: "Terang", price: 15000, people_range_id: 2, budget_range_id: 1, img: "/media/m.jpg", sessions: 4, bookings: 5, active_bookings: 2, impact: {}, ...overrides });
const stateWith = admin => ({ ...sampleState({ master: { budgetRanges: [{ id: 1, budget: "< 100rb" }, { id: 2, budget: "100-200rb" }] } }), admin: { ...createAdminState(), ...admin } });
const render = admin => flat(studiosView(stateWith(admin), {}, now));

test("studios: Memuat… sampai daftar ada", () => {
  assert.match(render({}), /Memuat…/);
});

test("studios: baris accordion (nama di-escape, status, biaya · sesi · alamat, hapus, buka/tutup) dan tombol Tambah studio", () => {
  const out = render({ studios: [studio(), studio({ id: 4, name: "Mawar", status: "UNAVAILABLE" })] });
  assert.ok(out.includes("Melati &lt;b&gt;"));
  assert.match(out, /<span class="tag ok">Tersedia<\/span>/);
  assert.match(out, /<span class="tag off">Tidak tersedia<\/span>/);
  assert.ok(out.includes("Rp15.000 · 4 sesi<"));
  assert.match(out, /data-action="studio:delete" data-id="3"/);
  assert.match(out, /aria-label="Hapus Melati &lt;b&gt;"/);
  assert.match(out, /data-action="studio:toggleStudio" data-id="4"/);
  assert.match(out, /data-action="studio:openNew"[^>]*aria-expanded="false"/);
  assert.ok(out.includes("Tambah studio"));
  assert.ok(!out.includes("Detail Studio"));
});

test("studios: kotak cari menyaring nama, deskripsi, alamat", () => {
  const out = render({ studios: [studio(), studio({ id: 4, name: "Mawar", description: "Gelap" })], query: "gelap" });
  assert.ok(out.includes("Mawar"));
  assert.ok(!out.includes("Melati"));
});

test("studios: studio terbuka → form Detail Studio (data-submit studio:edit), pilihan terpilih, unggah gambar, catatan booking, panel sesi", () => {
  const out = render({ studios: [studio({ status: "UNAVAILABLE" })], openStudios: { 3: true } });
  assert.ok(out.includes("Detail Studio"));
  assert.ok(!out.includes("Detail Studio Baru"));
  assert.match(out, /<form[^>]*novalidate data-submit="studio:edit" data-id="3"/);
  assert.doesNotMatch(out, /name="address"|Alamat/);
  for (const name of ["name", "status", "description", "price", "people_range_id", "budget_range_id"]) assert.match(out, new RegExp(`name="${name}"`), name);
  assert.match(out, /<option value="UNAVAILABLE" selected>Tidak tersedia<\/option>/);
  assert.match(out, /<option value="2" selected>3-5 orang<\/option>/);
  assert.match(out, /<option value="1" selected>&lt; 100rb<\/option>/);
  assert.match(out, /type="file" accept="image\/\*" hidden data-change="studio:uploadImage" data-studio="3"/);
  assert.ok(out.includes("Unggah gambar"));
  assert.match(out, /background-image:url\('\/media\/m\.jpg'\)/);
  assert.match(out, /<button class="btn" type="submit">Simpan<\/button>/);
  assert.ok(out.includes("2 booking aktif dari 5 booking (tanpa yang batal) · status Tidak tersedia menyembunyikan studio dari customer tanpa mengubah booking yang sudah ada"));
  assert.ok(out.includes("Detail Sesi"));
  assert.match(out, /data-action="studio:toggleStudio" data-id="3"[^>]*aria-expanded="true"/);
});

test("studios: form ubah memakai draf yang gagal disimpan dan gambar yang baru diunggah", () => {
  const out = render({ studios: [studio()], openStudios: { 3: true }, drafts: { "studio-3": { name: "Draf", status: "AVAILABLE", description: "", price: "abc", people_range_id: "1", budget_range_id: "2" } }, images: { 3: "/media/baru.jpg" } });
  assert.match(out, /name="name"[^>]*value="Draf"/);
  assert.match(out, /name="price"[^>]*value="abc"/);
  assert.match(out, /background-image:url\('\/media\/baru\.jpg'\)/);
});

test("studios: Tambah studio terbuka → Detail Studio Baru dengan petunjuk, Batal dan Lihat Ringkasan (data-submit studio:review)", () => {
  const out = render({ studios: [], openStudios: { new: true } });
  assert.ok(out.includes("Detail Studio Baru"));
  assert.ok(out.includes("Isi data studio. Nama dan gambar wajib diisi, dan nama tidak boleh sama dengan studio lain."));
  assert.match(out, /<form[^>]*novalidate data-submit="studio:review"/);
  assert.match(out, /data-action="studio:cancelNew"[^>]*>Batal<\/button>/);
  assert.match(out, /type="submit">Lihat Ringkasan<\/button>/);
  assert.doesNotMatch(out, /name="address"|Alamat/);
  assert.match(out, /data-change="studio:uploadImage" data-studio="new"/);
  assert.ok(out.includes("Belum ada gambar"));
  assert.ok(!out.includes("ferr"));
});

test("studios: galat Tambah Studio → banner role=alert (+ galat lain), field ditandai dengan aria-describedby; isian tetap", () => {
  const out = render({ studios: [], openStudios: { new: true }, newStudio: { name: "Melati", status: "AVAILABLE", description: "x", price: -1, people_range_id: 1, budget_range_id: 1 }, studioErrors: { top: "Input studio tidak valid. Periksa field yang ditandai.", name: "Nama studio sudah digunakan. Gunakan nama lain.", price: "Biaya sewa harus bilangan bulat 0 atau lebih.", img: "Gambar studio wajib diunggah.", other: "Gambar rusak" } });
  assert.match(out, /<div class="ferr-top" role="alert">.*Input studio tidak valid\. Periksa field yang ditandai\. \(Gambar rusak\)/s);
  assert.match(out, /<input id="stNn" name="name" class="inv"[^>]*value="Melati" aria-invalid="true" aria-describedby="ste_name">/);
  assert.match(out, /<p class="ferr" id="ste_name">Nama studio sudah digunakan\. Gunakan nama lain\.<\/p>/);
  assert.match(out, /<p class="ferr" id="ste_price">/);
  assert.match(out, /<div class="thumb inv"/);
  assert.match(out, /<p class="ferr" id="ste_img">Gambar studio wajib diunggah\.<\/p>/);
});

test("studios: gambar baru sudah diunggah → Ganti gambar", () => {
  const out = render({ studios: [], openStudios: { new: true }, images: { new: "/media/n.jpg" } });
  assert.ok(out.includes("Ganti gambar"));
  assert.match(out, /background-image:url\('\/media\/n\.jpg'\)/);
});

test("studios: Ringkasan Studio (Figma 592:4329) dengan Ubah dan Simpan Studio", () => {
  const out = render({ studios: [], openStudios: { new: true }, studioSummary: true, images: { new: "/media/n.jpg" }, newStudio: { name: " Senja <i> ", status: "UNAVAILABLE", description: "", price: 20000, people_range_id: 2, budget_range_id: 2 } });
  assert.ok(out.includes("Tambah studio · Ringkasan"));
  assert.ok(out.includes("Ringkasan Studio"));
  assert.ok(out.includes("Periksa data studio baru sebelum disimpan. Pilih Ubah untuk memperbaiki isian."));
  for (const row of ["<dt>Nama</dt><dd>Senja &lt;i&gt;</dd>", "<dt>Deskripsi</dt><dd>-</dd>", "<dt>Status</dt><dd>Tidak tersedia</dd>", "<dt>Biaya sewa studio</dt><dd>Rp20.000</dd>", "<dt>Kapasitas</dt><dd>3-5 orang</dd>", "<dt>Rentang budget</dt><dd>100-200rb</dd>"]) assert.ok(out.includes(row), row);
  assert.match(out, /role="img" aria-label="Gambar Senja &lt;i&gt;"/);
  assert.match(out, /data-action="studio:backToForm"[^>]*>.*Ubah<\/button>/s);
  assert.match(out, /data-action="studio:save"[^>]*>Simpan Studio<\/button>/);
  assert.ok(!out.includes("Lihat Ringkasan"));
});

test("studios: kartu Studio berhasil ditambahkan (Figma 592:4689) di atas daftar", () => {
  const out = render({ studios: [studio()], studioDone: { title: "Studio berhasil ditambahkan", text: "Senja tersedia dan tampil di daftar studio pelanggan." } });
  assert.match(out, /^<div class="toast okc" role="status">.*<b>Studio berhasil ditambahkan<\/b><small>Senja tersedia dan tampil di daftar studio pelanggan\.<\/small>/s);
});
