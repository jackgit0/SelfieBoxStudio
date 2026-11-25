import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../js/core/store.js";
import { createAdminController, createAdminState } from "../../js/controllers/AdminController.js";
import { createAdminBookingController } from "../../js/controllers/AdminBookingController.js";
import * as adminModels from "../../js/models/admin/index.js";
import { createFakeApi } from "../helpers/fakeApi.js";
import { createFakeUi } from "../helpers/fakeUi.js";
import { createFakeStorage } from "../helpers/fakeStorage.js";
import { sampleState } from "../helpers/fixtures.js";
import { flat } from "../helpers/markup.js";

const detail = (overrides = {}) => ({ id: 5, slot: "2026-11-26 9:00", customer: { name: "Budi", email: "b@x.id", phone: "0812" }, studio_name: "Melati", package_id: 1, package_name: "Basic", status: "Menunggu Pembayaran", allowed: ["Terbayar", "Dibatalkan"], packages: [{ id: 1, name: "Basic", price: 50000 }, { id: 2, name: "Standard", price: 90000 }], payment: { status: "pending", amount: 50000 }, impact: { status: "Menunggu Pembayaran", paid: false, refund_amount: 0 }, ...overrides });
const failure = (status, error, extra = {}) => ({ status, body: { error, ...extra } });

function setup({ admin = {}, responses = {}, modalAnswers = [] } = {}) {
  const store = createStore({ ...sampleState({ persisted: { admin: true }, runtime: { accessDeniedOpen: false } }), admin: { ...createAdminState(), me: { username: "admin", must_change: false }, ...admin } }, { storage: createFakeStorage(), persistKey: "snapia" });
  const api = createFakeApi(responses);
  const ui = createFakeUi({ modalAnswers });
  const revealed = [];
  ui.revealBookingDetail = () => revealed.push("reveal");
  const router = { navigate: () => {} };
  const adminCore = createAdminController({ api, store, ui, router, models: { admin: adminModels }, logout: () => {} });
  const controller = createAdminBookingController({ api, store, ui, models: { admin: adminModels }, admin: adminCore });
  return { store, api, ui, controller, revealed, requests: () => api.calls.map(call => `${call.method} ${call.path}`), admin: () => store.get().admin, toast: () => store.get().runtime.toast };
}

test("load: daftar dengan saringan status; panel detail yang terbuka ikut diperbarui (atau hilang bila booking terhapus)", async () => {
  const { controller, requests, admin } = setup({ admin: { bookingFilter: "Terbayar", bookingDetail: detail() }, responses: { "GET /admin/bookings?status=Terbayar": { body: [{ id: 5 }] }, "GET /admin/bookings/5": { body: detail({ status: "Terbayar" }) } } });
  await controller.load();
  assert.deepEqual(requests(), ["GET /admin/bookings?status=Terbayar", "GET /admin/bookings/5"]);
  assert.deepEqual(admin().bookings, [{ id: 5 }]);
  assert.equal(admin().bookingDetail.status, "Terbayar");
  const gone = setup({ admin: { bookingDetail: detail() }, responses: { "GET /admin/bookings?status=": { body: [] } } });
  await gone.controller.load();
  assert.equal(gone.admin().bookingDetail, null);
});

test("setFilter: daftar dan panel dikosongkan lalu dimuat ulang dengan saringan baru", () => {
  const { controller, admin } = setup({ admin: { bookings: [{ id: 5 }], bookingDetail: detail() } });
  controller.setFilter({}, { target: { value: "Selesai" } });
  assert.deepEqual([admin().bookingFilter, admin().bookings, admin().bookingDetail], ["Selesai", null, null]);
});

