import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { packagesView, missingPackageModal } from "../../js/views/customer/packages.js";
import { sampleState, sampleMaster } from "../helpers/fixtures.js";

const match = { route: { name: "packages" }, params: {}, query: {}, path: "/packages" };
const cards = text => text.split('<article class="pkc').slice(1);

test("packagesView: judul Pilihan Paket, kembali ke Browse lewat data-route", () => {
  const markup = packagesView(sampleState(), match);
  assert.ok(markup instanceof Safe);
  const text = String(markup);
  assert.match(text, /<button class="ib" aria-label="Kembali ke Browse" data-route="\/browse"><svg/);
  assert.match(text, /<h1 class="h1">Pilihan Paket<\/h1>/);
  assert.match(text, /Temukan Paket Sesuai Kebutuhanmu/);
});

test("satu kartu per paket aktif, dengan \"Pilih Paket Ini\" (package:choose)", () => {
  const text = String(packagesView(sampleState(), match));
  assert.equal(cards(text).length, 2);
  assert.match(text, /<button class="btn block ghost" data-action="package:choose" data-id="1">Pilih Paket Ini<\/button>/);
  assert.match(text, /<button class="btn block " data-action="package:choose" data-id="2">Pilih Paket Ini<\/button>/);
  assert.doesNotMatch(text, /Paket Lama/);
  assert.doesNotMatch(text, /onclick=/);
});

test("lencana \"Paling Favorit\" hanya pada favouritePackageId", () => {
  const list = cards(String(packagesView(sampleState(), match)));
  assert.doesNotMatch(list[0], /Paling Favorit/);
  assert.match(list[1], /^ fav"><span class="badge">Paling Favorit<\/span>/);
  assert.doesNotMatch(String(packagesView(sampleState({ master: { favouritePackageId: null } }), match)), /Paling Favorit/);
});

test("harga: tanpa diskon satu harga, dengan diskon harga asli dicoret", () => {
  assert.match(String(packagesView(sampleState(), match)), /<div class="pp">Rp50.000 <small>\/ sesi<\/small><\/div>/);
  assert.match(String(packagesView(sampleState({ master: { discount: { pct: 10, label: "" } } }), match)), /<div class="pp"><s>Rp50.000<\/s> Rp45.000 <small>\/ sesi<\/small><\/div>/);
});

test("deskripsi dan fitur: bagian tebal, nama di-escape, paket terpilih ditandai", () => {
  const master = { packages: [{ id: 1, name: "<i>Basic</i>", price: 50000, photo_count: 3, dur: 15, strip_size: "2x6", strip_material: "Glossy" }] };
  const text = String(packagesView(sampleState({ master, persisted: { pkg: 1 } }), match));
  assert.match(text, /<h3>Paket &lt;i&gt;Basic&lt;\/i&gt;<\/h3><span class="tag">Dipilih<\/span>/);
  assert.match(text, /<p class="pd">3 foto · 15 menit · cetak 2x6<\/p>/);
  assert.match(text, /<li><svg[^]*?<\/svg><span><b>3 foto<\/b> cetak strip 2x6<\/span><\/li>/);
  assert.match(text, /<span>Kertas foto <b>Glossy<\/b><\/span>/);
  assert.match(text, /<span>Galeri online 30 hari<\/span>/);
});

test("popup paket hilang: judul, status, daftar paket (data-v), lihat paket lain dan Customer Service", () => {
  const options = missingPackageModal(sampleMaster());
  assert.equal(options.title, "Paket Foto Tidak Ditemukan");
  assert.equal(options.className, "wide center");
  assert.match(String(options.kicker), /<span class="tag no mkick">STATUS PAKET: TIDAK TERSEDIA<\/span>/);
  const body = String(options.body);
  assert.match(body, /Maaf, paket foto yang Anda pilih saat ini sudah tidak tersedia/);
  assert.match(body, /<button class="mpkr" data-v="2"><span><b>Paket Standard<\/b><small>6 foto · 25 menit · cetak 4x6<\/small><\/span><b>Rp90.000<\/b><\/button>/);
  assert.deepEqual(options.buttons, [{ label: "Lihat & Pilih Paket Lain", value: "list", icon: "box" }, { label: "Hubungi Customer Service", value: "cs", style: "soft", icon: "mail" }]);
});

test("popup paket hilang di langkah booking: judul dan kalimat Create Booking", () => {
  const options = missingPackageModal(sampleMaster(), { booking: true });
  assert.equal(options.title, "Paket Tidak Ditemukan");
  assert.match(String(options.body), /<p>Paket tidak ditemukan. Silakan pilih paket lain.<\/p>/);
});
