import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../js/core/store.js";
import { createStudioController } from "../../js/controllers/StudioController.js";
import * as studioModel from "../../js/models/studio.js";
import * as masterModel from "../../js/models/master.js";
import { createFakeApi } from "../helpers/fakeApi.js";
import { createFakeStorage } from "../helpers/fakeStorage.js";
import { createFakeUi } from "../helpers/fakeUi.js";
import { sampleState } from "../helpers/fixtures.js";

const now = new Date(2026, 10, 25, 9, 30);

function setup({ state = sampleState(), responses = {}, storage = createFakeStorage() } = {}) {
  const store = createStore(state, { storage, persistKey: "snapia" });
  const api = createFakeApi(responses);
  const navigations = [];
  const router = { navigate: path => navigations.push(path) };
  let renders = 0;
  store.subscribe(() => renders++);
  const controller = createStudioController({ api, store, ui: createFakeUi(), router, models: { studio: studioModel, master: masterModel }, now: () => now });
  return { store, api, controller, storage, navigations, renders: () => renders };
}

test("toggleBookmark menambah lalu menghapus id dan menyimpannya ke localStorage", () => {
  const { store, controller, storage } = setup();
  controller.toggleBookmark({ id: "2" });
  assert.deepEqual(store.get().persisted.bm, [2]);
  assert.deepEqual(JSON.parse(storage.getItem("snapia")).bm, [2]);
  controller.toggleBookmark({ id: "2" });
  assert.deepEqual(JSON.parse(storage.getItem("snapia")).bm, []);
});

test("pickDate (home) menyimpan tanggal filter; setHourFrom/setHourTo dari nilai select", () => {
  const { store, controller, renders } = setup();
  controller.pickDate({ context: "home", date: "2026-11-28" });
  controller.setHourFrom({}, { target: { value: "13" } });
  controller.setHourTo({}, { target: { value: "17" } });
  const { hDate, hFrom, hTo } = store.get().persisted;
  assert.deepEqual({ hDate, hFrom, hTo }, { hDate: "2026-11-28", hFrom: 13, hTo: 17 });
  assert.equal(renders(), 3);
});

test("moveMonth maju dan mundur, tidak sebelum bulan sekarang, melewati pergantian tahun", () => {
  const { store, controller } = setup();
  controller.moveMonth({ context: "home", step: "-1" });
  assert.equal(store.get().runtime.calendar.home, undefined);
  controller.moveMonth({ context: "home", step: "1" });
  assert.deepEqual(store.get().runtime.calendar.home, { year: 2026, month: 11 });
  controller.moveMonth({ context: "home", step: "1" });
  assert.deepEqual(store.get().runtime.calendar.home, { year: 2027, month: 0 });
  controller.moveMonth({ context: "home", step: "-1" });
  controller.moveMonth({ context: "home", step: "-1" });
  assert.deepEqual(store.get().runtime.calendar.home, { year: 2026, month: 10 });
});

test("setPropertyCategory menyimpan tab properti", () => {
  const { store, controller } = setup();
  controller.setPropertyCategory({ category: "Background" });
  assert.equal(store.get().persisted.pCat, "Background");
});

test("prefetchAvailability (Browse): hanya kunci yang belum ada, satu kali render ulang", async () => {
  const state = sampleState({ persisted: { hDate: "2026-11-26" }, runtime: { availability: { "1|2026-11-26": [9] } } });
  const { store, api, controller, renders } = setup({ state, responses: { "GET /availability?studio_id=2&date=2026-11-26": { body: { free: [10, 11] } } } });
  await controller.prefetchAvailability();
  assert.deepEqual(api.calls.map(call => call.path), ["/availability?studio_id=2&date=2026-11-26"]);
  assert.deepEqual(store.get().runtime.availability, { "1|2026-11-26": [9], "2|2026-11-26": [10, 11] });
  assert.equal(renders(), 1);
  await controller.prefetchAvailability();
  assert.equal(api.calls.length, 1);
  assert.equal(renders(), 1);
});

test("prefetchAvailability: tanggal filter kosong = hari ini; 400 disimpan sebagai daftar kosong; galat lain dilewati", async () => {
  const responses = {
    "GET /availability?studio_id=1&date=2026-11-25": { status: 400, body: { error: "Studio tidak tersedia" } },
    "GET /availability?studio_id=2&date=2026-11-25": { status: 500, body: { error: "Rusak" } },
  };
  const { store, controller, renders } = setup({ responses });
  await controller.prefetchAvailability();
  assert.deepEqual(store.get().runtime.availability, { "1|2026-11-25": [] });
  assert.equal(renders(), 1);
});

