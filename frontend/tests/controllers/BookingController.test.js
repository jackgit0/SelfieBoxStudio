import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../js/core/store.js";
import { createBookingController } from "../../js/controllers/BookingController.js";
import { createPackageController } from "../../js/controllers/PackageController.js";
import * as bookingModel from "../../js/models/booking.js";
import * as photoSessionModel from "../../js/models/photoSession.js";
import { createFakeApi } from "../helpers/fakeApi.js";
import { createFakeStorage } from "../helpers/fakeStorage.js";
import { createFakeUi } from "../helpers/fakeUi.js";
import { sampleState } from "../helpers/fixtures.js";

const now = new Date(2026, 10, 25, 9, 30);
const tick = () => new Promise(resolve => setImmediate(resolve));

// state: route = nama rute aktif (time / pay); log mencatat urutan render, modal, navigasi
function setup({ persisted = {}, booking = {}, runtime = {}, route = "time", responses = {}, modalAnswers = [], afterRefreshMaster = null, ownRefresh = false } = {}) {
  const state = sampleState({ persisted: { pkg: 1, ...persisted }, booking: { studio: 1, date: "2026-11-27", ...booking }, runtime: { route: { name: route, path: "/book/" + route, params: {}, query: {} }, ...runtime } });
  state.data = { bookings: [{ id: 7, studio: 2, date: "2026-11-30 13:00", status: "Terbayar" }], sessions: [{ id: 1 }] };
  const storage = createFakeStorage();
  const sessionStorage = createFakeStorage();
  const store = createStore(state, { storage, persistKey: "snapia", session: { storage: sessionStorage, key: "snapia_booking", slices: { booking: ["studio", "date", "slot", "rescheduleId"] } } });
  const api = createFakeApi(responses);
  api.token = "jwt";
  const log = [];
  const ui = createFakeUi({ modalAnswers });
  const fakeModal = ui.modal;
  ui.modal = options => {
    log.push(`modal:${options.title}`);
    return fakeModal(options);
  };
  store.subscribe(() => log.push("render"));
  const router = { navigate: path => log.push(`navigate:${path}`) };
  let masterRefreshes = 0;
  const refreshMaster = async () => {
    masterRefreshes++;
    if (afterRefreshMaster) {
      afterRefreshMaster(store);
    }
    return Boolean(afterRefreshMaster);
  };
  let refreshes = 0;
  const refresh = async () => {
    refreshes++;
  };
  const packages = createPackageController({ store, ui, router, config: { wa: "", email: "" }, refreshMaster });
  // ownRefresh = refresh bawaan controller (refreshData lewat model), bukan tiruan penghitung
  const controller = createBookingController({ api, store, ui, router, models: { booking: bookingModel, photoSession: photoSessionModel }, packages, refreshMaster, refresh: ownRefresh ? undefined : refresh, now: () => now });
  return { store, api, ui, log, controller, storage, sessionStorage, refreshes: () => refreshes, masterRefreshes: () => masterRefreshes };
}

const apiError = (status, message) => Object.assign(new Error(message), { status, data: { error: message } });
const titles = log => log.filter(entry => entry.startsWith("modal:")).map(entry => entry.slice(6));

test("handleError: satu tabel pemetaan status/pesan API → popup", async () => {
  const cases = [
    [apiError(401, "Belum login"), "Masuk untuk melanjutkan booking"],
    [apiError(409, "Jadwal sudah tidak tersedia"), "Maaf, Sesi Sudah Dibooking"],
    [apiError(409, "Jadwal baru tidak tersedia"), "Maaf, Sesi Sudah Dibooking"],
    [apiError(400, "Format/jam slot tidak valid"), "Input Tidak Valid"],
    [apiError(400, "Jadwal sudah lewat"), "Sesi Tidak Tersedia"],
    [apiError(400, "Studio tidak tersedia"), "Sesi Tidak Tersedia"],
    [apiError(400, "Paket/studio tidak valid"), "Sesi Tidak Tersedia"], // paket masih aktif: studionya yang hilang
    [apiError(400, "Paket tidak valid"), "Booking Gagal"], // paket masih aktif dan pesan lain dari server
    [apiError(409, "Jadwal bentrok"), "Booking Gagal"],
    [apiError(500, "Server sibuk"), "Booking Gagal"],
  ];
  for (const [error, title] of cases) {
    const { log, controller } = setup();
    await controller.handleError(error, () => {});
    assert.deepEqual(titles(log), [title], `${error.status} ${error.message}`);
  }
});

