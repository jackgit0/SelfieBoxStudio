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
  for (const key of ["revenue", "operations", "customers", "customerDetail", "transactions", "packages", "discount", "editingOperation", "studios", "bookings", "bookingDetail", "properties", "poses", "newStudio", "studioErrors", "studioDone"]) {
    assert.equal(state[key], null, key);
  }
});

test("handleError: 403 \"Hanya admin\" → satu dialog Akses ditolak, login dilepas lebih dulu; Masuk sebagai Admin → /login", async () => {
  const { controller, log, ui, store } = setupAdmin({ modalAnswers: ["login"] });
  await controller.handleError(forbidden("Hanya admin"), "Hanya admin yang dapat menambahkan studio.");
  assert.deepEqual(log, ["logout", "modal:Akses ditolak", "navigate:/login"]);
  assert.match(flat(ui.modals[0].body), /Hanya admin yang dapat menambahkan studio\. Akun yang sedang masuk adalah akun pelanggan\. Masuk dengan akun admin untuk melanjutkan\./);
  assert.deepEqual(ui.modals[0].buttons.map(button => [button.label, button.value, button.style]), [["Kembali ke Beranda", "home", "ghost"], ["Masuk sebagai Admin", "login", undefined]]);
  assert.equal(store.get().runtime.accessDeniedOpen, false);
});