test("prefetchAvailability (langkah Pilih Waktu): studio dan tanggal booking berjalan", async () => {
  const state = sampleState({ runtime: { route: { name: "time", params: {}, query: {} } }, booking: { studio: 2, date: "2026-11-27" } });
  const { api, controller } = setup({ state, responses: { "GET /availability?studio_id=2&date=2026-11-27": { body: { free: [8] } } } });
  await controller.prefetchAvailability();
  assert.deepEqual(api.calls.map(call => call.path), ["/availability?studio_id=2&date=2026-11-27"]);
});

test("prefetchAvailability: tanpa render ulang bila halaman sudah berganti selama mengambil data", async () => {
  const state = sampleState({ persisted: { hDate: "2026-11-26" } });
  let store = null;
  const leave = () => {
    store.get().runtime.route = { name: "my", params: {}, query: {} };
    return { body: { free: [9] } };
  };
  const context = setup({ state, responses: { "GET /availability?studio_id=1&date=2026-11-26": leave, "GET /availability?studio_id=2&date=2026-11-26": { body: { free: [] } } } });
  store = context.store;
  await context.controller.prefetchAvailability();
  assert.equal(context.renders(), 0);
  assert.deepEqual(store.get().runtime.availability["1|2026-11-26"], [9]);
});

test("refreshMaster: render ulang hanya bila data master berubah", async () => {
  const body = { PKG: [], ALLPKG: [], FAV_PKG: null, DISC: { pct: 0, label: "" }, PEOPLE: [], BUDGET: [], STUDIOS: [], PROP: [], POSES: {} };
  const state = sampleState({ master: { json: JSON.stringify(body) } });
  const { store, controller, renders } = setup({ state, responses: { "GET /master": { body } } });
  assert.equal(await controller.refreshMaster(), false);
  assert.equal(renders(), 0);
  body.STUDIOS = [{ id: 5, name: "Baru" }];
  assert.equal(await controller.refreshMaster(), true);
  assert.equal(renders(), 1);
  assert.deepEqual(store.get().master.studios, [{ id: 5, name: "Baru" }]);
});

test("refreshMaster: galat jaringan diabaikan", async () => {
  const { controller, renders } = setup({ responses: { "GET /master": { status: 500, body: { error: "Rusak" } } } });
  assert.equal(await controller.refreshMaster(), false);
  assert.equal(renders(), 0);
});

test("prefetchAvailability: tanggal filter yang sudah lewat diganti hari ini", async () => {
  const responses = { "GET /availability?studio_id=1&date=2026-11-25": { body: { free: [10] } }, "GET /availability?studio_id=2&date=2026-11-25": { body: { free: [11] } } };
  const { api, controller } = setup({ state: sampleState({ persisted: { hDate: "2026-11-20" } }), responses });
  await controller.prefetchAvailability();
  assert.deepEqual(api.calls.map(call => call.path), ["/availability?studio_id=1&date=2026-11-25", "/availability?studio_id=2&date=2026-11-25"]);
});

// ---------- sisi admin: Studio + Ringkasan Studio + Detail Sesi (refactor MVC fase 8b) ----------
import { createAdminController, createAdminState } from "../../js/controllers/AdminController.js";
import * as adminModels from "../../js/models/admin/index.js";
import { flat } from "../helpers/markup.js";

const masterAnswer = { body: { PKG: [], ALLPKG: [], FAV_PKG: null, DISC: { pct: 0, label: "" }, PEOPLE: [], BUDGET: [], STUDIOS: [{ id: 1, name: "Baru" }], ALLSTUDIOS: [{ id: 1, name: "Baru" }], PROP: [], POSES: {}, POLICY: {} } };
const studioRow = (overrides = {}) => ({ id: 3, name: "Melati", status: "AVAILABLE", description: "", address: "", price: 0, people_range_id: 1, budget_range_id: 1, img: "/media/m.jpg", sessions: 2, bookings: 1, active_bookings: 1, impact: { sessions: 2, active_bookings: 1, paid_bookings: 0, refund_total: 0 }, ...overrides });
const newForm = overrides => ({ name: "Studio Senja", status: "AVAILABLE", description: "Cahaya", address: "Jl. A", price: "0", people_range_id: "1", budget_range_id: "1", ...overrides });
const apiFailure = (status, error, extra = {}) => ({ status, body: { error, ...extra } });

