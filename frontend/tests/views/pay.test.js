import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { payView } from "../../js/views/customer/pay.js";
import { sampleState } from "../helpers/fixtures.js";

const match = { route: { name: "pay" }, params: {}, query: {}, path: "/book/pay" };
const quote = { studio_fee: 0, total: 90000, mainDisc: 0, pct: 0 };
const state = ({ persisted = {}, booking = {}, master = {} } = {}) => sampleState({ persisted: { pkg: 2, ...persisted }, master, booking: { studio: 1, date: "2026-11-27", slot: "2026-11-27 10:00", quote, ...booking }, runtime: { route: { name: "pay", params: {}, query: {} } } });
const kv = text => [...text.matchAll(/<div class="kv[^"]*"><span>([^<]*)<\/span><b>([^<]*)<\/b><\/div>/g)].map(found => [found[1], found[2]]);

test("tanpa sesi: Pilih jadwal terlebih dahulu; sesi tanpa quote: Memuat rincian pembayaran", () => {
  assert.match(String(payView(state({ booking: { slot: null, quote: null } }), match)), /Pilih jadwal terlebih dahulu\./);
  assert.match(String(payView(state({ booking: { quote: null } }), match)), /Memuat rincian pembayaran…/);
  assert.match(String(payView(state({ booking: { studio: 9 } }), match)), /Studio tidak tersedia/);
});

test("rincian pembayaran dari quote, tamu juga melihat total; Check Out = payment:confirm", () => {
  const markup = payView(state({ persisted: { me: null, user: null } }), match);
  assert.ok(markup instanceof Safe);
  const text = String(markup);
  assert.deepEqual(kv(text), [["Studio", "Rp0"], ["Paket Standard", "Rp90.000"], ["Total", "Rp90.000"]]);
  assert.match(text, /<div class="kv total"><span>Total<\/span><b>Rp90\.000<\/b><\/div>/);
  assert.match(text, /<button class="btn block" data-action="payment:confirm">Check Out<\/button>/);
  assert.match(text, /<button class="back" data-route="\/book\/time"><svg[^]*?<\/svg> Kembali<\/button>/);
  assert.match(text, /<h1 class="h1">Paket & Pembayaran<\/h1><span class="steps">2\/2<\/span>/);
  assert.match(text, /Melati · Jumat, 27 November · 10:00 - 10:50/);
  assert.doesNotMatch(text, /onclick=|onchange=/);
});

test("diskon utama dari quote", () => {
  const text = String(payView(state({ booking: { quote: { studio_fee: 0, total: 81000, mainDisc: 9000, pct: 10 } }, master: { discount: { pct: 10, label: "" } } }), match));
  assert.deepEqual(kv(text).slice(-2), [["Diskon utama (10%)", "-Rp9.000"], ["Total", "Rp81.000"]]);
});

test("paket terpilih ditandai di pill dan kolom tabel; pill = payment:selectPackage", () => {
  const text = String(payView(state(), match));
  assert.match(text, /<button class="pill " data-action="payment:selectPackage" data-id="1">Basic<\/button><button class="pill on" data-action="payment:selectPackage" data-id="2">Standard<\/button>/);
  assert.match(text, /<tr><td>Strip<\/td><td class="">3 foto<\/td><td class="sel">6 foto<\/td><\/tr>/);
  assert.match(text, /<tr><td>Bahan<\/td><td class="">Glossy<\/td><td class="sel">-<\/td><\/tr>/);
});

test("metode QRIS menampilkan QR, Transfer Bank menampilkan rekening; select = payment:setMethod", () => {
  const qris = String(payView(state(), match));
  assert.match(qris, /<select data-change="payment:setMethod"><option selected>QRIS<\/option><option >Transfer Bank<\/option><\/select>/);
  assert.match(qris, /<div class="qr"><svg viewBox="0 0 21 21"/);
  const transfer = String(payView(state({ persisted: { method: "Transfer Bank" } }), match));
  assert.match(transfer, /<option >QRIS<\/option><option selected>Transfer Bank<\/option>/);
  assert.match(transfer, /Transfer ke <b>BCA 123 456 7890<\/b><br>a\.n\. SelfieBox Studio \(simulasi\)/);
  assert.doesNotMatch(transfer, /<svg viewBox="0 0 21 21"/);
});

test("paket pilihan sudah tidak aktif: kartu Pilih Paket dengan paket aktif", () => {
  const text = String(payView(state({ persisted: { pkg: 3 } }), match));
  assert.match(text, /<h2 class="h2">Pilih Paket<\/h2><p class="sub">Paket sebelumnya tidak tersedia\. Pilih paket lain untuk melanjutkan\.<\/p>/);
  assert.equal((text.match(/data-action="payment:selectPackage"/g) || []).length, 2);
  assert.doesNotMatch(text, /Check Out/);
});
