import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../js/core/store.js";
import { createAdminController, createAdminState } from "../../js/controllers/AdminController.js";
import * as adminModels from "../../js/models/admin/index.js";
import { createFakeApi } from "../helpers/fakeApi.js";
import { createFakeUi } from "../helpers/fakeUi.js";
import { createFakeStorage } from "../helpers/fakeStorage.js";
import { sampleState } from "../helpers/fixtures.js";

// admin = isi awal slice admin; runtime ditambahkan ke sampleState
function setupAdmin({ responses = {}, modalAnswers = [], admin = {}, runtime = {} } = {}) {
  const store = createStore({ ...sampleState({ persisted: { admin: true, me: "admin", user: { name: "Admin", id: 0 } }, runtime: { accessDeniedOpen: false, ...runtime } }), admin: { ...createAdminState(), me: { username: "admin", must_change: false }, ...admin } }, { storage: createFakeStorage(), persistKey: "snapia" });
  const api = createFakeApi(responses);
  api.token = "lama";
  const log = [];
  const ui = createFakeUi({ modalAnswers });
  const fakeModal = ui.modal;
  ui.modal = options => {
    log.push(`modal:${options.title}`);
    return fakeModal(options);
  };
  ui.scrollToEnd = () => log.push("scroll");
  store.subscribe(() => log.push("render"));
  const router = { navigate: path => log.push(`navigate:${path}`) };
  const logout = () => log.push("logout");
  const controller = createAdminController({ api, store, ui, router, models: { admin: adminModels }, logout });
  return { store, api, ui, log, controller };
}

const forbidden = message => Object.assign(new Error(message), { status: 403, data: { error: message } });

test("createAdminState: semua kunci kosong, query kosong, periode 30 hari", () => {
  const state = createAdminState();
  assert.equal(state.me, null);
  assert.equal(state.query, "");
  assert.equal(state.operationsPeriod, "month");
  assert.deepEqual(state.loading, {});
  assert.deepEqual(state.drafts, {});
  for (const key of ["revenue", "operations", "customers", "customerDetail", "transactions", "packages", "discount", "editingOperation", "studios", "books", "props", "poses"]) {
    assert.equal(state[key], null, key);
  }
});

test("handleError: 403 \"Hanya admin\" → satu dialog Akses ditolak, login dilepas lebih dulu; Masuk sebagai Admin → /login", async () => {
  const { controller, log, ui, store } = setupAdmin({ modalAnswers: ["login"] });
  await controller.handleError(forbidden("Hanya admin"), "Hanya admin yang dapat menambahkan studio.");
  assert.deepEqual(log, ["logout", "modal:Akses ditolak", "navigate:/login"]);
  assert.match(String(ui.modals[0].body), /Hanya admin yang dapat menambahkan studio\. Akun yang sedang masuk adalah akun pelanggan\. Masuk dengan akun admin untuk melanjutkan\./);
  assert.deepEqual(ui.modals[0].buttons.map(button => [button.label, button.value, button.style]), [["Kembali ke Beranda", "home", "ghost"], ["Masuk sebagai Admin", "login", undefined]]);
  assert.equal(store.get().runtime.accessDeniedOpen, false);
});

test("Akses ditolak: Kembali ke Beranda tetap di beranda (logout sudah pindah), dialog kedua saat yang pertama terbuka diabaikan", async () => {
  const { controller, log, ui } = setupAdmin({ modalAnswers: ["home"] });
  const first = controller.showAccessDenied();
  await controller.showAccessDenied();
  await first;
  assert.equal(ui.modals.length, 1);
  assert.match(String(ui.modals[0].body), /Hanya admin yang dapat membuka halaman admin\./);
  assert.deepEqual(log, ["logout", "modal:Akses ditolak"]);
});

test("Akses ditolak: Escape (null) → /login", async () => {
  const { controller, log } = setupAdmin();
  await controller.showAccessDenied();
  assert.equal(log.at(-1), "navigate:/login");
});