function setupStudioAdmin({ admin = {}, responses = {}, modalAnswers = [], readImage = async file => "data:image/jpeg;base64," + file.name } = {}) {
  const store = createStore({ ...sampleState({ persisted: { admin: true }, runtime: { accessDeniedOpen: false } }), admin: { ...createAdminState(), me: { username: "admin", must_change: false }, ...admin } }, { storage: createFakeStorage(), persistKey: "snapia" });
  const api = createFakeApi({ "GET /master": masterAnswer, ...responses });
  const ui = createFakeUi({ modalAnswers });
  const focused = [];
  ui.focus = selector => focused.push(selector);
  ui.scrollToEnd = () => {};
  const log = [];
  const router = { navigate: path => log.push(`navigate:${path}`) };
  const adminCore = createAdminController({ api, store, ui, router, models: { admin: adminModels }, logout: () => log.push("logout") });
  const controller = createStudioController({ api, store, ui, router, models: { studio: studioModel, master: masterModel, admin: adminModels }, admin: adminCore, files: { readImage }, now: () => now });
  const requests = () => api.calls.map(call => `${call.method} ${call.path}`);
  return { store, api, ui, controller, adminCore, focused, log, requests, admin: () => store.get().admin, toast: () => store.get().runtime.toast };
}

test("admin openNew: membuka/menutup Tambah studio dan menghapus kartu Berhasil", () => {
  const { controller, admin } = setupStudioAdmin({ admin: { studios: [], studioDone: { title: "x", text: "y" } } });
  controller.openNew();
  assert.equal(admin().openStudios.new, true);
  assert.equal(admin().studioDone, null);
  controller.openNew();
  assert.equal(admin().openStudios.new, false);
});

test("admin review: form kosong → galat nama + gambar dengan banner, isian disimpan, fokus ke field bertanda, tanpa permintaan server", () => {
  const { controller, admin, focused, api } = setupStudioAdmin({ admin: { studios: [studioRow()], openStudios: { new: true } } });
  controller.review(newForm({ name: "", description: "tetap" }));
  assert.deepEqual(admin().studioErrors, { top: "Input studio tidak valid. Periksa field yang ditandai.", name: "Nama studio wajib diisi.", img: "Gambar studio wajib diunggah." });
  assert.equal(admin().studioSummary, false);
  assert.equal(admin().newStudio.description, "tetap");
  assert.deepEqual(focused, [".amain .inv"]);
  assert.equal(api.calls.length, 0);
});

test("admin review: nama sudah dipakai studio lain → banner nama ganda", () => {
  const { controller, admin } = setupStudioAdmin({ admin: { studios: [studioRow()], images: { new: "/media/n.jpg" } } });
  controller.review(newForm({ name: " melati " }));
  assert.equal(admin().studioErrors.top, "Nama studio sudah digunakan oleh studio lain.");
});

test("admin review: isian valid + gambar → langkah Ringkasan Studio, belum ada POST (test-map 221)", () => {
  const { controller, admin, api } = setupStudioAdmin({ admin: { studios: [studioRow()], images: { new: "/media/n.jpg" }, studioErrors: { top: "lama" } } });
  controller.review(newForm());
  assert.equal(admin().studioSummary, true);
  assert.equal(admin().studioErrors, null);
  assert.deepEqual(admin().newStudio, { name: "Studio Senja", status: "AVAILABLE", description: "Cahaya", address: "Jl. A", price: 0, people_range_id: 1, budget_range_id: 1 });
  assert.equal(api.calls.length, 0);
});

test("admin save: tanpa Ringkasan Studio tidak mengirim apa pun (test-map 221)", async () => {
  const { controller, api } = setupStudioAdmin({ admin: { studios: [], newStudio: { name: "A" }, studioSummary: false } });
  await controller.save();
  assert.equal(api.calls.length, 0);
});

test("admin save dari Ringkasan: POST dengan nama dirapikan + gambar, studio baru terbuka, kartu Berhasil, daftar dan master dimuat ulang", async () => {
  const { controller, admin, api, requests, toast, store } = setupStudioAdmin({ admin: { studios: [studioRow()], openStudios: { new: true }, images: { new: "/media/n.jpg" }, newStudio: { name: " Senja ", status: "AVAILABLE", description: "", address: "", price: 0, people_range_id: 1, budget_range_id: 1 }, studioSummary: true }, responses: { "POST /admin/studios": { body: { id: 8 } } } });
  await controller.save();
  assert.deepEqual(requests(), ["POST /admin/studios", "GET /master"]);
  assert.deepEqual(api.calls[0].body, { name: "Senja", status: "AVAILABLE", description: "", address: "", price: 0, people_range_id: 1, budget_range_id: 1, img: "/media/n.jpg" });
  assert.deepEqual(admin().openStudios, { new: false, 8: true });
  assert.deepEqual(admin().studioDone, { title: "Studio berhasil ditambahkan", text: "Senja tersedia dan tampil di daftar studio pelanggan." });
  assert.equal(admin().studios, null);
  assert.equal(admin().newStudio, null);
  assert.equal(admin().studioSummary, false);
  assert.ok(!("new" in admin().images));
  assert.deepEqual(toast(), { message: "", error: "" });
  assert.equal(store.get().master.studios[0].name, "Baru");
});

