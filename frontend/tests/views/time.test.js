import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { timeView } from "../../js/views/customer/time.js";
import { sampleState } from "../helpers/fixtures.js";
import { flat } from "../helpers/markup.js";

const now = new Date(2026, 10, 25, 9, 30);
const timeMatch = { route: { name: "time" }, params: {}, query: {}, path: "/book/time" };
const rescheduleMatch = { route: { name: "time" }, params: { id: "7" }, query: {}, path: "/bookings/7/reschedule" };
const state = (booking = {}, runtime = {}) => sampleState({ booking: { studio: 1, date: "2026-11-27", ...booking }, runtime: { route: { name: "time", params: {}, query: {} }, ...runtime } });
const pills = text => [...text.matchAll(/<button class="pill( on)?"\s+(disabled\s+)?data-action="booking:pickSlot" data-slot="([^"]+)">/g)].map(found => ({ on: Boolean(found[1]), disabled: Boolean(found[2]), slot: found[3] }));

test("tanpa studio: Pilih studio terlebih dahulu; studio tersembunyi: Studio tidak tersedia", () => {
  assert.match(flat(timeView(sampleState(), timeMatch, now)), /Pilih studio terlebih dahulu\./);
  const hidden = flat(timeView(state({ studio: 9 }), timeMatch, now));
  assert.match(hidden, /Studio tidak tersedia/);
  assert.match(hidden, /data-route="\/browse"/);
  const hiddenReschedule = flat(timeView(state({ studio: 9, rescheduleId: 7 }), rescheduleMatch, now));
  assert.match(hiddenReschedule, /data-route="\/bookings\/7">Kembali ke booking/);
});

test("booking baru: judul, langkah 1/2, Kembali ke Detail Studio, tombol Lanjut ke Pembayaran tidak pernah disabled", () => {
  const markup = timeView(state(), timeMatch, now);
  assert.ok(markup instanceof Safe);
  const text = flat(markup);
  assert.match(text, /<button class="back" data-route="\/studios\/1"><svg[^]*?<\/svg> Kembali<\/button>/);
  assert.match(text, /<h1 class="h1">Pilih Tanggal &amp; Waktu<\/h1><p class="sub">Melati · Jl. Veteran 3<\/p><\/div><span class="steps">1\/2<\/span>/);
  assert.match(text, /<button class="btn block" style="margin-top:22px" data-action="booking:next">Lanjut ke Pembayaran<\/button>/);
  assert.doesNotMatch(text, /disabled[^>]*data-action="booking:next"/);
  assert.doesNotMatch(text, /onclick=|onchange=/);
});

test("jam yang terisi atau lewat dinonaktifkan, sesi terpilih menyala", () => {
  const text = flat(timeView(state({ slot: "2026-11-27 11:00" }, { availability: { "1|2026-11-27": [10, 11] } }), timeMatch, now));
  const list = pills(text);
  assert.equal(list.length, 13);
  assert.deepEqual(list.filter(pill => !pill.disabled).map(pill => pill.slot), ["2026-11-27 10:00", "2026-11-27 11:00"]);
  assert.deepEqual(list.filter(pill => pill.on).map(pill => pill.slot), ["2026-11-27 11:00"]);
  assert.match(text, /08:00 - 08:50/);
});

test("tanpa tanggal: hari ini, jam yang sudah lewat dinonaktifkan", () => {
  const list = pills(flat(timeView(state({ date: null }), timeMatch, now)));
  assert.equal(list[0].slot, "2026-11-25 8:00"); // jam tanpa nol di depan, seperti kode lama dan chip Browse
  assert.deepEqual(list.slice(0, 3).map(pill => pill.disabled), [true, true, false]);
});

test("mode reschedule: Ubah Jadwal, Batal ubah jadwal ke detail booking, Simpan Jadwal Baru, tanpa langkah", () => {
  const text = flat(timeView(state({ rescheduleId: 7 }), rescheduleMatch, now));
  assert.match(text, /<button class="back" data-route="\/bookings\/7"><svg[^]*?<\/svg> Batal ubah jadwal<\/button>/);
  assert.match(text, /<h1 class="h1">Ubah Jadwal<\/h1>/);
  assert.match(text, /data-action="booking:next">Simpan Jadwal Baru<\/button>/);
  assert.doesNotMatch(text, /class="steps"/);
});

test("kalender konteks book: bulan dari runtime.calendar.book, tanggal booking terpilih", () => {
  const text = flat(timeView(state({}, { calendar: { book: { year: 2026, month: 11 } } }), timeMatch, now));
  assert.match(text, /data-context="book"/);
  assert.match(text, /desember 2026/i);
  const november = flat(timeView(state(), timeMatch, now));
  assert.match(november, /<button class="cd on"\s+data-action="calendar:pick" data-context="book" data-date="2026-11-27">27<\/button>/);
});

test("kalender tanpa bulan tersimpan membuka bulan tanggal booking (tanggal Desember terlihat dan terpilih)", () => {
  const text = flat(timeView(state({ date: "2026-12-02" }), timeMatch, now));
  assert.match(text, /<b>Desember 2026<\/b>/);
  assert.match(text, /<button class="cd on"\s+data-action="calendar:pick" data-context="book" data-date="2026-12-02">2<\/button>/);
});