test("handleError: paket pilihan sudah nonaktif → Paket Tidak Ditemukan (PackageController)", async () => {
  for (const message of ["Paket tidak valid", "Paket/studio tidak valid"]) {
    const { log, controller } = setup({ persisted: { pkg: 3 } });
    await controller.handleError(apiError(400, message), () => {});
    await tick();
    assert.deepEqual(titles(log), ["Paket Tidak Ditemukan"], message);
  }
});

test("Booking Gagal menampilkan pesan server (di-escape) dengan satu tombol Tutup", async () => {
  const { ui, controller } = setup();
  await controller.handleError(apiError(500, "<b>rusak</b>"), () => {});
  assert.match(String(ui.modals[0].body), /<p>&lt;b&gt;rusak&lt;\/b&gt;<\/p>/);
  assert.deepEqual(ui.modals[0].buttons, [{ label: "Tutup", value: null }]);
  assert.equal(ui.modals[0].className, "center");
});

test("next tanpa sesi → Input Tidak Valid; di langkah lain kembali ke Pilih Waktu", async () => {
  const onTime = setup();
  await onTime.controller.next();
  assert.deepEqual(onTime.log, ["modal:Input Tidak Valid"]);
  assert.match(String(onTime.ui.modals[0].body), /Input booking tidak lengkap atau tidak valid\. Pilih tanggal dan sesi terlebih dahulu\./);
  assert.equal(onTime.ui.modals[0].buttons[0].label, "Pilih Tanggal & Sesi");
  const onPay = setup({ route: "pay" });
  await onPay.controller.next();
  assert.deepEqual(onPay.log, ["modal:Input Tidak Valid", "navigate:/book/time"]);
});

test("next dengan sesi yang sudah terisi → Sesi Tidak Tersedia, sesi dikosongkan dan ketersediaan dimuat ulang", async () => {
  const { store, ui, log, controller, masterRefreshes } = setup({ booking: { slot: "2026-11-27 12:00" }, runtime: { availability: { "1|2026-11-27": [10, 11] } } });
  await controller.next();
  assert.equal(masterRefreshes(), 1);
  assert.equal(titles(log)[0], "Sesi Tidak Tersedia");
  assert.match(String(ui.modals[0].body), /Sesi 12:00 - 12:50 tidak lagi tersedia\. Silakan pilih sesi lain\./);
  assert.equal(ui.modals[0].buttons[0].label, "Pilih Sesi Lain");
  assert.equal(store.get().booking.slot, null);
  assert.deepEqual(store.get().runtime.availability, {});
  assert.equal(log.at(-1), "render");
});

test("Sesi Tidak Tersedia untuk studio yang hilang: Cari Studio Lain → Browse; saat reschedule → detail booking", async () => {
  const hide = store => store.update("master", { studios: store.get().master.studios.filter(studio => studio.id !== 1) }, { silent: true });
  const plain = setup({ booking: { slot: "2026-11-27 12:00" }, runtime: { availability: { "1|2026-11-27": [] } }, afterRefreshMaster: hide });
  await plain.controller.next();
  assert.match(String(plain.ui.modals[0].body), /Studio ini sedang tidak tersedia\. Silakan pilih studio lain\./);
  assert.equal(plain.ui.modals[0].buttons[0].label, "Cari Studio Lain");
  assert.equal(plain.log.at(-1), "navigate:/browse");
  const moving = setup({ booking: { slot: "2026-11-27 12:00", rescheduleId: 7 }, runtime: { availability: { "1|2026-11-27": [] } }, afterRefreshMaster: hide });
  await moving.controller.next();
  assert.equal(moving.log.at(-1), "navigate:/bookings/7");
  assert.equal(moving.store.get().booking.rescheduleId, null);
});