test("admin save: status Tidak tersedia → teks kartu Berhasil versi tersembunyi", async () => {
  const { controller, admin } = setupStudioAdmin({ admin: { studios: [], images: { new: "/media/n.jpg" }, newStudio: { name: "Senja", status: "UNAVAILABLE", price: 0 }, studioSummary: true }, responses: { "POST /admin/studios": { body: { id: 8 } } } });
  await controller.save();
  assert.equal(admin().studioDone.text, "Senja disimpan dengan status Tidak tersedia, belum tampil di daftar studio pelanggan.");
});

test("admin save: 409 \"sudah dipakai\" → kembali ke form dengan galat nama ganda dan daftar studio dimuat ulang (test-map 225)", async () => {
  const { controller, admin, toast } = setupStudioAdmin({ admin: { studios: [studioRow()], images: { new: "/media/n.jpg" }, newStudio: { name: "Melati2", status: "AVAILABLE", price: 0 }, studioSummary: true }, responses: { "POST /admin/studios": apiFailure(409, "Nama studio sudah dipakai") } });
  await controller.save();
  assert.deepEqual(admin().studioErrors, { top: "Nama studio sudah digunakan oleh studio lain.", name: "Nama studio sudah digunakan. Gunakan nama lain." });
  assert.equal(admin().studios, null);
  assert.equal(admin().studioSummary, false);
  assert.equal(admin().newStudio.name, "Melati2");
  assert.equal(toast().error, "");
});

test("admin save: 400 \"Nama …\" → galat nama, daftar tidak dimuat ulang; galat lain → toast, tetap di Ringkasan", async () => {
  const bad = setupStudioAdmin({ admin: { studios: [studioRow()], newStudio: { name: "x", price: 0 }, studioSummary: true }, responses: { "POST /admin/studios": apiFailure(400, "Nama studio wajib diisi") } });
  await bad.controller.save();
  assert.equal(bad.admin().studioErrors.name, "Nama studio wajib diisi.");
  assert.equal(bad.admin().studios.length, 1);
  const down = setupStudioAdmin({ admin: { studios: [], newStudio: { name: "x", price: 0 }, studioSummary: true }, responses: { "POST /admin/studios": apiFailure(500, "Server sibuk") } });
  await down.controller.save();
  assert.equal(down.toast().error, "Server sibuk");
  assert.equal(down.admin().studioSummary, true);
});

test("admin save: 403 \"Hanya admin\" → Akses ditolak dengan kalimat menambahkan studio", async () => {
  const { controller, ui } = setupStudioAdmin({ admin: { studios: [], newStudio: { name: "x", price: 0 }, studioSummary: true }, responses: { "POST /admin/studios": apiFailure(403, "Hanya admin") } });
  await controller.save();
  assert.equal(ui.modals[0].title, "Akses ditolak");
  assert.match(flat(ui.modals[0].body), /Hanya admin yang dapat menambahkan studio\./);
});

test("admin backToForm (Ubah) kembali ke form dengan isian tetap; cancelNew mengosongkan semuanya", () => {
  const { controller, admin } = setupStudioAdmin({ admin: { studios: [], openStudios: { new: true }, images: { new: "/media/n.jpg", 3: "/media/x.jpg" }, newStudio: { name: "Senja" }, studioSummary: true } });
  controller.backToForm();
  assert.equal(admin().studioSummary, false);
  assert.equal(admin().newStudio.name, "Senja");
  controller.cancelNew();
  assert.deepEqual([admin().newStudio, admin().studioSummary, admin().studioErrors, admin().openStudios.new], [null, false, null, false]);
  assert.deepEqual(admin().images, { 3: "/media/x.jpg" });
});