test("handleError: 403 lain (Password saat ini salah) → toast galat, login tetap", async () => {
  const { controller, log, store } = setupAdmin();
  await controller.handleError(forbidden("Password saat ini salah"));
  assert.deepEqual(store.get().runtime.toast, { message: "", error: "Password saat ini salah" });
  assert.ok(!log.includes("logout"));
  assert.ok(!log.some(entry => entry.startsWith("modal:")));
});

test("handleError: 401 → logout tanpa dialog", async () => {
  const { controller, log } = setupAdmin();
  await controller.handleError(Object.assign(new Error("Sesi habis"), { status: 401 }));
  assert.deepEqual(log, ["logout"]);
});

test("handleError: 403 \"Ganti password\" → must_change ditandai, ke /admin/account", async () => {
  const { controller, log, store } = setupAdmin();
  await controller.handleError(forbidden("Ganti password bawaan terlebih dahulu (menu Akun Admin)"));
  assert.equal(store.get().admin.me.must_change, true);
  assert.deepEqual(log, ["navigate:/admin/account"]);
});

test("load: memuat sekali ke slice admin lalu render; kunci yang sudah ada atau sedang dimuat tidak diminta lagi", async () => {
  const { controller, api, store, log } = setupAdmin({ responses: { "GET /admin/transactions": { body: { rows: [], paid: 5, refunded: 0 } } } });
  const first = controller.load("transactions", () => api.get("/admin/transactions"), {});
  assert.equal(store.get().admin.loading.transactions, true);
  await controller.load("transactions", () => api.get("/admin/transactions"), {});
  await first;
  await controller.load("transactions", () => api.get("/admin/transactions"), {});
  assert.equal(api.calls.length, 1);
  assert.deepEqual(store.get().admin.transactions, { rows: [], paid: 5, refunded: 0 });
  assert.equal(store.get().admin.loading.transactions, false);
  assert.deepEqual(log, ["render"]);
});

test("load: galat biasa → toast galat dan nilai cadangan", async () => {
  const { controller, api, store } = setupAdmin({ responses: { "GET /admin/transactions": { status: 500, body: { error: "Rusak" } } } });
  await controller.load("transactions", () => api.get("/admin/transactions"), { rows: [] });
  assert.deepEqual(store.get().admin.transactions, { rows: [] });
  assert.equal(store.get().runtime.toast.error, "Rusak");
});

test("load: galat lewat handleError (403 Hanya admin → Akses ditolak, kunci tetap kosong dan tidak sedang dimuat)", async () => {
  const { controller, api, store, log } = setupAdmin({ responses: { "GET /admin/customers": { status: 403, body: { error: "Hanya admin" } } } });
  await controller.load("customers", () => api.get("/admin/customers"), []);
  assert.deepEqual(log.slice(0, 2), ["logout", "modal:Akses ditolak"]);
  assert.equal(store.get().admin.customers, null);
  assert.equal(store.get().admin.loading.customers, false);
});

test("load: 403 Ganti password → /admin/account", async () => {
  const { controller, api, log } = setupAdmin({ responses: { "GET /admin/revenue": { status: 403, body: { error: "Ganti password bawaan terlebih dahulu (menu Akun Admin)" } } } });
  await controller.load("revenue", () => api.get("/admin/revenue"), {});
  assert.deepEqual(log, ["navigate:/admin/account"]);
});

test("run: toast lama dihapus, aksi berhasil → toast pesan, satu render, true", async () => {
  const { controller, store, log } = setupAdmin({ runtime: { toast: { message: "lama", error: "lama" } }, admin: { stdone: { title: "x" } } });
  const done = await controller.run(async () => {}, "Disimpan.");
  assert.equal(done, true);
  assert.deepEqual(store.get().runtime.toast, { message: "Disimpan.", error: "" });
  assert.equal(store.get().admin.stdone, null);
  assert.deepEqual(log, ["render"]);
});

