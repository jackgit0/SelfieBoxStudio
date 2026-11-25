import { test } from "node:test";
import assert from "node:assert/strict";
import { Safe } from "../../js/core/html.js";
import { refundView } from "../../js/views/customer/refund.js";
import { sampleState } from "../helpers/fixtures.js";

const matchFor = id => ({ route: { name: "refund" }, params: { id: String(id) }, query: {}, path: `/bookings/${id}/refund` });
function view(cancelResult, id = 12) {
  const value = sampleState({ persisted: { cancelRes: cancelResult } });
  value.data.bookings = [{ id: 12, studio: 1, package_id: 1, date: "2026-11-27 10:00", status: "Dibatalkan" }];
  const markup = refundView(value, matchFor(id));
  assert.ok(markup instanceof Safe);
  return String(markup);
}

test("refund: berhasil → waktu, status Refunded, total, kembali ke Browse", () => {
  const text = view({ refund: { state: "refunded", amount: 90000, at: Date.UTC(2026, 10, 25, 3, 4, 5), min_hours: 2 } });
  assert.match(text, /<h1 class="h1">Refund Berhasil<\/h1><img class="ill" src="\/img\/ill-refund-ok.png" alt="">/);
  assert.match(text, /<span>Status<\/span><b>Refunded<\/b>/);
  assert.match(text, /<span>Total<\/span><b>Rp90\.000<\/b>/);
  assert.match(text, /<button class="btn block" style="margin-top:18px" data-route="\/browse">Kembali ke Beranda<\/button>/);
  assert.doesNotMatch(text, /onclick=/);
});

test("refund: gagal → kalimat batas jam, Hubungi Customer Service, kembali", () => {
  const text = view({ refund: { state: "failed", amount: 90000, at: null, min_hours: 2 } });
  assert.match(text, /<h1 class="h1">Maaf Refund Gagal<\/h1><img class="ill" src="\/img\/ill-refund-fail.png" alt="">/);
  assert.match(text, /refund hanya tersedia untuk pembatalan minimal 2 jam sebelum sesi\./);
  assert.match(text, /<button class="btn block" style="margin-top:18px" data-action="package:contactCs">Hubungi Customer Service<\/button><button class="btn ghost block" style="margin-top:10px" data-route="\/browse">Kembali ke Beranda<\/button>/);
});

test("refund: belum dibayar → Booking Dibatalkan tanpa refund", () => {
  const text = view({ refund: { state: "none", amount: 0, at: null, min_hours: 2 } });
  assert.match(text, /<h1 class="h1">Booking Dibatalkan<\/h1><p class="m" style="margin:10px 0 18px">Booking belum dibayar, jadi tidak ada refund yang diperlukan\.<\/p><button class="btn block" data-route="\/browse">Kembali ke Beranda<\/button>/);
});

test("refund: tanpa hasil pembatalan tersimpan atau booking tidak ada → Booking dibatalkan", () => {
  for (const text of [view(null), view({ refund: { state: "refunded", amount: 1, at: 1 } }, 99)]) {
    assert.match(text, /<div class="panel"><div class="card center">Booking dibatalkan\.<div style="margin-top:12px"><button class="btn" data-route="\/browse">Kembali ke Beranda<\/button><\/div><\/div><\/div>/);
  }
});