test("admin uploadImage studio baru: galat lama dihapus (test-map 224), isian form disimpan, gambar diunggah ke /admin/media", async () => {
  const { controller, admin, api, toast } = setupStudioAdmin({ admin: { studios: [], openStudios: { new: true }, studioErrors: { top: "x", img: "Gambar studio wajib diunggah." } }, responses: { "POST /admin/media": { body: { url: "/media/n.jpg" } } } });
  await controller.uploadImage({ studio: "new" }, { name: "a.png" }, newForm({ name: "Ketikan" }));
  assert.equal(admin().studioErrors, null);
  assert.equal(admin().images.new, "/media/n.jpg");
  assert.equal(admin().newStudio.name, "Ketikan");
  assert.deepEqual(api.calls[0].body, { data: "data:image/jpeg;base64,a.png" });
  assert.equal(toast().message, "Gambar diunggah.");
});

test("admin uploadImage studio lama: isian disimpan sebagai draf, toast Klik Simpan; tanpa berkas tidak terjadi apa-apa; gagal baca → toast galat", async () => {
  const { controller, admin, toast, api } = setupStudioAdmin({ admin: { studios: [studioRow()], studioErrors: { top: "tetap" } }, responses: { "POST /admin/media": { body: { url: "/media/x.jpg" } } } });
  await controller.uploadImage({ studio: "3" }, null, {});
  assert.equal(api.calls.length, 0);
  await controller.uploadImage({ studio: "3" }, { name: "b.png" }, { name: "Draf" });
  assert.equal(admin().images[3], "/media/x.jpg");
  assert.deepEqual(admin().drafts["studio-3"], { name: "Draf" });
  assert.deepEqual(admin().studioErrors, { top: "tetap" });
  assert.equal(toast().message, "Gambar diunggah. Klik Simpan untuk menerapkan.");
  const broken = setupStudioAdmin({ admin: { studios: [] }, readImage: async () => { throw new Error("File bukan gambar"); } });
  await broken.controller.uploadImage({ studio: "new" }, { name: "c.txt" }, newForm());
  assert.equal(broken.toast().error, "File bukan gambar");
});

test("admin edit: PATCH dengan gambar baru, biaya tidak valid = 0, draf dan gambar dibuang, toast Studio disimpan; gagal → draf baris itu", async () => {
  const { controller, admin, api, requests, toast } = setupStudioAdmin({ admin: { studios: [studioRow()], images: { 3: "/media/x.jpg" }, drafts: { "studio-3": { name: "lama" } } }, responses: { "PATCH /admin/studios/3": { body: {} } } });
  await controller.edit({ id: "3" }, newForm({ name: "Melati Baru", price: "" }));
  assert.deepEqual(requests(), ["PATCH /admin/studios/3", "GET /master"]);
  assert.deepEqual(api.calls[0].body, { name: "Melati Baru", status: "AVAILABLE", description: "Cahaya", address: "Jl. A", price: 0, people_range_id: 1, budget_range_id: 1, img: "/media/x.jpg" });
  assert.deepEqual(admin().images, {});
  assert.ok(!("studio-3" in admin().drafts));
  assert.equal(admin().studios, null);
  assert.equal(toast().message, "Studio disimpan.");
  const failed = setupStudioAdmin({ admin: { studios: [studioRow()] }, responses: { "PATCH /admin/studios/3": apiFailure(409, "Nama studio sudah dipakai") } });
  await failed.controller.edit({ id: "3" }, newForm({ name: "Mawar" }));
  assert.equal(failed.toast().error, "Nama studio sudah dipakai");
  assert.equal(failed.admin().drafts["studio-3"].name, "Mawar");
});

test("admin delete studio: dialog dampak lewat withConfirm, 409 dampak baru → dialog kedua → ?confirm=1, toast ringkasan pembatalan", async () => {
  const impact = { sessions: 2, active_bookings: 1, paid_bookings: 1, refund_total: 90000 };
  const { controller, ui, requests, admin, toast } = setupStudioAdmin({
    modalAnswers: [true, true],
    admin: { studios: [studioRow()], openStudios: { 3: true }, bookings: [], transactions: {}, sessions: { "3|2026-11": [] } },
    responses: { "DELETE /admin/studios/3": apiFailure(409, "Perlu konfirmasi", { needs_confirm: true, impact }), "DELETE /admin/studios/3?confirm=1": { body: { ok: true, cancelled: 2, refunded: 1, refund_failed: 1 } } },
  });
  await controller.delete({ id: "3" });
  assert.deepEqual(ui.modals.map(modal => modal.title), ["Hapus Melati?", "Hapus Melati?"]);
  assert.match(flat(ui.modals[0].body), /Studio ini memiliki 2 sesi dan 1 booking aktif\. Setelah dikonfirmasi, seluruh booking aktif dibatalkan dan dana yang sudah dibayar dikembalikan 100% kepada pelanggan\. Studio beserta sesinya tidak lagi tampil, tetapi riwayat booking tetap tersimpan\./);
  assert.match(flat(ui.modals[1].body), /\(1 sudah dibayar, total refund Rp90\.000\)/);
  assert.deepEqual(ui.modals[0].buttons.map(button => button.label), ["Kembali", "Ya, Hapus Studio"]);
  assert.deepEqual(requests(), ["DELETE /admin/studios/3", "DELETE /admin/studios/3?confirm=1", "GET /master"]);
  assert.equal(toast().message, 'Studio "Melati" dihapus. 2 booking dibatalkan, 1 di-refund, 1 refund gagal (tindak lanjuti manual di menu Transaksi).');
  assert.deepEqual([admin().studios, admin().bookings, admin().transactions], [null, null, null]);
  assert.deepEqual(admin().sessions, {});
  assert.ok(!(3 in admin().openStudios));
});