test("next dengan galat API → popup, runtime.toast.error tetap kosong", async () => {
  const { store, log, controller } = setup({ booking: { slot: "2026-11-27 10:00" }, responses: { "POST /quote": { status: 500, body: { error: "Server sibuk" } } } });
  await controller.next();
  assert.deepEqual(titles(log), ["Booking Gagal"]);
  assert.equal(store.get().runtime.toast.error, "");
  assert.ok(!log.some(entry => entry.startsWith("navigate")));
});

test("next: quote diambil lalu pindah ke Paket & Pembayaran", async () => {
  const quote = { studio_fee: 0, total: 50000 };
  const { store, api, log, controller } = setup({ booking: { slot: "2026-11-27 10:00" }, responses: { "POST /quote": { body: quote } } });
  await controller.next();
  assert.deepEqual(api.calls[0].body, { package_id: 1, studio_id: 1 });
  assert.deepEqual(store.get().booking.quote, quote);
  assert.deepEqual(log, ["navigate:/book/pay"]);
});

test("next saat reschedule: PATCH, booking berjalan dikosongkan, data dimuat ulang, Reschedule Berhasil", async () => {
  const { store, api, log, controller, refreshes, sessionStorage } = setup({ booking: { studio: 2, date: "2026-11-30", slot: "2026-11-30 15:00", rescheduleId: 7 }, responses: { "PATCH /bookings/7": { body: { ok: true } } } });
  await controller.next();
  assert.deepEqual(api.calls[0], { method: "PATCH", path: "/bookings/7", body: { studio_id: 2, date: "2026-11-30 15:00" } });
  assert.deepEqual(store.get().booking, { studio: null, date: null, slot: null, quote: null, rescheduleId: null });
  assert.equal(sessionStorage.getItem("snapia_booking"), null);
  assert.equal(refreshes(), 1);
  assert.deepEqual(log, ["navigate:/bookings/7/rescheduled"]);
});

test("reschedule ke sesi yang baru diambil orang lain → Maaf, Sesi Sudah Dibooking → kembali ke Pilih Waktu", async () => {
  const { store, log, controller } = setup({ booking: { studio: 2, date: "2026-11-30", slot: "2026-11-30 15:00", rescheduleId: 7 }, responses: { "PATCH /bookings/7": { status: 409, body: { error: "Jadwal baru tidak tersedia" } } } });
  await controller.next();
  assert.deepEqual(log, ["modal:Maaf, Sesi Sudah Dibooking", "render"]);
  assert.equal(store.get().booking.slot, null);
  assert.equal(store.get().booking.rescheduleId, 7);
});

test("requireLogin menyimpan draf; Masuk → /login, Daftar → /register, ditutup → tetap di halaman", async () => {
  const login = setup({ booking: { slot: "2026-11-27 10:00" }, modalAnswers: ["login"] });
  await login.controller.requireLogin();
  assert.deepEqual(login.store.get().persisted.draft, { studio: 1, date: "2026-11-27", slot: "2026-11-27 10:00" });
  assert.deepEqual(JSON.parse(login.storage.getItem("snapia")).draft, { studio: 1, date: "2026-11-27", slot: "2026-11-27 10:00" });
  assert.deepEqual(login.ui.modals[0].buttons.map(button => button.label), ["Masuk", "Daftar"]);
  assert.match(String(login.ui.modals[0].body), /Kamu belum login\. Silakan masuk terlebih dahulu untuk membooking sesi\./);
  assert.equal(login.log.at(-1), "navigate:/login");
  const register = setup({ booking: { slot: "2026-11-27 10:00" }, modalAnswers: ["register"] });
  await register.controller.requireLogin();
  assert.equal(register.log.at(-1), "navigate:/register");
  const closed = setup({ booking: { slot: "2026-11-27 10:00" } });
  await closed.controller.requireLogin();
  assert.deepEqual(closed.log, ["modal:Masuk untuk melanjutkan booking"]);
  assert.ok(closed.store.get().persisted.draft);
});