test("run: aksi boleh mengisi toast sendiri bila tanpa pesan", async () => {
  const { controller, store } = setupAdmin();
  await controller.run(async () => store.update("runtime", { toast: { message: "Akun dihapus (2 foto ikut terhapus).", error: "" } }, { silent: true }));
  assert.equal(store.get().runtime.toast.message, "Akun dihapus (2 foto ikut terhapus).");
});

test("run: galat biasa → toast galat, isian form disimpan sebagai draf (tanpa sandi), false", async () => {
  const { controller, store, log } = setupAdmin();
  const done = await controller.run(async () => {
    throw Object.assign(new Error("Nominal tidak valid"), { status: 400 });
  }, "Disimpan.", undefined, { draft: { key: "operation", values: { label: "Sewa", amount: "x" } } });
  assert.equal(done, false);
  assert.deepEqual(store.get().runtime.toast, { message: "", error: "Nominal tidak valid" });
  assert.deepEqual(store.get().admin.drafts.operation, { label: "Sewa", amount: "x" });
  assert.deepEqual(log, ["render"]);
});

test("run: galat akses lewat handleError dengan kalimat what (403 Hanya admin → Akses ditolak), tanpa toast", async () => {
  const { controller, ui, store } = setupAdmin();
  const done = await controller.run(async () => {
    throw forbidden("Hanya admin");
  }, "Disimpan.", "Hanya admin yang dapat mengubah studio.");
  assert.equal(done, false);
  assert.match(String(ui.modals[0].body), /Hanya admin yang dapat mengubah studio\./);
  assert.equal(store.get().runtime.toast.error, "");
});

test("run: 403 Ganti password → /admin/account (sama dengan load)", async () => {
  const { controller, log } = setupAdmin();
  await controller.run(async () => {
    throw forbidden("Ganti password bawaan terlebih dahulu (menu Akun Admin)");
  });
  assert.deepEqual(log, ["navigate:/admin/account"]);
});

test("confirm: memakai ui.modal tepat sekali, Kembali + tombol aksi; true hanya bila tombol aksi", async () => {
  const { controller, ui } = setupAdmin({ modalAnswers: [true] });
  assert.equal(await controller.confirm({ title: "Konfirmasi Hapus Paket", body: "Hapus paket ini?", okLabel: "Ya, Hapus Paket" }), true);
  assert.equal(ui.modals.length, 1);
  assert.deepEqual(ui.modals[0].buttons.map(button => [button.label, button.value]), [["Kembali", false], ["Ya, Hapus Paket", true]]);
  assert.equal(await controller.confirm({ title: "T", body: "B", okLabel: "Ya" }), false);
});

test("setSearch: query admin disimpan dan outlet dirender", () => {
  const { controller, store, log } = setupAdmin();
  controller.setSearch("walk");
  assert.equal(store.get().admin.query, "walk");
  assert.deepEqual(log, ["render"]);
});

// ---------- Dashboard ----------
const operationsData = { period: "month", items: [{ id: 4, date: "2026-11-20", label: "Sewa", kind: "biaya", amount: 200000, note: "" }] };

test("loadDashboard: pendapatan dan rekap periode terpilih dimuat sekali", async () => {
  const { controller, api, store } = setupAdmin({ admin: { operationsPeriod: "week" }, responses: { "GET /admin/revenue": { body: { today: {} } }, "GET /admin/ops?period=week": { body: operationsData } } });
  await controller.loadDashboard();
  await controller.loadDashboard();
  assert.deepEqual(api.calls.map(call => call.path), ["/admin/revenue", "/admin/ops?period=week"]);
  assert.deepEqual(store.get().admin.operations, operationsData);
});

test("setOperationsPeriod: periode baru, rekap dikosongkan (dimuat ulang oleh after), render", () => {
  const { controller, store, log } = setupAdmin({ admin: { operations: operationsData } });
  controller.setOperationsPeriod("day");
  assert.equal(store.get().admin.operationsPeriod, "day");
  assert.equal(store.get().admin.operations, null);
  assert.deepEqual(log, ["render"]);
});