test("admin delete studio: Kembali → tidak ada permintaan", async () => {
  const { controller, requests } = setupStudioAdmin({ modalAnswers: [false], admin: { studios: [studioRow()] } });
  await controller.delete({ id: 3 });
  assert.deepEqual(requests(), []);
});

test("admin loadStudios: daftar lewat AdminController.load, lalu sesi setiap studio yang terbuka", async () => {
  const { controller, requests, admin } = setupStudioAdmin({ admin: { studios: [studioRow(), studioRow({ id: 4 })], openStudios: { 4: true } }, responses: { "GET /admin/studios/4/sessions?month=2026-11": { body: [{ id: 1 }] } } });
  await controller.loadStudios();
  assert.deepEqual(requests(), ["GET /admin/studios/4/sessions?month=2026-11"]);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(admin().sessions["4|2026-11"], [{ id: 1 }]);
  const empty = setupStudioAdmin({ responses: { "GET /admin/studios": { body: [studioRow()] } } });
  await empty.controller.loadStudios();
  assert.equal(empty.admin().studios[0].name, "Melati");
});

test("admin loadSessions: sekali per studio|bulan; galat akses lewat handleAccessError (test-map 219), galat lain → toast + daftar kosong", async () => {
  const ok = setupStudioAdmin({ admin: { sessionMonths: { 3: "2026-12" } }, responses: { "GET /admin/studios/3/sessions?month=2026-12": { body: [{ id: 5 }] } } });
  await ok.controller.loadSessions(3);
  await ok.controller.loadSessions(3);
  assert.deepEqual(ok.requests(), ["GET /admin/studios/3/sessions?month=2026-12"]);
  assert.deepEqual(ok.admin().sessions["3|2026-12"], [{ id: 5 }]);
  const denied = setupStudioAdmin({ responses: { "GET /admin/studios/3/sessions?month=2026-11": apiFailure(403, "Hanya admin") } });
  const seen = [];
  const original = denied.adminCore.handleAccessError;
  denied.adminCore.handleAccessError = (error, what) => {
    seen.push(error.message);
    return original(error, what);
  };
  await denied.controller.loadSessions(3);
  assert.deepEqual(seen, ["Hanya admin"]);
  assert.equal(denied.ui.modals[0].title, "Akses ditolak");
  assert.ok(!("3|2026-11" in denied.admin().sessions));
  assert.equal(denied.admin().loading["s3|2026-11"], false);
  const broken = setupStudioAdmin({ responses: { "GET /admin/studios/3/sessions?month=2026-11": apiFailure(500, "Server sibuk") } });
  await broken.controller.loadSessions(3);
  assert.equal(broken.toast().error, "Server sibuk");
  assert.deepEqual(broken.admin().sessions["3|2026-11"], []);
});

test("admin moveSessionMonth / pickSessionDay / toggleSession / toggleAddSession / closeSessionForm", () => {
  const { controller, admin } = setupStudioAdmin({ admin: { editingSession: 4, addingSessionFor: 3 } });
  controller.moveSessionMonth({ studio: "3", step: "1" });
  assert.equal(admin().sessionMonths[3], "2026-12");
  assert.equal(admin().sessionDays[3], "2026-12-01");
  assert.deepEqual([admin().editingSession, admin().addingSessionFor], [null, null]);
  controller.moveSessionMonth({ studio: "3", step: "-1" });
  assert.equal(admin().sessionDays[3], "2026-11-25");
  controller.pickSessionDay({ studio: "3", date: "2026-11-28" });
  assert.equal(admin().sessionDays[3], "2026-11-28");
  controller.toggleSession({ studio: "3", id: "7" });
  assert.equal(admin().editingSession, 7);
  controller.toggleAddSession({ studio: "3" });
  assert.deepEqual([admin().editingSession, admin().addingSessionFor], [null, 3]);
  controller.toggleSession({ studio: "3", id: "7" });
  assert.deepEqual([admin().editingSession, admin().addingSessionFor], [7, null]);
  controller.toggleSession({ studio: "3", id: "7" });
  assert.equal(admin().editingSession, null);
  controller.toggleAddSession({ studio: "3" });
  controller.closeSessionForm();
  assert.deepEqual([admin().editingSession, admin().addingSessionFor], [null, null]);
});

