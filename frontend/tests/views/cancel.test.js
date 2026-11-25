import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { cancelView } from "../../js/views/customer/cancel.js";
import { sampleState } from "../helpers/fixtures.js";

const matchFor = id => ({ route: { name: "cancel" }, params: { id: String(id) }, query: {}, path: `/bookings/${id}/cancel` });
function view({ paid = 1, reason = "", detail = "" } = {}, id = 12) {
  const value = sampleState({ runtime: { cancel: { reason, detail } } });
  value.data.bookings = [{ id: 12, studio: 1, package_id: 1, date: "2026-11-27 10:00", status: "Terbayar", paid }];
  return textOf(cancelView(value, matchFor(id)));
}
const textOf = markup => {
  assert.ok(markup instanceof Safe);
  return String(markup);
};

test("cancel: tidak ditemukan", () => {
  assert.equal(view({}, 99), '<div class="card">Booking tidak ditemukan.</div>');
});

test("cancel: tombol Refund disabled sampai alasan dipilih; empat alasan lewat data-action", () => {
  const text = view();
  assert.match(text, /<button class="back" data-route="\/bookings\/12"><svg[^]*?<\/svg> Kembali<\/button><h1 class="h1">Pembatalan Booking<\/h1><p class="sub">Melati · /);
  assert.equal([...text.matchAll(/data-action="booking:setCancelReason"/g)].length, 4);
  assert.match(text, /<button class="reason " data-action="booking:setCancelReason" data-reason="Tidak ada waktu"><i><\/i>Tidak ada waktu<\/button>/);
  assert.match(text, /<button class="btn block" style="margin-top:8px" disabled data-action="booking:cancel" data-id="12">Refund<\/button>/);
  assert.match(text, /Refund diproses otomatis jika pembatalan dilakukan minimal 2 jam sebelum sesi dimulai\./);
  assert.doesNotMatch(text, /<textarea/);
  assert.doesNotMatch(text, /onclick=|oninput=/);
});

test("cancel: alasan terpilih menyalakan tombol; textarea hanya untuk Pembatalan lainnya (isi di-escape)", () => {
  const chosen = view({ reason: "Pemesanan ganda" });
  assert.match(chosen, /<button class="reason on" data-action="booking:setCancelReason" data-reason="Pemesanan ganda">/);
  assert.match(chosen, /<button class="btn block" style="margin-top:8px"  data-action="booking:cancel" data-id="12">Refund<\/button>/);
  assert.doesNotMatch(chosen, /<textarea/);
  const other = view({ reason: "Pembatalan lainnya", detail: "<sakit>" });
  assert.match(other, /<textarea placeholder="Tuliskan alasan pembatalan kamu" data-input="booking:setCancelDetail">&lt;sakit&gt;<\/textarea>/);
});

test("cancel: belum dibayar → Batalkan Booking, tanpa kalimat refund", () => {
  const text = view({ paid: 0, reason: "Tidak ada waktu" });
  assert.match(text, />Batalkan Booking<\/button>/);
  assert.doesNotMatch(text, /Refund diproses/);
});