test("editOperation: item masuk mode ubah (draf lama dibuang), render lalu gulir ke form; cancel keluar dari mode ubah", () => {
  const { controller, store, log } = setupAdmin({ admin: { operations: operationsData, drafts: { operation: { label: "lama" } } } });
  controller.editOperation({ id: "4" });
  assert.equal(store.get().admin.editingOperation.id, 4);
  assert.equal(store.get().admin.drafts.operation, undefined);
  assert.deepEqual(log, ["render", "scroll"]);
  controller.cancelOperationEdit();
  assert.equal(store.get().admin.editingOperation, null);
});

test("saveOperation: tambah (POST, nominal angka), rekap dimuat ulang, toast", async () => {
  const { controller, api, store } = setupAdmin({ admin: { operations: operationsData }, responses: { "POST /admin/ops": { body: { id: 9 } } } });
  await controller.saveOperation({ date: "2026-11-25", label: "Listrik", kind: "biaya", amount: "30000", note: "" });
  assert.deepEqual(api.calls[0], { method: "POST", path: "/admin/ops", body: { date: "2026-11-25", label: "Listrik", kind: "biaya", amount: 30000, note: "" } });
  assert.equal(store.get().admin.operations, null);
  assert.equal(store.get().runtime.toast.message, "Rekap operasional disimpan.");
});

test("saveOperation: mode ubah → PATCH item itu, keluar dari mode ubah; galat → draf disimpan, mode ubah tetap", async () => {
  let setup = setupAdmin({ admin: { operations: operationsData, editingOperation: operationsData.items[0] }, responses: { "PATCH /admin/ops/4": { body: { ok: true } } } });
  await setup.controller.saveOperation({ date: "2026-11-20", label: "Sewa", kind: "biaya", amount: "1", note: "" });
  assert.equal(setup.api.calls[0].path, "/admin/ops/4");
  assert.equal(setup.store.get().admin.editingOperation, null);
  setup = setupAdmin({ admin: { operations: operationsData, editingOperation: operationsData.items[0] }, responses: { "PATCH /admin/ops/4": { status: 400, body: { error: "Nominal tidak valid" } } } });
  const values = { date: "2026-11-20", label: "Sewa", kind: "biaya", amount: "-1", note: "" };
  await setup.controller.saveOperation(values);
  assert.equal(setup.store.get().runtime.toast.error, "Nominal tidak valid");
  assert.deepEqual(setup.store.get().admin.drafts.operation, values);
  assert.equal(setup.store.get().admin.editingOperation.id, 4);
  assert.notEqual(setup.store.get().admin.operations, null);
});

test("deleteOperation: modal Konfirmasi Hapus Item Rekap; Kembali → tanpa permintaan; ya → DELETE, toast Item dihapus.", async () => {
  let setup = setupAdmin({ modalAnswers: [false], admin: { operations: operationsData } });
  await setup.controller.deleteOperation({ id: "4" });
  assert.equal(setup.api.calls.length, 0);
  assert.equal(setup.ui.modals[0].title, "Konfirmasi Hapus Item Rekap");
  assert.equal(String(setup.ui.modals[0].body), "<p>Hapus item rekap ini?</p>");
  setup = setupAdmin({ modalAnswers: [true], admin: { operations: operationsData, editingOperation: operationsData.items[0] }, responses: { "DELETE /admin/ops/4": { body: { ok: true } } } });
  await setup.controller.deleteOperation({ id: "4" });
  assert.equal(setup.api.calls[0].method, "DELETE");
  assert.equal(setup.store.get().admin.operations, null);
  assert.equal(setup.store.get().admin.editingOperation, null);
  assert.equal(setup.store.get().runtime.toast.message, "Item dihapus.");
});

