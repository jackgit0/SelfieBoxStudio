import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../js/core/store.js";
import { createBookingController } from "../../js/controllers/BookingController.js";
import { createPackageController } from "../../js/controllers/PackageController.js";
import { createPaymentController } from "../../js/controllers/PaymentController.js";
import * as bookingModel from "../../js/models/booking.js";
import * as paymentModel from "../../js/models/payment.js";
import { createFakeApi } from "../helpers/fakeApi.js";
import { createFakeStorage } from "../helpers/fakeStorage.js";
import { createFakeUi } from "../helpers/fakeUi.js";
import { sampleState } from "../helpers/fixtures.js";

const now = new Date(2026, 10, 25, 9, 30);
const quote = { studio_fee: 0, total: 50000, mainDisc: 0, pct: 0 };

function setup({ persisted = {}, booking = {}, route = "pay", responses = {}, modalAnswers = [] } = {}) {
  const state = sampleState({ persisted: { pkg: 1, me: 5, user: { id: 5, name: "Dewi" }, ...persisted }, booking: { studio: 1, date: "2026-11-27", slot: "2026-11-27 10:00", quote, ...booking }, runtime: { route: { name: route, path: "/book/" + route, params: {}, query: {} }, toast: { message: "lama", error: "lama" } } });
  const sessionStorage = createFakeStorage();
  const store = createStore(state, { storage: createFakeStorage(), persistKey: "snapia", session: { storage: sessionStorage, key: "snapia_booking", slices: { booking: ["studio", "date", "slot", "rescheduleId"] } } });
  const api = createFakeApi(responses);
  const log = [];
  const ui = createFakeUi({ modalAnswers });
  const fakeModal = ui.modal;
  ui.modal = options => {
    log.push(`modal:${options.title}`);
    return fakeModal(options);
  };
  store.subscribe(() => log.push("render"));
  const router = { navigate: path => log.push(`navigate:${path}`) };
  const refreshMaster = async () => false;
  let refreshes = 0;
  const refresh = async () => {
    refreshes++;
    log.push("refresh");
  };
  const models = { booking: bookingModel, payment: paymentModel };
  const packages = createPackageController({ store, ui, router, config: { wa: "", email: "" }, refreshMaster });
  const booking_ = createBookingController({ api, store, ui, router, models, packages, refreshMaster, refresh, now: () => now });
  const controller = createPaymentController({ api, store, ui, router, models, booking: booking_, refresh });
  return { store, api, ui, log, controller, sessionStorage, refreshes: () => refreshes };
}

const posts = api => api.calls.filter(call => call.method === "POST").map(call => call.path);

test("confirm sebagai tamu: popup Masuk untuk melanjutkan booking, belum ada POST /bookings", async () => {
  const { api, log, store, controller } = setup({ persisted: { me: null, user: null } });
  await controller.confirm();
  assert.deepEqual(log, ["modal:Masuk untuk melanjutkan booking"]);
  assert.ok(!api.calls.some(call => call.path === "/bookings"));
  assert.deepEqual(store.get().persisted.draft, { studio: 1, date: "2026-11-27", slot: "2026-11-27 10:00" });
});

test("confirm saat masuk: POST booking lalu bayar, data dimuat ulang, booking berjalan dikosongkan, halaman sukses", async () => {
  const { api, log, store, controller, sessionStorage } = setup({
    persisted: { method: "Transfer Bank", payOpen: true },
    responses: { "POST /bookings": { body: { id: 12 } }, "POST /bookings/12/pay": { body: { status: "Terbayar" } } },
  });
  await controller.confirm();
  assert.deepEqual(api.calls.map(call => [call.method, call.path, call.body]), [
    ["POST", "/bookings", { package_id: 1, studio_id: 1, date: "2026-11-27 10:00" }],
    ["POST", "/bookings/12/pay", { method: "Transfer Bank" }],
  ]);
  assert.deepEqual(log, ["refresh", "navigate:/bookings/12/success"]);
  assert.deepEqual(store.get().booking, { studio: null, date: null, slot: null, quote: null, rescheduleId: null });
  assert.equal(sessionStorage.getItem("snapia_booking"), null);
  assert.equal(store.get().persisted.payOpen, false);
});

test("confirm tanpa metode tersimpan: QRIS", async () => {
  const { api, controller } = setup({ responses: { "POST /bookings": { body: { id: 3 } }, "POST /bookings/3/pay": { body: {} } } });
  await controller.confirm();
  assert.deepEqual(api.calls[1].body, { method: "QRIS" });
});

