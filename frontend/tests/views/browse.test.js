import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { browseView } from "../../js/views/customer/browse.js";
import { sampleState } from "../helpers/fixtures.js";
import { flat } from "../helpers/markup.js";

const now = new Date(2026, 10, 25, 9, 30);
const match = { route: { name: "home" }, params: {}, query: {}, path: "/browse" };
const cardOf = (text, id) => text.slice(text.indexOf(`data-route="/studios/${id}"`), text.indexOf("</article>", text.indexOf(`data-route="/studios/${id}"`)));
const chipHours = card => [...card.matchAll(/data-hour="(\d+)"/g)].map(found => Number(found[1]));

test("browseView mengembalikan Safe dengan judul Browse dan Filter Jadwal", () => {
  const markup = browseView(sampleState(), match, now);
  assert.ok(markup instanceof Safe);
  assert.match(flat(markup), /<h1 class="h1">Browse<\/h1>/);
  assert.match(flat(markup), /Filter Jadwal/);
});

test("kartu studio: paling banyak tiga chip jam kosong di dalam rentang dari/sampai", () => {
  const state = sampleState({ persisted: { hDate: "2026-11-26", hFrom: 12, hTo: 18 }, runtime: { availability: { "1|2026-11-26": [9, 12, 13, 15, 16, 19] } } });
  const card = cardOf(flat(browseView(state, match, now)), 1);
  assert.deepEqual(chipHours(card), [12, 13, 15]);
  assert.match(card, /<button class="chip" data-action="booking:quickBook" data-studio="1" data-date="2026-11-26" data-hour="12">12:00 - 12:50<\/button>/);
});

test("kartu studio tanpa jam kosong: \"Tidak ada sesi tersedia\"", () => {
  const state = sampleState({ persisted: { hDate: "2026-11-26" }, runtime: { availability: { "2|2026-11-26": [] } } });
  const card = cardOf(flat(browseView(state, match, now)), 2);
  assert.match(card, /<span class="chip none">Tidak ada sesi tersedia<\/span>/);
  assert.deepEqual(chipHours(card), []);
});

test("tanpa data ketersediaan: jam setelah sekarang untuk hari ini (bawaan dari 08 sampai 20)", () => {
  const card = cardOf(flat(browseView(sampleState({ persisted: { hDate: "2026-11-25" } }), match, now)), 1);
  assert.deepEqual(chipHours(card), [10, 11, 12]);
});

test("bintang bookmark: aksi studio:toggleBookmark dengan data-stop, menyala bila dibookmark", () => {
  const text = flat(browseView(sampleState({ persisted: { bm: [2] } }), match, now));
  assert.match(cardOf(text, 1), /<button class="star " aria-label="Favorit" data-action="studio:toggleBookmark" data-id="1" data-stop>/);
  assert.match(cardOf(text, 2), /<button class="star on" aria-label="Favorit" data-action="studio:toggleBookmark" data-id="2" data-stop>/);
});

test("nama dan deskripsi studio di-escape", () => {
  const state = sampleState({ master: { studios: [{ id: 1, name: "<b>Melati</b>", description: "\"teduh\" & <i>", img: "", price: 0, people_range_id: 1 }] } });
  const text = flat(browseView(state, match, now));
  assert.match(text, /<h3>&lt;b&gt;Melati&lt;\/b&gt;<\/h3>/);
  assert.match(text, /<p class="desc">&quot;teduh&quot; &amp; &lt;i&gt;<\/p>/);
  assert.doesNotMatch(text, /<b>Melati/);
});

test("kartu studio membuka Detail Studio lewat data-route, gambar sebagai background", () => {
  const card = cardOf(flat(browseView(sampleState(), match, now)), 1);
  assert.match(flat(browseView(sampleState(), match, now)), /<div class="box" data-route="\/studios\/1"><div class="simg" style="background-image:url\('\/uploads\/melati.jpg'\)"><\/div>/);
  assert.match(card, /3 - 5/);
});

test("filter: tanggal lewat kalender (konteks home), jam dari/sampai lewat data-change", () => {
  const text = flat(browseView(sampleState({ persisted: { hDate: "2026-11-27", hFrom: 10, hTo: 15 } }), match, now));
  assert.match(text, /<button class="cd on" data-action="calendar:pick" data-context="home" data-date="2026-11-27">27<\/button>/);
  assert.match(text, /<select data-change="studio:setHourFrom">[^]*?<option value="10" selected>10:00<\/option>/);
  assert.match(text, /<select data-change="studio:setHourTo">[^]*?<option value="15" selected>15:00<\/option>/);
});

test("bulan kalender dari runtime.calendar.home, bawaan bulan sekarang", () => {
  assert.match(flat(browseView(sampleState(), match, now)), /<b>November 2026<\/b>/);
  assert.match(flat(browseView(sampleState({ runtime: { calendar: { home: { year: 2027, month: 0 } } } }), match, now)), /<b>Januari 2027<\/b>/);
});

test("strip paket: \"Lihat semua paket\" ke /packages, paket terpilih ditandai, harga coret saat diskon", () => {
  const text = flat(browseView(sampleState({ persisted: { pkg: 2 }, master: { discount: { pct: 10, label: "" } } }), match, now));
  assert.match(text, /<button class="btn sm ghost" data-route="\/packages">Lihat semua paket <svg/);
  assert.match(text, /<h4>Standard<\/h4><span class="tag">Dipilih<\/span>/);
  assert.match(text, /<h4>Basic<\/h4><\/div><div class="price"><s class="m">Rp50.000<\/s> Rp45.000<\/div>/);
  assert.doesNotMatch(text, /onclick=|onchange=/);
});

test("tanggal filter tersimpan yang sudah lewat (dibuka lagi esok hari): kembali ke hari ini", () => {
  const text = flat(browseView(sampleState({ persisted: { hDate: "2026-11-20" } }), match, now));
  assert.match(text, /<button class="cd on" data-action="calendar:pick" data-context="home" data-date="2026-11-25">25<\/button>/);
  assert.match(cardOf(text, 1), /data-date="2026-11-25" data-hour="10"/);
  assert.doesNotMatch(text, /Tidak ada sesi tersedia/);
});
