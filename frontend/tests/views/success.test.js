import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { successView } from "../../js/views/customer/success.js";
import { rescheduledView } from "../../js/views/customer/rescheduled.js";
import { sampleState } from "../helpers/fixtures.js";

const booking = { id: 12, studio: 1, package_id: 2, date: "2026-11-27 10:00", paid_at: Date.UTC(2026, 10, 25, 3, 4, 5), pay_status: "paid", method: "QRIS", studio_fee: 0, subtotal: 90000, main_disc: 0, amount: 90000 };
const matchFor = id => ({ route: { name: "success" }, params: { id: String(id) }, query: {}, path: `/bookings/${id}/success` });
const links = { invoiceUrl: (id, download) => `/api/bookings/${id}/invoice?t=tok${download ? "&dl=1" : ""}` };
const state = (persisted = {}) => {
  const value = sampleState({ persisted });
  value.data.bookings = [booking];
  return value;
};

test("success: booking belum dimuat → Memuat…", () => {
  assert.match(String(successView(state(), matchFor(99), links)), /Memuat…/);
});

test("success: detail transaksi, invoice, kirim ke email, kembali ke Browse", () => {
  const markup = successView(state(), matchFor(12), links);
  assert.ok(markup instanceof Safe);
  const text = String(markup);
  assert.match(text, /<h1 class="h1">Studio Berhasil Direservasi<\/h1><img class="ill" src="\/img\/ill-booking.png" alt="">/);
  assert.match(text, /<span>Studio<\/span><b>Melati<\/b>/);
  assert.match(text, /<a class="btn ghost grow" href="\/api\/bookings\/12\/invoice\?t=tok&amp;dl=1" download><svg[^]*?<\/svg> Unduh invoice<\/a>/);
  assert.match(text, /<button class="btn ghost" aria-label="Kirim invoice ke email" data-action="payment:emailInvoice" data-id="12">/);
  assert.match(text, /<button class="btn block" style="margin-top:10px" data-route="\/browse">Kembali ke Beranda<\/button>/);
  assert.doesNotMatch(text, /onclick=/);
});

test("success: Detail Pembayaran tertutup, payOpen membukanya", () => {
  const closed = String(successView(state(), matchFor(12), links));
  assert.match(closed, /<button class="coll" data-action="payment:togglePaymentDetail">Detail Pembayaran /);
  assert.doesNotMatch(closed, /<span>Metode<\/span>/);
  const open = String(successView(state({ payOpen: true }), matchFor(12), links));
  assert.match(open, /<div style="padding-bottom:10px"><div class="kv "><span>Waktu<\/span>/);
  assert.match(open, /<span>Metode<\/span><b>QRIS<\/b>/);
});

test("rescheduled: Reschedule Berhasil dengan detail booking; tanpa booking → Memuat…", () => {
  const text = String(rescheduledView(state(), { ...matchFor(12), route: { name: "rescheduled" } }));
  assert.match(text, /<h1 class="h1">Reschedule Berhasil<\/h1><img class="ill" src="\/img\/ill-reschedule.png" alt="">/);
  assert.match(text, /<span>Jam<\/span><b>10:00 - 10:50<\/b>/);
  assert.match(text, /data-route="\/browse">Kembali ke Beranda<\/button>/);
  assert.match(String(rescheduledView(state(), matchFor(5))), /Memuat…/);
});