test("open: detail dimuat, draf lama dibuang, panel ditampilkan (layar sempit menggulir ke panel); close menutup", async () => {
  const { controller, admin, revealed } = setup({ admin: { drafts: { "booking-5": { status: "x" } } }, responses: { "GET /admin/bookings/5": { body: detail() } } });
  await controller.open({ id: "5" });
  assert.equal(admin().bookingDetail.id, 5);
  assert.ok(!("booking-5" in admin().drafts));
  assert.deepEqual(revealed, ["reveal"]);
  controller.close();
  assert.equal(admin().bookingDetail, null);
});

test("save: tanpa perubahan → toast galat Tidak ada perubahan, tanpa permintaan", async () => {
  const { controller, requests, toast } = setup({ admin: { bookingDetail: detail() } });
  await controller.save({ id: "5" }, { status: "Menunggu Pembayaran", package_id: "1" });
  assert.deepEqual(requests(), []);
  assert.deepEqual(toast(), { message: "", error: "Tidak ada perubahan." });
});

test("save: ganti paket sebelum dibayar → PATCH package_id, ringkasan dikosongkan, panel memakai jawaban server", async () => {
  const { controller, api, admin, toast } = setup({ admin: { bookingDetail: detail(), bookings: [], revenue: {}, studios: [], sessions: { "1|2026-11": [] } }, responses: { "PATCH /admin/bookings/5": { body: detail({ package_id: 2, package_name: "Standard", notified: false }) } } });
  await controller.save({ id: "5" }, { status: "Menunggu Pembayaran", package_id: "2" });
  assert.deepEqual(api.calls[0].body, { package_id: 2 });
  assert.equal(admin().bookingDetail.package_name, "Standard");
  assert.deepEqual([admin().bookings, admin().revenue, admin().studios], [null, null, null]);
  assert.deepEqual(admin().sessions, {});
  assert.equal(toast().message, "Booking diperbarui.");
});

test("save: Dibatalkan pada booking terbayar → dialog dengan baris refund; setuju → PATCH, toast dana dikembalikan + email", async () => {
  const paid = detail({ status: "Terbayar", allowed: ["Sesi Berjalan", "Dibatalkan"], payment: { status: "paid", amount: 45000 } });
  const { controller, ui, api, toast } = setup({ modalAnswers: [true], admin: { bookingDetail: paid }, responses: { "PATCH /admin/bookings/5": { body: { ...paid, status: "Dibatalkan", refund: { state: "refunded", amount: 45000 }, notified: true } } } });
  await controller.save({ id: "5" }, { status: "Dibatalkan" });
  assert.equal(ui.modals[0].title, "Batalkan booking ini?");
  assert.match(flat(ui.modals[0].body), /Booking Melati · 2026-11-26 · 09:00 - 09:50 atas nama Budi diubah menjadi Dibatalkan\. Dana Rp45\.000 akan dikembalikan 100% kepada pelanggan dan sesinya dibuka kembali\. Pelanggan menerima email pemberitahuan\./);
  assert.deepEqual(ui.modals[0].buttons.map(button => button.label), ["Kembali", "Ya, Batalkan Booking"]);
  assert.deepEqual(api.calls[0].body, { status: "Dibatalkan" });
  assert.equal(toast().message, "Booking diperbarui. Dana Rp45.000 dikembalikan 100%. Pelanggan diberi tahu lewat email.");
});

test("save: Dibatalkan belum dibayar → teks tanpa refund; Kembali → tidak ada PATCH, pilihan disimpan sebagai draf", async () => {
  const { controller, ui, requests, admin } = setup({ modalAnswers: [false], admin: { bookingDetail: detail() } });
  await controller.save({ id: "5" }, { status: "Dibatalkan", package_id: "1" });
  assert.match(flat(ui.modals[0].body), /Booking belum dibayar, jadi tidak ada dana yang dikembalikan; sesinya dibuka kembali\./);
  assert.deepEqual(requests(), []);
  assert.deepEqual(admin().drafts["booking-5"], { status: "Dibatalkan", package_id: "1" });
});

