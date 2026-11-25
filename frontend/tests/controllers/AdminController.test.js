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