test("requireLogin saat masih masuk (401, token kedaluwarsa): sesi login dilepas", async () => {
  const { store, api, controller } = setup({ persisted: { me: 5, user: { id: 5, name: "Dewi" } }, booking: { slot: "2026-11-27 10:00" }, modalAnswers: ["login"] });
  await controller.handleError(apiError(401, "Token tidak valid"), () => {});
  assert.equal(api.token, "");
  assert.equal(store.get().persisted.me, null);
  assert.equal(store.get().persisted.user, null);
  assert.deepEqual(store.get().data, { bookings: [], sessions: [] });
});

test("resumeDraft: draf dipakai lagi, quote diambil ulang, mendarat di /book/pay", async () => {
  const quote = { studio_fee: 0, total: 90000 };
  const draft = { studio: 2, date: "2026-11-28", slot: "2026-11-28 14:00" };
  const { store, api, log, controller } = setup({ persisted: { draft }, booking: { studio: null, date: null, rescheduleId: 7 }, responses: { "POST /quote": { body: quote } } });
  await controller.resumeDraft();
  assert.equal(store.get().persisted.draft, null);
  assert.deepEqual(store.get().booking, { ...draft, quote, rescheduleId: null });
  assert.deepEqual(api.calls[0].body, { package_id: 1, studio_id: 2 });
  assert.deepEqual(log, ["navigate:/book/pay"]);
});

test("resumeDraft dengan galat → kembali ke Pilih Waktu lalu popup", async () => {
  const draft = { studio: 1, date: "2026-11-28", slot: "2026-11-28 14:00" };
  const { log, controller } = setup({ persisted: { draft }, responses: { "POST /quote": { status: 400, body: { error: "Studio tidak tersedia" } } } });
  await controller.resumeDraft();
  assert.deepEqual(titles(log), ["Sesi Tidak Tersedia"]);
  assert.equal(log[0], "navigate:/book/time");
});

test("quickBook: paket dipastikan, booking diisi, draf lama dibuang, pindah ke /book/time", () => {
  const { store, log, controller } = setup({ persisted: { pkg: null, draft: { studio: 2 } }, booking: { studio: null, date: null, rescheduleId: 7 } });
  controller.quickBook({ studio: "2", date: "2026-11-28", hour: "15" });
  assert.equal(store.get().persisted.pkg, 1);
  assert.equal(store.get().persisted.draft, null);
  const { studio, date, slot, rescheduleId } = store.get().booking;
  assert.deepEqual({ studio, date, slot, rescheduleId }, { studio: 2, date: "2026-11-28", slot: "2026-11-28 15:00", rescheduleId: null });
  assert.deepEqual(log, ["navigate:/book/time"]);
});

test("quickBook dengan paket yang sudah nonaktif: popup, belum pindah; memilih paket lain melanjutkan", async () => {
  const { store, log, controller } = setup({ persisted: { pkg: 3 }, modalAnswers: ["2"] });
  controller.quickBook({ studio: "2", date: "2026-11-28", hour: "15" });
  await tick();
  assert.equal(titles(log)[0], "Paket Foto Tidak Ditemukan");
  assert.equal(store.get().persisted.pkg, 2);
  assert.equal(log.at(-1), "navigate:/book/time");
  assert.equal(store.get().booking.slot, "2026-11-28 15:00");
});

test("start (Book Now): tanggal dari Filter Jadwal (yang lewat = hari ini), tanpa sesi", () => {
  const future = setup({ persisted: { hDate: "2026-12-02" }, booking: { studio: null, slot: "2026-11-27 10:00" } });
  future.controller.start({ id: "1" });
  assert.deepEqual([future.store.get().booking.studio, future.store.get().booking.date, future.store.get().booking.slot], [1, "2026-12-02", null]);
  assert.deepEqual(future.log, ["navigate:/book/time"]);
  const past = setup({ persisted: { hDate: "2026-11-20" } });
  past.controller.start({ id: "2" });
  assert.equal(past.store.get().booking.date, "2026-11-25");
});

