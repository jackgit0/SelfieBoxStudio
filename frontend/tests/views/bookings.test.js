import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { bookingsView } from "../../js/views/customer/bookings.js";
import { sampleState } from "../helpers/fixtures.js";

const now = new Date(2026, 10, 25, 9, 30);
const matchFor = (query = {}) => ({ route: { name: "my" }, params: {}, query, path: "/bookings" });
function state(bookings) {
  const value = sampleState({ persisted: { me: 5, user: { id: 5, name: "Dewi" } } });
  value.data.bookings = bookings;
  return value;
}
const list = [
  { id: 1, user_id: 5, studio: 1, package_id: 2, status: "Terbayar", date: "2026-11-28 10:00" },
  { id: 2, user_id: 5, studio: 2, package_id: 1, status: "Menunggu Pembayaran", date: "2026-11-27 13:00", expire_at: now.getTime() + 60000 },
  { id: 3, user_id: 5, studio: 1, package_id: 1, status: "Selesai", date: "2026-11-20 09:00" },
  { id: 4, user_id: 5, studio: 2, package_id: 1, status: "Menunggu Pembayaran", date: "2026-11-29 09:00", expire_at: now.getTime() - 1 },
  { id: 5, user_id: 8, studio: 2, package_id: 1, status: "Terbayar", date: "2026-11-27 09:00" },
];

test("bookings: tab Mendatang aktif tanpa ?tab, dua tombol tab lewat data-route", () => {
  const markup = bookingsView(state(list), matchFor(), now);
  assert.ok(markup instanceof Safe);
  const text = String(markup);
  assert.match(text, /<h1 class="h1">Booking Saya<\/h1><div class="seg"><button class="on" data-route="\/bookings">Mendatang<\/button><button class="" data-route="\/bookings\?tab=history">Riwayat<\/button><\/div>/);
  assert.doesNotMatch(text, /onclick=/);
});

test("bookings: Mendatang dikelompokkan per hari, terdekat dulu, hanya milik user, baris membuka detail", () => {
  const text = String(bookingsView(state(list), matchFor(), now));
  const days = [...text.matchAll(/<div class="dayh">([^<]+)<\/div>/g)].map(found => found[1]);
  assert.equal(days.length, 2);
  assert.ok(text.indexOf('data-route="/bookings/2"') < text.indexOf('data-route="/bookings/1"'));
  assert.doesNotMatch(text, /\/bookings\/5"/);
  assert.match(text, /<button class="brow" data-route="\/bookings\/1"><div><b>Melati<\/b><div class="sub">Standard · <span class="tag ok">Terbayar<\/span><\/div><\/div><b>10:00 - 10:50<\/b><\/button>/);
  assert.match(text, /<span class="tag warn">Menunggu Pembayaran<\/span>/);
});

test("bookings: Riwayat (?tab=history) terbaru dulu; booking belum dibayar yang lewat batas tampil Dibatalkan", () => {
  const text = String(bookingsView(state(list), matchFor({ tab: "history" }), now));
  assert.match(text, /<button class="" data-route="\/bookings">Mendatang<\/button><button class="on" data-route="\/bookings\?tab=history">Riwayat<\/button>/);
  assert.ok(text.indexOf('data-route="/bookings/4"') < text.indexOf('data-route="/bookings/3"'));
  assert.match(text, /data-route="\/bookings\/4"><div><b>Mawar<\/b><div class="sub">Basic · <span class="tag no">Dibatalkan<\/span>/);
  assert.doesNotMatch(text, /data-route="\/bookings\/1"/);
});

test("bookings: kosong → pesan per tab dan Cari studio ke /browse", () => {
  const upcoming = String(bookingsView(state([]), matchFor(), now));
  assert.match(upcoming, /<div class="card center m" style="margin-top:12px">Belum ada booking mendatang\.<div style="margin-top:12px"><button class="btn" data-route="\/browse">Cari studio<\/button><\/div><\/div>/);
  assert.match(String(bookingsView(state([]), matchFor({ tab: "history" }), now)), /Belum ada riwayat booking\./);
});

test("bookings: nama studio di-escape", () => {
  const value = state([{ id: 1, user_id: 5, studio: 1, package_id: 1, status: "Terbayar", date: "2026-11-28 10:00" }]);
  value.master.allStudios[0].name = "<b>Melati</b>";
  value.master.studios[0].name = "<b>Melati</b>";
  assert.match(String(bookingsView(value, matchFor(), now)), /&lt;b&gt;Melati&lt;\/b&gt;/);
});