test("admin addSession: POST berulang, toast jumlah + tanggal dilewati, hari/bulan pindah ke tanggal itu, cache sesi + daftar studio dimuat ulang", async () => {
  const { controller, api, requests, admin, toast } = setupStudioAdmin({
    admin: { studios: [studioRow()], addingSessionFor: 3, sessions: { "3|2026-11": [], "4|2026-11": [] }, bookings: [], drafts: { "session-new-3": { date: "lama" } } },
    responses: { "POST /admin/studios/3/sessions": { body: { created: [1, 2, 3], skipped: ["2026-12-28"] } }, "GET /admin/studios": { body: [studioRow({ sessions: 5 })] } },
  });
  await controller.addSession({ studio: "3" }, { date: "2026-12-26", start: "09:00", end: "09:50", repeat: "4" });
  assert.deepEqual(requests(), ["POST /admin/studios/3/sessions", "GET /admin/studios"]);
  assert.deepEqual(api.calls[0].body, { date: "2026-12-26", start: "09:00", end: "09:50", repeat: 4 });
  assert.equal(toast().message, "3 sesi berhasil ditambahkan. 1 tanggal dilewati karena bertabrakan: 2026-12-28.");
  assert.deepEqual([admin().sessionDays[3], admin().sessionMonths[3], admin().addingSessionFor], ["2026-12-26", "2026-12", null]);
  assert.deepEqual(Object.keys(admin().sessions), ["4|2026-11"]);
  assert.equal(admin().bookings, null);
  assert.equal(admin().studios[0].sessions, 5);
  assert.ok(!("session-new-3" in admin().drafts));
});

test("admin addSession: satu sesi → toast singkat; bertabrakan (409) → toast galat, form tetap terbuka dengan isiannya", async () => {
  const one = setupStudioAdmin({ admin: { studios: [] }, responses: { "POST /admin/studios/3/sessions": { body: { created: [1], skipped: [] } }, "GET /admin/studios": { body: [] } } });
  await one.controller.addSession({ studio: "3" }, { date: "2026-11-26", start: "09:00", end: "09:50", repeat: "1" });
  assert.equal(one.toast().message, "Sesi berhasil ditambahkan.");
  const values = { date: "2026-11-26", start: "09:00", end: "09:50", repeat: "1" };
  const clash = setupStudioAdmin({ admin: { addingSessionFor: 3 }, responses: { "POST /admin/studios/3/sessions": apiFailure(409, "Sesi bertabrakan dengan 09:00 - 09:50") } });
  await clash.controller.addSession({ studio: "3" }, values);
  assert.equal(clash.toast().error, "Sesi bertabrakan dengan 09:00 - 09:50");
  assert.equal(clash.admin().addingSessionFor, 3);
  assert.deepEqual(clash.admin().drafts["session-new-3"], values);
});

const session = { id: 7, date: "2026-11-26", start: "09:00", end: "09:50", status: "UNAVAILABLE", past: false, booking: { id: 12, customer: "Budi", status: "Terbayar" }, impact: { active_bookings: 1, paid_bookings: 1, refund_total: 90000, customers: ["Budi"] } };