test("startReschedule: studio dan tanggal booking itu, tanpa sesi, ke /bookings/:id/reschedule", () => {
  const { store, log, controller } = setup({ booking: { studio: null, date: null } });
  controller.startReschedule({ id: "7" });
  const { studio, date, slot, rescheduleId } = store.get().booking;
  assert.deepEqual({ studio, date, slot, rescheduleId }, { studio: 2, date: "2026-11-30", slot: null, rescheduleId: 7 });
  assert.deepEqual(log, ["navigate:/bookings/7/reschedule"]);
});

test("pickDate mengosongkan sesi; pickSlot memilih sesi; moveMonth tidak mundur melewati bulan sekarang", () => {
  const { store, controller } = setup({ booking: { slot: "2026-11-27 10:00" } });
  controller.pickDate({ context: "book", date: "2026-11-29" });
  assert.deepEqual([store.get().booking.date, store.get().booking.slot], ["2026-11-29", null]);
  controller.pickSlot({ slot: "2026-11-29 16:00" });
  assert.equal(store.get().booking.slot, "2026-11-29 16:00");
  controller.moveMonth({ context: "book", step: "-1" });
  assert.equal(store.get().runtime.calendar.book, undefined);
  controller.moveMonth({ context: "book", step: "1" });
  assert.deepEqual(store.get().runtime.calendar.book, { year: 2026, month: 11 });
  controller.moveMonth({ context: "book", step: "1" });
  assert.deepEqual(store.get().runtime.calendar.book, { year: 2027, month: 0 });
});

test("moveMonth berangkat dari bulan tanggal booking; memulai booking/reschedule/draf membuang bulan tersimpan", async () => {
  const december = setup({ booking: { date: "2026-12-02" } });
  december.controller.moveMonth({ context: "book", step: "1" });
  assert.deepEqual(december.store.get().runtime.calendar.book, { year: 2027, month: 0 });
  const calendar = { home: { year: 2026, month: 11 }, book: { year: 2027, month: 2 } };
  const quote = { total: 1 };
  for (const run of [c => c.quickBook({ studio: "1", date: "2026-11-28", hour: "9" }), c => c.start({ id: "1" }), c => c.startReschedule({ id: "7" }), c => c.resumeDraft()]) {
    const { store, controller } = setup({ persisted: { draft: { studio: 1, date: "2026-11-28", slot: "2026-11-28 9:00" } }, runtime: { calendar: { ...calendar } }, responses: { "POST /quote": { body: quote } } });
    await run(controller);
    assert.deepEqual(store.get().runtime.calendar, { home: { year: 2026, month: 11 } });
  }
});

// ---------- Booking Saya, pembatalan (refactor MVC fase 6) ----------

test("refreshData: GET /bookings lalu GET /sessions ke slice data tanpa render (dulu refresh() di core.js)", async () => {
  const { store, api, log, controller } = setup({ responses: { "GET /bookings": { body: [{ id: 3 }] }, "GET /sessions": { body: [{ id: 8, photos: [{ id: 1, img: "" }] }] } } });
  api.imageUrl = id => `/img/${id}`;
  await controller.refreshData();
  assert.deepEqual(api.calls.map(call => call.path), ["/bookings", "/sessions"]);
  assert.deepEqual(store.get().data.bookings, [{ id: 3 }]);
  assert.equal(store.get().data.sessions[0].photos[0].img, "/img/1");
  assert.deepEqual(log, []);
});

test("openCancel: isian pembatalan dikosongkan lalu ke /bookings/:id/cancel", () => {
  const { store, log, controller } = setup({ runtime: { cancel: { reason: "Pemesanan ganda", detail: "lama" } } });
  controller.openCancel({ id: "7" });
  assert.deepEqual(store.get().runtime.cancel, { reason: "", detail: "" });
  assert.deepEqual(log, ["navigate:/bookings/7/cancel"]);
});

