// View Daftar Booking admin: saringan status, tabel, panel Detail Booking, form Ubah Booking
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAdminState } from "../../../js/controllers/AdminController.js";
import { bookingsView } from "../../../js/views/admin/bookings.js";
import { sampleState } from "../../helpers/fixtures.js";
import { flat } from "../../helpers/markup.js";

const row = (overrides = {}) => ({ id: 5, customer: "Budi <b>", email: "budi@x.id", studio: "Melati", package: "Basic", slot: "2026-11-26 9:00", amount: 50000, status: "Menunggu Pembayaran", cancel_reason: "", pay_status: "pending", method: "QRIS", ...overrides });
const detail = (overrides = {}) => ({
  id: 5, slot: "2026-11-26 9:00", customer: { name: "Budi <b>", email: "budi@x.id", phone: "0812" }, studio_name: "Melati", studio_session: { date: "2026-11-26", start: "09:00", end: "09:50", deleted: false },
  package_name: "Basic", package_id: 1, status: "Menunggu Pembayaran", cancel_reason: "", cancel_detail: "", created_at: Date.UTC(2026, 10, 25, 2, 0),
  payment: { status: "pending", paid_at: null, method: "QRIS", refunded_at: null, expire_at: Date.UTC(2026, 10, 25, 2, 15), amount: 50000 },
  invoice: "INV-5", items_price: 50000, studio_fee: 0, main_disc: 5000, amount: 45000, allowed: ["Terbayar", "Dibatalkan"], packages: [{ id: 1, name: "Basic", price: 50000 }, { id: 2, name: "Standard", price: 90000 }], delete_block: "", impact: {}, ...overrides,
});
const render = admin => flat(bookingsView({ ...sampleState(), admin: { ...createAdminState(), ...admin } }));

test("booking: Memuat… sampai daftar ada", () => {
  assert.match(render({}), /Memuat…/);
});

test("booking: saringan status (data-change), jumlah, baris tabel dengan tag status dan pembayaran, tombol Detail", () => {
  const out = render({ bookings: [row(), row({ id: 6, status: "Dibatalkan", cancel_reason: "Sakit", pay_status: "refunded", method: "" })], bookingFilter: "Dibatalkan" });
  assert.match(out, /<select style="width:auto" aria-label="Saring status" data-change="adminBooking:setFilter"><option value="">Semua status<\/option>/);
  assert.match(out, /<option selected>Dibatalkan<\/option>/);
  assert.ok(out.includes("2 booking"));
  assert.ok(out.includes("Budi &lt;b&gt;<br><small class=\"m\">budi@x.id</small>"));
  assert.match(out, /<span class="tag warn">Menunggu Pembayaran<\/span>/);
  assert.match(out, /<span class="tag no">Dibatalkan<\/span><br><small class="m">Sakit<\/small>/);
  assert.ok(out.includes("Rp50.000"));
  assert.ok(out.includes("Menunggu<br><small class=\"m\">QRIS</small>") || out.includes("<br><small class=\"m\">QRIS</small>"));
  assert.match(out, /<button class="btn sm ghost" data-action="adminBooking:open" data-id="5" aria-label="Detail booking #5">Detail<\/button>/);
  assert.ok(!out.includes("bdet"));
});

test("booking: pencarian dan daftar kosong", () => {
  assert.ok(render({ bookings: [row()], query: "zzz" }).includes("Tidak ada booking."));
  assert.ok(render({ bookings: [row(), row({ id: 7, customer: "Sari" })], query: "sari" }).includes("1 booking"));
});

test("booking: panel Detail Booking (baris terpilih, data pelanggan di-escape, sesi studio, rincian bayar, hapus, tutup)", () => {
  const out = render({ bookings: [row()], bookingDetail: detail() });
  assert.match(out, /<div class="bgrid open">/);
  assert.match(out, /<tr class="on">/);
  assert.match(out, /<button class="btn sm " data-action="adminBooking:open" data-id="5"/);
  assert.match(out, /<aside class="card bdet" aria-label="Detail booking #5">/);
  assert.ok(out.includes("Detail Booking #5"));
  assert.match(out, /data-action="adminBooking:delete" data-id="5" title="Hapus booking"/);
  assert.match(out, /data-action="adminBooking:close"[^>]*aria-label="Tutup detail"/);
  for (const text of ["<span>Tanggal</span><b>2026-11-26</b>", "Budi &lt;b&gt;<br><small class=\"m\">budi@x.id · 0812</small>", "09:00 - 09:50<br><small class=\"m\">Sesi studio 2026-11-26 09:00 - 09:50</small>", "<span>Invoice</span><b>INV-5</b>", "<span>Batas bayar</span>", "<span>Biaya Studio</span><b>Rp0</b>", "<div class=\"kv disc\"><span>Diskon utama</span><b>-Rp5.000</b>", "<div class=\"kv total\"><span>Total</span><b>Rp45.000</b>", "Detail Pembayaran"]) assert.ok(out.includes(text), text);
  assert.ok(!out.includes("<span>Refund</span>"));
});