test("save: Sesi Berjalan / Selesai → dialog Ubah status (tidak dapat dikembalikan)", async () => {
  const paid = detail({ status: "Terbayar", allowed: ["Sesi Berjalan", "Selesai"], payment: { status: "paid", amount: 1 } });
  const { controller, ui } = setup({ modalAnswers: [false, false], admin: { bookingDetail: paid } });
  await controller.save({ id: "5" }, { status: "Sesi Berjalan" });
  await controller.save({ id: "5" }, { status: "Selesai" });
  assert.deepEqual(ui.modals.map(modal => modal.title), ["Ubah status menjadi Sesi Berjalan?", "Ubah status menjadi Selesai?"]);
  assert.match(flat(ui.modals[0].body), /Timer sesi foto booking ini langsung dimulai\. Status tidak dapat dikembalikan\. Pelanggan menerima email pemberitahuan\./);
  assert.match(flat(ui.modals[1].body), /Booking ditandai selesai dan sesi fotonya diakhiri\./);
  assert.deepEqual(ui.modals[0].buttons.map(button => button.label), ["Kembali", "Ya, Ubah Status"]);
});

test("save: refund gagal → toast galat tindak lanjut manual", async () => {
  const paid = detail({ status: "Terbayar", allowed: ["Dibatalkan"], payment: { status: "paid", amount: 1 } });
  const { controller, toast } = setup({ modalAnswers: [true], admin: { bookingDetail: paid }, responses: { "PATCH /admin/bookings/5": { body: { ...paid, refund: { state: "failed" } } } } });
  await controller.save({ id: "5" }, { status: "Dibatalkan" });
  assert.deepEqual(toast(), { message: "", error: "Booking dibatalkan, tetapi refund gagal. Tindak lanjuti secara manual." });
});

test("save: server menolak (status berubah sementara itu) → toast galat, detail terbaru dimuat, daftar dimuat ulang, isian jadi draf", async () => {
  const { controller, toast, admin, requests } = setup({ admin: { bookingDetail: detail(), bookings: [] }, responses: { "PATCH /admin/bookings/5": failure(409, "Status tidak dapat diubah"), "GET /admin/bookings/5": { body: detail({ status: "Dibatalkan", allowed: [] }) } } });
  await controller.save({ id: "5" }, { status: "Menunggu Pembayaran", package_id: "2" });
  assert.deepEqual(requests(), ["PATCH /admin/bookings/5", "GET /admin/bookings/5"]);
  assert.equal(toast().error, "Status tidak dapat diubah");
  assert.equal(admin().bookingDetail.status, "Dibatalkan");
  assert.equal(admin().bookings, null);
  assert.deepEqual(admin().drafts["booking-5"], { status: "Menunggu Pembayaran", package_id: "2" });
});

test("delete: dialog Hapus booking ini? dengan baris refund lebih dulu, 409 dampak sama → langsung ?confirm=1, toast dana dikembalikan", async () => {
  const paid = detail({ status: "Terbayar", impact: { status: "Terbayar", paid: true, refund_amount: 45000 } });
  const { controller, ui, requests, admin, toast } = setup({ modalAnswers: [true], admin: { bookingDetail: paid, bookings: [] }, responses: { "DELETE /admin/bookings/5": failure(409, "Perlu konfirmasi", { needs_confirm: true, impact: paid.impact }), "DELETE /admin/bookings/5?confirm=1": { body: { ok: true, refund: "refunded", refund_amount: 45000 } } } });
  await controller.delete({ id: "5" });
  assert.equal(ui.modals.length, 1);
  assert.equal(ui.modals[0].title, "Hapus booking ini?");
  assert.match(flat(ui.modals[0].body), /Booking Melati · 2026-11-26 · 09:00 - 09:50 atas nama Budi\. Status booking: Terbayar \(sudah dibayar\)\. Dana Rp45\.000 akan dikembalikan 100% lebih dulu, lalu booking dihapus dan sesinya dibuka kembali\. Pelanggan menerima email pemberitahuan\. Tindakan ini tidak dapat dibatalkan\./);
  assert.deepEqual(ui.modals[0].buttons.map(button => button.label), ["Kembali", "Ya, Hapus Booking"]);
  assert.deepEqual(requests(), ["DELETE /admin/bookings/5", "DELETE /admin/bookings/5?confirm=1"]);
  assert.equal(admin().bookingDetail, null);
  assert.equal(toast().message, "Booking dihapus. Dana Rp45.000 dikembalikan 100%.");
});