test("confirm: 409 → Maaf, Sesi Sudah Dibooking, ketersediaan dibuang, kembali ke Pilih Waktu dengan sesi kosong", async () => {
  const { store, log, controller } = setup({ runtime: {}, responses: { "POST /bookings": { status: 409, body: { error: "Jadwal sudah tidak tersedia" } } } });
  store.update("runtime", { availability: { "1|2026-11-27": [10] } }, { silent: true });
  await controller.confirm();
  assert.deepEqual(log, ["modal:Maaf, Sesi Sudah Dibooking", "navigate:/book/time"]);
  assert.deepEqual(store.get().runtime.availability, {});
  assert.equal(store.get().booking.slot, null);
});

test("selectPackage: paket disimpan, toast dibersihkan, quote diambil ulang, outlet dirender sekali", async () => {
  const newQuote = { ...quote, total: 90000 };
  const { api, store, log, controller } = setup({ responses: { "POST /quote": { body: newQuote } } });
  await controller.selectPackage({ id: "2" });
  assert.equal(store.get().persisted.pkg, 2);
  assert.deepEqual(api.calls[0].body, { package_id: 2, studio_id: 1 });
  assert.deepEqual(store.get().booking.quote, newQuote);
  assert.deepEqual(store.get().runtime.toast, { message: "", error: "" });
  assert.deepEqual(log, ["render"]);
});

test("selectPackage dengan paket yang baru dinonaktifkan: Paket Tidak Ditemukan, paket dari popup dipakai ulang", async () => {
  let attempt = 0;
  const { store, log, controller } = setup({
    modalAnswers: ["2"],
    responses: { "POST /quote": body => (attempt++ === 0 ? { status: 400, body: { error: "Paket tidak valid" } } : { body: { ...quote, total: 90000, package: body.package_id } }) },
  });
  store.update("master", { packages: store.get().master.packages.filter(item => item.id !== 1) }, { silent: true });
  await controller.selectPackage({ id: "1" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(log.filter(entry => entry.startsWith("modal:"))[0], "modal:Paket Tidak Ditemukan");
  assert.equal(store.get().persisted.pkg, 2);
  assert.equal(store.get().booking.quote.package, 2);
});

test("setMethod dan togglePaymentDetail menyimpan pilihan dan merender", () => {
  const { store, log, controller } = setup();
  controller.setMethod({}, { target: { value: "Transfer Bank" } });
  assert.equal(store.get().persisted.method, "Transfer Bank");
  controller.togglePaymentDetail();
  assert.equal(store.get().persisted.payOpen, true);
  controller.togglePaymentDetail();
  assert.equal(store.get().persisted.payOpen, false);
  assert.deepEqual(log, ["render", "render", "render"]);
});

test("emailInvoice: pesan mode pengembangan, pesan terkirim, galat", async () => {
  const dev = setup({ responses: { "POST /bookings/12/invoice/email": { body: { dev: true } } } });
  await dev.controller.emailInvoice({ id: "12" });
  assert.deepEqual(dev.store.get().runtime.toast, { message: "Mode pengembangan: SMTP belum diatur, email disimpan di folder backend/outbox.", error: "" });
  assert.deepEqual(posts(dev.api), ["/bookings/12/invoice/email"]);
  const sent = setup({ responses: { "POST /bookings/12/invoice/email": { body: {} } } });
  await sent.controller.emailInvoice({ id: "12" });
  assert.equal(sent.store.get().runtime.toast.message, "Invoice dikirim ke email Anda.");
  const failed = setup({ responses: { "POST /bookings/12/invoice/email": { status: 500, body: { error: "SMTP gagal" } } } });
  await failed.controller.emailInvoice({ id: "12" });
  assert.deepEqual(failed.store.get().runtime.toast, { message: "", error: "SMTP gagal" });
  assert.deepEqual(failed.log, ["render"]);
});

test("loadMissingQuote: dimuat ulang di /book/pay tanpa quote → quote diambil sekali lalu render", async () => {
  const { api, store, log, controller } = setup({ booking: { quote: null }, responses: { "POST /quote": { body: quote } } });
  await Promise.all([controller.loadMissingQuote(), controller.loadMissingQuote()]);
  assert.equal(api.calls.length, 1);
  assert.deepEqual(store.get().booking.quote, quote);
  assert.deepEqual(log, ["render"]);
  await controller.loadMissingQuote();
  assert.equal(api.calls.length, 1); // quote sudah ada
});

test("loadMissingQuote dengan galat: kembali ke Pilih Waktu lalu popup", async () => {
  const { log, controller } = setup({ booking: { quote: null }, responses: { "POST /quote": { status: 400, body: { error: "Studio tidak tersedia" } } } });
  await controller.loadMissingQuote();
  assert.equal(log[0], "navigate:/book/time");
  assert.ok(log.includes("modal:Sesi Tidak Tersedia"));
});