// ---------- Pengguna ----------
test("loadUsers: daftar pelanggan dimuat sekali", async () => {
  const { controller, api, store } = setupAdmin({ responses: { "GET /admin/customers": { body: [{ id: 3 }] } } });
  await controller.loadUsers();
  await controller.loadUsers();
  assert.equal(api.calls.length, 1);
  assert.deepEqual(store.get().admin.customers, [{ id: 3 }]);
});

test("openCustomer: detail (booking + foto) masuk slice, render lalu gulir; closeCustomer menutupnya", async () => {
  const { controller, store, log } = setupAdmin({ responses: { "GET /admin/customers/3/bookings": { body: { customer: { id: 3 }, bookings: [] } }, "GET /admin/customers/3/photos": { body: { photos: [{ id: 7 }] } } } });
  await controller.openCustomer({ id: "3" });
  assert.deepEqual(store.get().admin.customerDetail, { customer: { id: 3 }, bookings: [], photos: [{ id: 7 }] });
  assert.deepEqual(log, ["render", "scroll"]);
  controller.closeCustomer();
  assert.equal(store.get().admin.customerDetail, null);
});

test("deleteCustomer: modal Konfirmasi Hapus Akun dengan nama (di-escape) sekali; ya → DELETE, daftar terkait dikosongkan, toast jumlah foto", async () => {
  const { controller, api, store, ui } = setupAdmin({ modalAnswers: [true], admin: { customers: [{ id: 3 }], customerDetail: { customer: { id: 3 } }, revenue: {}, operations: {}, studios: [], books: [], transactions: {}, sess: { "1|2026-11": [] } }, responses: { "DELETE /admin/customers/3": { body: { ok: true, photos_deleted: 2 } } } });
  await controller.deleteCustomer({ id: "3", name: "Dewi <i>" });
  assert.equal(ui.modals.length, 1);
  assert.equal(ui.modals[0].title, "Konfirmasi Hapus Akun");
  assert.equal(String(ui.modals[0].body), "<p>Hapus akun \"Dewi &lt;i&gt;\" beserta SELURUH booking, pembayaran, dan foto miliknya?</p><p>Tindakan ini tidak dapat dibatalkan.</p>");
  assert.deepEqual(ui.modals[0].buttons.map(button => button.label), ["Kembali", "Ya, Hapus Akun"]);
  assert.deepEqual(api.calls.map(call => `${call.method} ${call.path}`), ["DELETE /admin/customers/3"]);
  const admin = store.get().admin;
  assert.deepEqual([admin.customers, admin.customerDetail, admin.revenue, admin.operations, admin.studios, admin.books, admin.transactions], [null, null, null, null, null, null, null]);
  assert.deepEqual(admin.sess, {});
  assert.equal(store.get().runtime.toast.message, "Akun dihapus (2 foto ikut terhapus).");
});

test("deleteCustomer: Kembali → tanpa permintaan, daftar tetap", async () => {
  const { controller, api, store } = setupAdmin({ modalAnswers: [false], admin: { customers: [{ id: 3 }] } });
  await controller.deleteCustomer({ id: "3", name: "Dewi" });
  assert.equal(api.calls.length, 0);
  assert.deepEqual(store.get().admin.customers, [{ id: 3 }]);
});

// ---------- Transaksi ----------
test("loadTransactions: dimuat sekali; galat → cadangan kosong + toast", async () => {
  let setup = setupAdmin({ responses: { "GET /admin/transactions": { body: { rows: [{ id: 1 }], paid: 1, refunded: 0 } } } });
  await setup.controller.loadTransactions();
  assert.equal(setup.store.get().admin.transactions.paid, 1);
  setup = setupAdmin({ responses: { "GET /admin/transactions": { status: 500, body: { error: "Rusak" } } } });
  await setup.controller.loadTransactions();
  assert.deepEqual(setup.store.get().admin.transactions, { rows: [], paid: 0, refunded: 0 });
});