test("booking: form Ubah Booking (data-submit), status sekarang + tujuan server, paket bisa diubah sebelum dibayar", () => {
  const out = render({ bookings: [row()], bookingDetail: detail() });
  assert.match(out, /<form novalidate data-submit="adminBooking:save" data-id="5"><h4 class="bh">Ubah Booking<\/h4>/);
  assert.match(out, /<input type="radio" name="status" value="Menunggu Pembayaran" checked> ?Menunggu Pembayaran \(sekarang\)/);
  assert.match(out, /<input type="radio" name="status" value="Terbayar" ?> ?Terbayar<\/label>/);
  assert.match(out, /<select id="be-pkg" name="package_id" ><option value="1" selected>Basic · Rp50\.000<\/option><option value="2" >Standard · Rp90\.000<\/option>/);
  assert.ok(out.includes("Paket hanya dapat diubah sebelum booking dibayar; total dihitung ulang (paket + biaya studio − diskon)."));
  assert.match(out, /type="submit" style="margin-top:10px;width:100%">Simpan Perubahan<\/button>/);
  assert.ok(!out.includes("akan mengembalikan dana 100%"));
});

test("booking: sudah dibayar → paket terkunci, catatan refund bila boleh Dibatalkan; draf gagal memilih status draf", () => {
  const paid = detail({ status: "Terbayar", allowed: ["Sesi Berjalan", "Dibatalkan"], payment: { status: "paid", paid_at: Date.UTC(2026, 10, 25, 2, 5), method: "QRIS", amount: 45000 } });
  const out = render({ bookings: [row()], bookingDetail: paid, drafts: { "booking-5": { status: "Dibatalkan" } } });
  assert.match(out, /<select id="be-pkg" name="package_id" disabled><option value="1" selected>Basic<\/option><\/select>/);
  assert.ok(out.includes("Mengubah status booking yang sudah dibayar menjadi Dibatalkan akan mengembalikan dana 100% kepada pelanggan."));
  assert.ok(out.includes("Paket hanya dapat diubah sebelum booking dibayar."));
  assert.match(out, /value="Dibatalkan" checked/);
  assert.ok(!out.includes("Batas bayar"));
});

test("booking: selesai tanpa tujuan → tanpa form ubah; delete_block → tanpa tombol hapus, alasan tampil; refund tampil", () => {
  const out = render({ bookings: [row()], bookingDetail: detail({ status: "Selesai", allowed: [], delete_block: "Booking yang sudah selesai tidak dapat dihapus", payment: { status: "refunded", paid_at: 1, refunded_at: 2, method: "QRIS", amount: 1 } }) });
  assert.ok(!out.includes("Ubah Booking"));
  assert.ok(!out.includes("adminBooking:delete"));
  assert.ok(out.includes("Booking yang sudah selesai tidak dapat dihapus."));
  assert.ok(out.includes("<span>Refund</span>"));
});

test("booking: Check-in di panel detail (Terbayar): tombol aktif, atau mati dengan alasan server; sudah check-in → keterangan + lencana di daftar", () => {
  const paid = { status: "Terbayar", allowed: ["Sesi Berjalan", "Selesai", "Dibatalkan"], payment: { status: "paid", paid_at: 1, method: "QRIS", amount: 45000 } };
  const ready = render({ bookings: [row()], bookingDetail: detail({ ...paid, checkin_block: null }) });
  assert.match(ready, /<div class="cibox"><button class="btn sm" data-action="adminBooking:checkIn" data-id="5" ?><svg[^]*?<\/svg> Check-in<\/button><span class="sm m">Pelanggan sudah datang di studio\.<\/span><\/div>/);
  const early = render({ bookings: [row()], bookingDetail: detail({ ...paid, checkin_block: "Check-in hanya dapat dilakukan pada hari sesi" }) });
  assert.match(early, /data-action="adminBooking:checkIn" data-id="5" ?disabled>[^]*?<span class="sm m">Check-in hanya dapat dilakukan pada hari sesi\.<\/span>/);
  const done = render({ bookings: [row({ status: "Terbayar", checked_in_at: 1 })], bookingDetail: detail({ ...paid, checked_in_at: Date.UTC(2026, 10, 26, 2, 5), checkin_block: "Booking sudah check-in" }) });
  assert.match(done, /<div class="cibox ok"><svg[^]*?<\/svg><span>Sudah check-in [^<]+\. Sesi dimulai dari tablet Melati\.<\/span><\/div>/);
  assert.match(done, /<span class="tag ok">Terbayar<\/span><br><span class="tag ok">Sudah check-in<\/span>/);
  assert.doesNotMatch(render({ bookings: [row()], bookingDetail: detail() }), /adminBooking:checkIn|cibox/);
});