test("Akses ditolak: Kembali ke Beranda tetap di beranda (logout sudah pindah), dialog kedua saat yang pertama terbuka diabaikan", async () => {
  const { controller, log, ui } = setupAdmin({ modalAnswers: ["home"] });
  const first = controller.showAccessDenied();
  await controller.showAccessDenied();
  await first;
  assert.equal(ui.modals.length, 1);
  assert.match(flat(ui.modals[0].body), /Hanya admin yang dapat membuka halaman admin\./);
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
  const { controller, store, log } = setupAdmin({ runtime: { toast: { message: "lama", error: "lama" } }, admin: { studioDone: { title: "x" } } });
  const done = await controller.run(async () => {}, "Disimpan.");
  assert.equal(done, true);
  assert.deepEqual(store.get().runtime.toast, { message: "Disimpan.", error: "" });
  assert.equal(store.get().admin.studioDone, null);
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
  assert.match(flat(ui.modals[0].body), /Hanya admin yang dapat mengubah studio\./);
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
  assert.equal(flat(setup.ui.modals[0].body), "<p>Hapus item rekap ini?</p>");
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
  const { controller, api, store, ui } = setupAdmin({ modalAnswers: [true], admin: { customers: [{ id: 3 }], customerDetail: { customer: { id: 3 } }, revenue: {}, operations: {}, studios: [], bookings: [], transactions: {}, sessions: { "1|2026-11": [] } }, responses: { "DELETE /admin/customers/3": { body: { ok: true, photos_deleted: 2 } } } });
  await controller.deleteCustomer({ id: "3", name: "Dewi <i>" });
  assert.equal(ui.modals.length, 1);
  assert.equal(ui.modals[0].title, "Konfirmasi Hapus Akun");
  assert.equal(flat(ui.modals[0].body), "<p>Hapus akun \"Dewi &lt;i&gt;\" beserta SELURUH booking, pembayaran, dan foto miliknya?</p><p>Tindakan ini tidak dapat dibatalkan.</p>");
  assert.deepEqual(ui.modals[0].buttons.map(button => button.label), ["Kembali", "Ya, Hapus Akun"]);
  assert.deepEqual(api.calls.map(call => `${call.method} ${call.path}`), ["DELETE /admin/customers/3"]);
  const admin = store.get().admin;
  assert.deepEqual([admin.customers, admin.customerDetail, admin.revenue, admin.operations, admin.studios, admin.bookings, admin.transactions], [null, null, null, null, null, null, null]);
  assert.deepEqual(admin.sessions, {});
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

// ---------- Paket & Diskon ----------
const packageValues = { name: "Basic", price: "60000", photo_count: "3", dur: "15", strip_size: "2x6", strip_material: "Glossy" };
const packageBody = { name: "Basic", price: 60000, photo_count: 3, dur: 15, strip_size: "2x6", strip_material: "Glossy" };

test("loadPackagesPage: paket dan diskon dimuat sekali", async () => {
  const { controller, api, store } = setupAdmin({ responses: { "GET /admin/packages": { body: [{ id: 1 }] }, "GET /admin/discount": { body: { pct: 0, label: "" } } } });
  await controller.loadPackagesPage();
  await controller.loadPackagesPage();
  assert.equal(api.calls.length, 2);
  assert.deepEqual(store.get().admin.packages, [{ id: 1 }]);
});

test("savePackage: PATCH dengan angka, daftar dimuat ulang, toast harga baru; galat → draf baris itu", async () => {
  let setup = setupAdmin({ admin: { packages: [{ id: 1 }] }, responses: { "PATCH /admin/packages/1": { body: { ok: true } } } });
  await setup.controller.savePackage({ id: "1" }, packageValues);
  assert.deepEqual(setup.api.calls[0], { method: "PATCH", path: "/admin/packages/1", body: packageBody });
  assert.equal(setup.store.get().admin.packages, null);
  assert.equal(setup.store.get().runtime.toast.message, "Paket disimpan. Harga baru berlaku untuk booking berikutnya.");
  setup = setupAdmin({ admin: { packages: [{ id: 1 }] }, responses: { "PATCH /admin/packages/1": { status: 400, body: { error: "Harga tidak valid" } } } });
  await setup.controller.savePackage({ id: "1" }, packageValues);
  assert.deepEqual(setup.store.get().admin.drafts["package-1"], packageValues);
  assert.equal(setup.store.get().runtime.toast.error, "Harga tidak valid");
});

test("addPackage: POST, toast Paket baru ditambahkan., draf baris baru dibuang", async () => {
  const { controller, api, store } = setupAdmin({ admin: { packages: [], drafts: { "package-new": { name: "x" } } }, responses: { "POST /admin/packages": { body: { id: 5 } } } });
  await controller.addPackage(packageValues);
  assert.deepEqual(api.calls[0], { method: "POST", path: "/admin/packages", body: packageBody });
  assert.equal(store.get().admin.drafts["package-new"], undefined);
  assert.equal(store.get().runtime.toast.message, "Paket baru ditambahkan.");
});

test("activatePackage: PATCH active true, toast Paket diaktifkan.", async () => {
  const { controller, api, store } = setupAdmin({ admin: { packages: [] }, responses: { "PATCH /admin/packages/3": { body: { ok: true } } } });
  await controller.activatePackage({ id: "3" });
  assert.deepEqual(api.calls[0].body, { active: true });
  assert.equal(store.get().runtime.toast.message, "Paket diaktifkan.");
});

test("deletePackage: modal Konfirmasi Hapus Paket; dinonaktifkan atau dihapus sesuai jawaban server; Kembali → tanpa permintaan", async () => {
  let setup = setupAdmin({ modalAnswers: [true], admin: { packages: [] }, responses: { "DELETE /admin/packages/1": { body: { deactivated: true } } } });
  await setup.controller.deletePackage({ id: "1" });
  assert.equal(setup.ui.modals[0].title, "Konfirmasi Hapus Paket");
  assert.equal(flat(setup.ui.modals[0].body), "<p>Hapus paket ini? (Jika pernah dibeli, paket hanya dinonaktifkan.)</p>");
  assert.equal(setup.store.get().runtime.toast.message, "Paket pernah dibeli, jadi dinonaktifkan (riwayat tetap utuh).");
  setup = setupAdmin({ modalAnswers: [true], admin: { packages: [] }, responses: { "DELETE /admin/packages/1": { body: { ok: true } } } });
  await setup.controller.deletePackage({ id: "1" });
  assert.equal(setup.store.get().runtime.toast.message, "Paket dihapus.");
  setup = setupAdmin({ modalAnswers: [false] });
  await setup.controller.deletePackage({ id: "1" });
  assert.equal(setup.api.calls.length, 0);
});

test("saveDiscount: PUT persen angka + label, diskon dimuat ulang, toast", async () => {
  const { controller, api, store } = setupAdmin({ admin: { discount: { pct: 0, label: "" } }, responses: { "PUT /admin/discount": { body: { ok: true } } } });
  await controller.saveDiscount({ pct: "15", label: "Akhir Tahun" });
  assert.deepEqual(api.calls[0].body, { pct: 15, label: "Akhir Tahun" });
  assert.equal(store.get().admin.discount, null);
  assert.equal(store.get().runtime.toast.message, "Diskon utama disimpan.");
});

// ---------- Akun Admin ----------
const accountValues = { username: "admin2", current_password: "Lama1234", new_password: "Baru1234", new_password_repeat: "Baru1234" };

test("saveAccount: pengulangan berbeda → toast galat tanpa permintaan, username tetap (draf tanpa password)", async () => {
  const { controller, api, store, log } = setupAdmin();
  await controller.saveAccount({ ...accountValues, new_password_repeat: "Lain1234" });
  assert.equal(api.calls.length, 0);
  assert.deepEqual(store.get().runtime.toast, { message: "", error: "Pengulangan password baru tidak sama." });
  assert.deepEqual(store.get().admin.drafts.account, { username: "admin2" });
  assert.deepEqual(log, ["render"]);
});

test("saveAccount: must_change tanpa password baru → toast Password baru wajib diisi.", async () => {
  const { controller, api, store } = setupAdmin({ admin: { me: { username: "admin", must_change: true } } });
  await controller.saveAccount({ ...accountValues, new_password: "", new_password_repeat: "" });
  assert.equal(api.calls.length, 0);
  assert.equal(store.get().runtime.toast.error, "Password baru wajib diisi.");
});

test("saveAccount: berhasil → token baru disimpan, must_change dilepas, toast", async () => {
  const { controller, api, store } = setupAdmin({ admin: { me: { username: "admin", must_change: true }, drafts: { account: { username: "x" } } }, responses: { "PATCH /admin/account": { body: { token: "baru", username: "admin2" } } } });
  await controller.saveAccount(accountValues);
  assert.deepEqual(api.calls[0].body, { current_password: "Lama1234", username: "admin2", new_password: "Baru1234" });
  assert.equal(api.token, "baru");
  assert.deepEqual(store.get().admin.me, { username: "admin2", must_change: false });
  assert.equal(store.get().admin.drafts.account, undefined);
  assert.equal(store.get().runtime.toast.message, "Akun admin diperbarui.");
});

test("saveAccount: 403 Password saat ini salah → toast galat, admin tetap masuk, username tetap", async () => {
  const { controller, api, store, log } = setupAdmin({ responses: { "PATCH /admin/account": { status: 403, body: { error: "Password saat ini salah" } } } });
  await controller.saveAccount(accountValues);
  assert.equal(api.token, "lama");
  assert.equal(store.get().runtime.toast.error, "Password saat ini salah");
  assert.ok(!log.includes("logout"));
  assert.deepEqual(store.get().admin.drafts.account, { username: "admin2" });
});

// ---------- Properti dan Pose (fase 8b) ----------
import * as masterModel from "../../js/models/master.js";
import { flat } from "../helpers/markup.js";

function setupCatalog({ responses = {}, modalAnswers = [], admin = {}, readImage = async file => "data:" + file.name } = {}) {
  const store = createStore({ ...sampleState({ persisted: { admin: true }, runtime: { accessDeniedOpen: false } }), admin: { ...createAdminState(), me: { username: "admin", must_change: false }, ...admin } }, { storage: createFakeStorage(), persistKey: "snapia" });
  const api = createFakeApi({ "GET /master": { body: { PKG: [], ALLPKG: [], DISC: { pct: 0, label: "" }, PEOPLE: [], BUDGET: [], STUDIOS: [], PROP: [{ id: 9, name: "Baru" }], POSES: {}, POLICY: {} } }, ...responses });
  const ui = createFakeUi({ modalAnswers });
  const controller = createAdminController({ api, store, ui, router: { navigate: () => {} }, models: { admin: adminModels, master: masterModel }, logout: () => {}, files: { readImage } });
  return { store, api, ui, controller, requests: () => api.calls.map(call => `${call.method} ${call.path}`), admin: () => store.get().admin, toast: () => store.get().runtime.toast };
}

test("properti: muat sekali ke admin.properties", async () => {
  const { controller, admin, requests } = setupCatalog({ responses: { "GET /admin/properties": { body: [{ id: 4 }] } } });
  await controller.loadProperties();
  await controller.loadProperties();
  assert.deepEqual(requests(), ["GET /admin/properties"]);
  assert.deepEqual(admin().properties, [{ id: 4 }]);
});

test("properti: simpan baris (PATCH + gambar baru), daftar dan properti master dimuat ulang; tambah = POST; gagal → draf baris", async () => {
  const { controller, api, requests, admin, toast, store } = setupCatalog({ admin: { properties: [], images: { "property-4": "/media/t.jpg" }, drafts: { "property-4": { name: "lama" } } }, responses: { "PATCH /admin/properties/4": { body: {} }, "POST /admin/properties": { body: {} } } });
  await controller.saveProperty({ id: "4" }, { name: "Topi", category: "Topi", qty: "3" });
  assert.deepEqual(api.calls[0].body, { name: "Topi", category: "Topi", qty: 3, img: "/media/t.jpg" });
  assert.deepEqual(requests(), ["PATCH /admin/properties/4", "GET /master"]);
  assert.equal(toast().message, "Properti disimpan.");
  assert.deepEqual([admin().properties, admin().images, admin().drafts], [null, {}, {}]);
  assert.deepEqual(store.get().master.properties, [{ id: 9, name: "Baru" }]);
  await controller.addProperty({ name: "Rompi", category: "Rompi", qty: "1" });
  assert.equal(requests()[2], "POST /admin/properties");
  const failed = setupCatalog({ admin: { properties: [] }, responses: { "POST /admin/properties": { status: 400, body: { error: "Nama properti wajib diisi" } } } });
  await failed.controller.addProperty({ name: "", category: "Topi", qty: "1" });
  assert.equal(failed.toast().error, "Nama properti wajib diisi");
  assert.deepEqual(failed.admin().drafts["property-new"], { name: "", category: "Topi", qty: "1" });
});

test("properti: unggah foto → isian baris jadi draf, gambar di admin.images, toast Klik Simpan; gagal → toast galat", async () => {
  const { controller, admin, toast, api } = setupCatalog({ admin: { properties: [] }, responses: { "POST /admin/media": { body: { url: "/media/p.jpg" } } } });
  await controller.uploadPropertyImage({ key: "4" }, { name: "p.png" }, { name: "Ketikan" });
  assert.deepEqual(api.calls[0].body, { data: "data:p.png" });
  assert.equal(admin().images["property-4"], "/media/p.jpg");
  assert.deepEqual(admin().drafts["property-4"], { name: "Ketikan" });
  assert.equal(toast().message, "Gambar diunggah. Klik Simpan untuk menerapkan.");
  await controller.uploadPropertyImage({ key: "new" }, null, {});
  assert.equal(api.calls.length, 1);
  const broken = setupCatalog({ readImage: async () => { throw new Error("File bukan gambar"); } });
  await broken.controller.uploadPropertyImage({ key: "new" }, { name: "x" }, {});
  assert.equal(broken.toast().error, "File bukan gambar");
});

test("properti: hapus lewat modal Konfirmasi Hapus Properti; Kembali → tanpa permintaan", async () => {
  const { controller, ui, requests, toast } = setupCatalog({ modalAnswers: [false, true], admin: { properties: [] }, responses: { "DELETE /admin/properties/4": { body: {} } } });
  await controller.deleteProperty({ id: "4" });
  assert.deepEqual(requests(), []);
  await controller.deleteProperty({ id: "4" });
  assert.equal(ui.modals[0].title, "Konfirmasi Hapus Properti");
  assert.match(flat(ui.modals[0].body), /<p>Hapus properti ini\?<\/p>/);
  assert.deepEqual(ui.modals[0].buttons.map(button => button.label), ["Kembali", "Ya, Hapus Properti"]);
  assert.deepEqual(requests(), ["DELETE /admin/properties/4", "GET /master"]);
  assert.equal(toast().message, "Properti dihapus.");
});

test("pose: muat, simpan (PATCH + foto baru), daftar dan pose master dimuat ulang; tambah tanpa foto gagal → draf; hapus lewat modal Konfirmasi Hapus Pose", async () => {
  const { controller, api, requests, admin, toast, ui, store } = setupCatalog({ modalAnswers: [true], admin: { images: { "pose-6": "/media/p.jpg" } }, responses: { "GET /admin/poses": { body: [{ id: 6 }] }, "PATCH /admin/poses/6": { body: {} }, "POST /admin/poses": { status: 400, body: { error: "Foto pose wajib diunggah" } }, "DELETE /admin/poses/6": { body: {} } } });
  store.update("master", { poses: { 1: ["/img/lama.jpg"] } }, { silent: true });
  await controller.loadPoses();
  await controller.savePose({ id: "6" }, { people_range_id: "2" });
  assert.deepEqual(api.calls[1].body, { people_range_id: 2, img: "/media/p.jpg" });
  assert.equal(toast().message, "Pose disimpan.");
  assert.deepEqual([admin().poses, admin().images], [null, {}]);
  assert.deepEqual(store.get().master.poses, {});
  await controller.addPose({ people_range_id: "1" });
  assert.deepEqual(api.calls[3].body, { people_range_id: 1 });
  assert.equal(toast().error, "Foto pose wajib diunggah");
  assert.deepEqual(admin().drafts["pose-new"], { people_range_id: "1" });
  await controller.deletePose({ id: "6" });
  assert.equal(ui.modals[0].title, "Konfirmasi Hapus Pose");
  assert.match(flat(ui.modals[0].body), /Hapus pose ini\?/);
  assert.deepEqual(requests(), ["GET /admin/poses", "PATCH /admin/poses/6", "GET /master", "POST /admin/poses", "DELETE /admin/poses/6", "GET /master"]);
  assert.equal(toast().message, "Pose dihapus.");
});

test("pose: unggah foto → isian baris jadi draf, foto di admin.images[\"pose-<key>\"], toast Klik Simpan; tanpa berkas → tanpa permintaan", async () => {
  const { controller, admin, toast, api } = setupCatalog({ responses: { "POST /admin/media": { body: { url: "/media/q.jpg" } } } });
  await controller.uploadPoseImage({ key: "new" }, { name: "q.png" }, { people_range_id: "3" });
  assert.deepEqual(api.calls[0].body, { data: "data:q.png" });
  assert.equal(admin().images["pose-new"], "/media/q.jpg");
  assert.deepEqual(admin().drafts["pose-new"], { people_range_id: "3" });
  assert.equal(toast().message, "Gambar diunggah. Klik Simpan untuk menerapkan.");
  await controller.uploadPoseImage({ key: "6" }, null, {});
  assert.equal(api.calls.length, 1);
});

test("run: aksi yang dibatalkan (CANCELLED) → tanpa render dan tanpa toast, fokus tetap di tombol pembuka dialog", async () => {
  const { CANCELLED } = await import("../../js/controllers/AdminController.js");
  const { controller, log, store } = setupAdmin({ runtime: { toast: { message: "lama", error: "" } } });
  const result = await controller.run(async () => CANCELLED, "Tidak tampil");
  assert.equal(result, false);
  assert.ok(!log.includes("render"));
  assert.notEqual(store.get().runtime.toast.message, "Tidak tampil");
});