test("delete: refund gagal (kept) → toast galat server, detail dimuat ulang; booking batal → teks hapus dari riwayat", async () => {
  const { controller, toast, admin } = setup({ modalAnswers: [true], admin: { bookingDetail: detail() }, responses: { "DELETE /admin/bookings/5": { body: { kept: true, message: "Refund gagal, booking disimpan sebagai refund gagal" } }, "GET /admin/bookings/5": { body: detail({ status: "Dibatalkan" }) } } });
  await controller.delete({ id: "5" });
  assert.equal(toast().error, "Refund gagal, booking disimpan sebagai refund gagal.");
  assert.equal(admin().bookingDetail.status, "Dibatalkan");
  const cancelled = setup({ modalAnswers: [false], admin: { bookingDetail: detail({ status: "Dibatalkan", impact: { status: "Dibatalkan", paid: false } }) } });
  await cancelled.controller.delete({ id: "5" });
  assert.match(flat(cancelled.ui.modals[0].body), /\(belum dibayar\)\. Booking akan dihapus dari riwayat\. Tindakan ini tidak dapat dibatalkan\./);
  assert.deepEqual(cancelled.requests(), []);
});

test("delete: server menolak booking yang sedang berjalan → toast galat dan detail terbaru", async () => {
  const { controller, toast, requests } = setup({ modalAnswers: [true], admin: { bookingDetail: detail() }, responses: { "DELETE /admin/bookings/5": failure(409, "Booking yang sedang berjalan tidak dapat dihapus"), "GET /admin/bookings/5": { body: detail() } } });
  await controller.delete({ id: "5" });
  assert.equal(toast().error, "Booking yang sedang berjalan tidak dapat dihapus");
  assert.deepEqual(requests(), ["DELETE /admin/bookings/5", "GET /admin/bookings/5"]);
});

test("dialog dibatalkan (hapus, Dibatalkan) → tanpa render ulang", async () => {
  const { controller, store } = setup({ modalAnswers: [false, false], admin: { bookingDetail: detail() } });
  let renders = 0;
  store.subscribe(() => renders++);
  await controller.delete({ id: "5" });
  await controller.save({ id: "5" }, { status: "Dibatalkan" });
  assert.equal(renders, 0);
});

test("checkIn: POST /admin/bookings/:id/checkin, panel memakai jawaban server, daftar dimuat ulang, toast; galat → toast server", async () => {
  const answer = detail({ status: "Terbayar", checked_in_at: 1, checkin_block: "Booking sudah check-in" });
  const ok = setup({ admin: { bookingDetail: detail({ status: "Terbayar" }), bookings: [] }, responses: { "POST /admin/bookings/5/checkin": { body: answer } } });
  await ok.controller.checkIn({ id: "5" });
  assert.deepEqual(ok.requests(), ["POST /admin/bookings/5/checkin"]);
  assert.equal(ok.admin().bookingDetail.checked_in_at, 1);
  assert.equal(ok.admin().bookings, null);
  assert.equal(ok.toast().message, "Check-in berhasil. Sesi dapat dimulai dari tablet Melati.");
  const late = setup({ admin: { bookingDetail: detail({ status: "Terbayar" }) }, responses: { "POST /admin/bookings/5/checkin": failure(409, "Waktu sesi sudah lewat"), "GET /admin/bookings/5": { body: detail({ status: "Terbayar" }) } } });
  await late.controller.checkIn({ id: "5" });
  assert.equal(late.toast().error, "Waktu sesi sudah lewat");
});