test("admin saveSession: tanpa dialog awal; 409 needs_confirm → dialog Ubah sesi → ?confirm=1, toast + pelanggan diberi tahu", async () => {
  const { controller, ui, requests, admin, toast, api } = setupStudioAdmin({
    modalAnswers: [true],
    admin: { studios: [], editingSession: 7, sessions: { "3|2026-11": [session] } },
    responses: { "PATCH /admin/sessions/7": apiFailure(409, "Perlu konfirmasi", { needs_confirm: true, impact: session.impact }), "PATCH /admin/sessions/7?confirm=1": { body: { date: "2026-11-27", notified: 1 } }, "GET /admin/studios": { body: [] } },
  });
  await controller.saveSession({ studio: "3", id: "7" }, { date: "2026-11-27", start: "10:00", end: "10:50" });
  assert.deepEqual(ui.modals.map(modal => modal.title), ["Ubah sesi 09:00 - 09:50?"]);
  assert.match(flat(ui.modals[0].body), /Sesi ini memiliki 1 booking aktif \(Budi\)\. Setelah dikonfirmasi, jadwal sesi diubah dan pelanggan menerima email berisi jadwal baru\./);
  assert.deepEqual(ui.modals[0].buttons.map(button => button.label), ["Kembali", "Ya, Ubah Sesi"]);
  assert.deepEqual(requests(), ["PATCH /admin/sessions/7", "PATCH /admin/sessions/7?confirm=1", "GET /admin/studios"]);
  assert.deepEqual(api.calls[1].body, { date: "2026-11-27", start: "10:00", end: "10:50" });
  assert.equal(toast().message, "Sesi berhasil diperbarui. Pelanggan dari 1 booking terdampak sudah diberi tahu lewat email.");
  assert.deepEqual([admin().editingSession, admin().sessionDays[3], admin().sessionMonths[3]], [null, "2026-11-27", "2026-11"]);
});

test("admin saveSession: dialog dibatalkan → isian tetap (draf), form tetap terbuka; sesi tidak dikenal → tidak ada permintaan", async () => {
  const values = { date: "2026-11-27", start: "10:00", end: "10:50" };
  const { controller, requests, admin } = setupStudioAdmin({ modalAnswers: [false], admin: { editingSession: 7, sessions: { "3|2026-11": [session] } }, responses: { "PATCH /admin/sessions/7": apiFailure(409, "Perlu konfirmasi", { needs_confirm: true, impact: session.impact }) } });
  await controller.saveSession({ studio: "3", id: "7" }, values);
  assert.deepEqual(requests(), ["PATCH /admin/sessions/7"]);
  assert.deepEqual(admin().drafts["session-7"], values);
  assert.equal(admin().editingSession, 7);
  await controller.saveSession({ studio: "3", id: "99" }, values);
  assert.equal(requests().length, 1);
});

test("admin deleteSession: dialog dampak lewat withConfirm lebih dulu, lalu DELETE; toast ringkasan pembatalan", async () => {
  const { controller, ui, requests, toast, admin } = setupStudioAdmin({ modalAnswers: [true], admin: { studios: [], editingSession: 7, sessions: { "3|2026-11": [session] } }, responses: { "DELETE /admin/sessions/7": { body: { ok: true, cancelled: 1, refunded: 1 } }, "GET /admin/studios": { body: [] } } });
  await controller.deleteSession({ studio: "3", id: "7" });
  assert.equal(ui.modals[0].title, "Hapus sesi 2026-11-26 09:00 - 09:50?");
  assert.match(flat(ui.modals[0].body), /Sesi ini memiliki 1 booking aktif \(Budi\), 1 sudah dibayar \(total refund Rp90\.000\)\. Setelah dikonfirmasi, booking tersebut dibatalkan, dana yang sudah dibayar dikembalikan 100%, dan pelanggan diberi tahu lewat email\./);
  assert.deepEqual(requests(), ["DELETE /admin/sessions/7", "GET /admin/studios"]);
  assert.equal(toast().message, "Sesi dihapus. 1 booking dibatalkan, 1 di-refund.");
  assert.equal(admin().editingSession, null);
  const free = setupStudioAdmin({ modalAnswers: [false], admin: { sessions: { "3|2026-11": [{ ...session, impact: { active_bookings: 0 } }] } } });
  await free.controller.deleteSession({ studio: "3", id: "7" });
  assert.match(flat(free.ui.modals[0].body), /Sesi ini belum memiliki booking aktif dan akan dihapus dari daftar sesi\./);
  assert.deepEqual(free.requests(), []);
});

test("admin dialog dibatalkan (hapus studio/sesi, ubah sesi) → tanpa render ulang, jadi fokus kembali ke tombol pembuka", async () => {
  const { controller, store } = setupStudioAdmin({ modalAnswers: [false, false, false], admin: { studios: [studioRow()], sessions: { "3|2026-11": [session] } }, responses: { "PATCH /admin/sessions/7": apiFailure(409, "Perlu konfirmasi", { needs_confirm: true, impact: session.impact }) } });
  let renders = 0;
  store.subscribe(() => renders++);
  await controller.delete({ id: "3" });
  await controller.deleteSession({ studio: "3", id: "7" });
  await controller.saveSession({ studio: "3", id: "7" }, { date: "2026-11-27", start: "10:00", end: "10:50" });
  assert.equal(renders, 0);
});