test("setCancelReason merender ulang; setCancelDetail diam (textarea tidak dirender ulang saat mengetik)", () => {
  const { store, log, controller } = setup({ runtime: { cancel: { reason: "", detail: "" } } });
  controller.setCancelReason({ reason: "Pembatalan lainnya" });
  assert.deepEqual(log, ["render"]);
  controller.setCancelDetail({}, { target: { value: "Sakit" } });
  assert.deepEqual(log, ["render"]);
  assert.deepEqual(store.get().runtime.cancel, { reason: "Pembatalan lainnya", detail: "Sakit" });
});

test("cancel: modal Konfirmasi Pembatalan; Kembali / ditutup → tidak ada POST", async () => {
  for (const answer of [false, null]) {
    const { api, log, controller } = setup({ runtime: { cancel: { reason: "Tidak ada waktu", detail: "" } }, modalAnswers: [answer] });
    await controller.cancel({ id: "7" });
    assert.deepEqual(log, ["modal:Konfirmasi Pembatalan"]);
    assert.deepEqual(api.calls, []);
  }
  const { ui: shown, controller } = setup({ runtime: { cancel: { reason: "Tidak ada waktu", detail: "" } } });
  await controller.cancel({ id: "7" });
  assert.equal(String(shown.modals[0].body), "<p>Yakin membatalkan booking ini?</p>");
  assert.deepEqual(shown.modals[0].buttons.map(button => [button.label, button.value]), [["Kembali", false], ["Ya, Batalkan", true]]);
});

test("cancel: Ya → POST alasan, hasil disimpan, data dimuat ulang, halaman refund", async () => {
  const result = { ok: true, refund: { state: "refunded", amount: 90000, at: 1, min_hours: 2 } };
  const { store, api, log, controller, refreshes } = setup({ runtime: { cancel: { reason: "Pembatalan lainnya", detail: "Sakit" } }, modalAnswers: [true], responses: { "POST /bookings/7/cancel": { body: result } } });
  await controller.cancel({ id: "7" });
  assert.deepEqual(api.calls, [{ method: "POST", path: "/bookings/7/cancel", body: { reason: "Pembatalan lainnya", detail: "Sakit" } }]);
  assert.deepEqual(store.get().persisted.cancelRes, result);
  assert.equal(refreshes(), 1);
  assert.deepEqual(log, ["modal:Konfirmasi Pembatalan", "navigate:/bookings/7/refund"]);
});

test("cancel: galat server → toast galat, tetap di halaman", async () => {
  const { store, log, controller } = setup({ runtime: { cancel: { reason: "Tidak ada waktu", detail: "" } }, modalAnswers: [true], responses: { "POST /bookings/7/cancel": { status: 409, body: { error: "Booking tidak dapat dibatalkan" } } } });
  await controller.cancel({ id: "7" });
  assert.equal(store.get().runtime.toast.error, "Booking tidak dapat dibatalkan");
  assert.deepEqual(log, ["modal:Konfirmasi Pembatalan", "render"]);
});

test("syncReschedule: /bookings/:id/reschedule dibuka langsung memulai ubah jadwal (bila bisa diubah); /book/time melepasnya (dulu legacy/core.js)", () => {
  const { store, log, controller } = setup({ booking: { rescheduleId: null, studio: 1, date: "2026-11-27", slot: "2026-11-27 10:00" }, runtime: { calendar: { book: { year: 2026, month: 10 }, home: { year: 2026, month: 10 } } } });
  controller.syncReschedule(7);
  assert.deepEqual(store.get().booking, { rescheduleId: 7, studio: 2, date: "2026-11-30", slot: null, quote: null });
  assert.deepEqual(store.get().runtime.calendar, { home: { year: 2026, month: 10 } });
  store.update("booking", { slot: "2026-11-30 15:00" }, { silent: true });
  controller.syncReschedule(7);
  assert.equal(store.get().booking.slot, "2026-11-30 15:00");
  controller.syncReschedule(null);
  assert.equal(store.get().booking.rescheduleId, null);
  controller.syncReschedule(99);
  assert.equal(store.get().booking.rescheduleId, null);
  store.get().data.bookings[0].status = "Selesai";
  controller.syncReschedule(7);
  assert.equal(store.get().booking.rescheduleId, null);
  assert.deepEqual(log, []);
});
