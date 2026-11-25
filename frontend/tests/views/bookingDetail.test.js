import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { bookingDetailView } from "../../js/views/customer/bookingDetail.js";
import { sampleState } from "../helpers/fixtures.js";

const now = new Date(2026, 10, 25, 9, 30);
const links = { invoiceUrl: (id, download) => `/api/bookings/${id}/invoice?t=tok${download ? "&dl=1" : ""}` };
const matchFor = id => ({ route: { name: "bdetail" }, params: { id: String(id) }, query: {}, path: `/bookings/${id}` });
const base = { id: 12, user_id: 5, studio: 1, package_id: 2, date: "2026-11-27 10:00", paid_at: Date.UTC(2026, 10, 25, 3, 4, 5), pay_status: "paid", method: "QRIS", studio_fee: 0, subtotal: 90000, main_disc: 0, amount: 90000, paid: 1 };
function view(fields = {}, id = 12) {
  const value = sampleState({ persisted: { me: 5 } });
  value.data.bookings = [{ ...base, ...fields }];
  return String(bookingDetailView(value, matchFor(id), links, now));
}

test("bookingDetail: tidak ditemukan → kembali ke Booking Saya", () => {
  const value = sampleState();
  const markup = bookingDetailView(value, matchFor(99), links, now);
  assert.ok(markup instanceof Safe);
  assert.match(String(markup), /<button class="back" data-route="\/bookings"><svg[^]*?<\/svg> Kembali<\/button><div class="card">Booking tidak ditemukan\.<\/div>/);
});

test("bookingDetail: Terbayar → Reschedule, Batalkan, Check-in; tautan studio; detail + invoice", () => {
  const text = view({ status: "Terbayar" });
  assert.match(text, /<button class="back" data-route="\/bookings"><svg[^]*?<\/svg> Booking Saya<\/button>/);
  assert.match(text, /<a href="\/studios\/1" data-route="\/studios\/1" style="color:inherit;text-decoration:none">Melati <svg/);
  assert.match(text, /<button class="btn sm" data-action="booking:startReschedule" data-id="12">Reschedule<\/button><button class="btn sm ghost" data-action="booking:openCancel" data-id="12">Batalkan<\/button>/);
  assert.match(text, /<button class="btn sm soft" data-action="photo:start" data-id="12"><svg[^]*?<\/svg> Check-in & Mulai Sesi<\/button>/);
  assert.doesNotMatch(text, /payment:payNow/);
  assert.match(text, /<span>Studio<\/span><b>Melati<\/b>/);
  assert.match(text, /<span>Metode<\/span><b>QRIS<\/b>/);
  assert.match(text, /<a class="btn sm ghost" href="\/api\/bookings\/12\/invoice\?t=tok&amp;dl=1" download><svg[^]*?<\/svg> Unduh invoice<\/a><button class="btn sm ghost" data-action="payment:emailInvoice" data-id="12">/);
  assert.match(text, /<span class="tag ok">Terbayar<\/span>/);
  assert.doesNotMatch(text, /onclick=/);
});

test("bookingDetail: Menunggu Pembayaran → Bayar, tanpa invoice; studio tersembunyi → tanpa Reschedule", () => {
  const pending = view({ status: "Menunggu Pembayaran", paid: 0, pay_status: "pending", expire_at: now.getTime() + 60000 });
  assert.match(pending, /<button class="btn sm" data-action="payment:payNow" data-id="12">Bayar<\/button>/);
  assert.doesNotMatch(pending, /Unduh invoice/);
  const hidden = view({ status: "Terbayar", studio: 9 });
  assert.doesNotMatch(hidden, /booking:startReschedule/);
  assert.match(hidden, /booking:openCancel/);
});

test("bookingDetail: belum dibayar dan lewat batas → Dibatalkan, tanpa tombol aksi (decisions.md 56)", () => {
  const text = view({ status: "Menunggu Pembayaran", paid: 0, pay_status: "pending", expire_at: now.getTime() - 1 });
  assert.match(text, /<span class="tag no">Dibatalkan<\/span>/);
  assert.doesNotMatch(text, /payment:payNow|booking:openCancel/);
});

test("bookingDetail: Sesi Berjalan → Buka Sesi; Dibatalkan → alasan, tanpa invoice", () => {
  assert.match(view({ status: "Sesi Berjalan" }), /<button class="btn sm soft" data-action="photo:open">Buka Sesi<\/button>/);
  const cancelled = view({ status: "Dibatalkan", cancel_reason: "Tidak ada <waktu>" });
  assert.match(cancelled, /<hr><div class="kv"><span>Alasan pembatalan<\/span><b>Tidak ada &lt;waktu&gt;<\/b><\/div>/);
  assert.doesNotMatch(cancelled, /Unduh invoice|data-action="booking:/);
});
