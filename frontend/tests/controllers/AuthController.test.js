import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../js/core/store.js";
import { createAuthController } from "../../js/controllers/AuthController.js";
import { createBookingController } from "../../js/controllers/BookingController.js";
import { createPackageController } from "../../js/controllers/PackageController.js";
import * as authModel from "../../js/models/auth.js";
import * as bookingModel from "../../js/models/booking.js";
import * as photoSessionModel from "../../js/models/photoSession.js";
import { createFakeApi } from "../helpers/fakeApi.js";
import { createFakeStorage } from "../helpers/fakeStorage.js";
import { createFakeUi } from "../helpers/fakeUi.js";
import { sampleState } from "../helpers/fixtures.js";

const user = { id: 5, name: "Dewi", email: "d@x.id", phone: "0812345678" };
const mine = { "GET /bookings": { body: [{ id: 41 }] }, "GET /sessions": { body: [] } };

function setup({ persisted = {}, booking = {}, runtime = {}, admin = {}, responses = {}, modalAnswers = [], token = "" } = {}) {
  const state = sampleState({ persisted, booking, runtime: { auth: { mode: "login", resetToken: "" }, cancel: { reason: "", detail: "" }, ...runtime } });
  state.data = { bookings: [{ id: 1 }], sessions: [{ id: 2 }] };
  state.admin = { me: null, studios: [{ id: 1 }], ...admin };
  const storage = createFakeStorage();
  const sessionStorage = createFakeStorage();
  const store = createStore(state, { storage, persistKey: "snapia", session: { storage: sessionStorage, key: "snapia_booking", slices: { booking: ["studio", "date", "slot", "rescheduleId"] } } });
  const api = createFakeApi(responses);
  api.token = token;
  api.staffToken = "";
  api.imageUrl = id => `/img/${id}`;
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
  const packages = createPackageController({ store, ui, router, config: { wa: "", email: "" }, refreshMaster });
  const bookingController = createBookingController({ api, store, ui, router, models: { booking: bookingModel, photoSession: photoSessionModel }, packages, refreshMaster });
  let adminResets = 0;
  let denials = 0;
  const controller = createAuthController({ api, store, ui, router, models: { auth: authModel }, booking: bookingController, resetAdmin: () => adminResets++, accessDenied: () => denials++ });
  return { store, api, ui, log, controller, storage, sessionStorage, adminResets: () => adminResets, denials: () => denials };
}

const paths = api => api.calls.map(call => `${call.method} ${call.path}`);

test("login dengan \"@\" = customer: POST /auth/login, token, data user dimuat, ke /browse", async () => {
  const { store, api, log, controller } = setup({ responses: { "POST /auth/login": { body: { token: "jwt", user } }, ...mine } });
  await controller.login({ identifier: " d@x.id ", password: "secret1" });
  assert.deepEqual(api.calls[0], { method: "POST", path: "/auth/login", body: { email: "d@x.id", password: "secret1" } });
  assert.deepEqual(paths(api).slice(1), ["GET /bookings", "GET /sessions"]);
  assert.equal(api.token, "jwt");
  assert.deepEqual([store.get().persisted.me, store.get().persisted.user, store.get().persisted.admin], [5, user, false]);
  assert.deepEqual(store.get().data.bookings, [{ id: 41 }]);
  assert.deepEqual(log, ["navigate:/browse"]);
});

test("login tanpa \"@\" = username admin: POST /admin/login, slice admin, ke /admin (password bawaan → /admin/account)", async () => {
  for (const [mustChange, path] of [[false, "/admin"], [true, "/admin/account"]]) {
    const { store, api, log, controller } = setup({ persisted: { draft: { studio: 1 } }, responses: { "POST /admin/login": { body: { token: "adm", admin: { username: "adminstudio", must_change: mustChange } } } } });
    await controller.login({ identifier: "adminstudio", password: "rahasia" });
    assert.deepEqual(api.calls, [{ method: "POST", path: "/admin/login", body: { username: "adminstudio", password: "rahasia" } }]);
    assert.equal(api.token, "adm");
    const { persisted, admin } = store.get();
    assert.deepEqual([persisted.admin, persisted.me, persisted.user, persisted.draft], [true, "admin", { name: "Admin", id: 0 }, null]);
    assert.equal(admin.me.username, "adminstudio");
    assert.deepEqual(log, [`navigate:${path}`]);
  }
});

test("login: isian kosong → toast tanpa permintaan; 401 → Email/username atau password salah, isian email tetap ada", async () => {
  const empty = setup();
  await empty.controller.login({ identifier: "  ", password: "x" });
  assert.equal(empty.store.get().runtime.toast.error, "Isi email/username dan password.");
  assert.deepEqual(empty.api.calls, []);
  const wrong = setup({ responses: { "POST /auth/login": { status: 401, body: { error: "Email atau password salah" } } } });
  await wrong.controller.login({ identifier: "d@x.id", password: "salah" });
  assert.deepEqual(wrong.store.get().runtime.toast, { message: "", error: "Email/username atau password salah" });
  assert.deepEqual(wrong.store.get().runtime.auth.form, { mode: "login", values: { identifier: "d@x.id" } });
  assert.deepEqual(wrong.log, ["render"]);
  const other = setup({ responses: { "POST /admin/login": { status: 429, body: { error: "Terlalu banyak percobaan" } } } });
  await other.controller.login({ identifier: "adminstudio", password: "x" });
  assert.equal(other.store.get().runtime.toast.error, "Terlalu banyak percobaan");
});

test("login dengan draf booking tersimpan: resumeDraft → quote lalu /book/pay (dulu test-imk: afterAuth … S.draft)", async () => {
  const draft = { studio: 1, date: "2026-11-27", slot: "2026-11-27 10:00" };
  const { store, api, log, controller } = setup({ persisted: { draft, pkg: 1 }, responses: { "POST /auth/login": { body: { token: "jwt", user } }, ...mine, "POST /quote": { body: { total: 50000 } } } });
  await controller.login({ identifier: "d@x.id", password: "secret1" });
  assert.deepEqual(paths(api), ["POST /auth/login", "GET /bookings", "GET /sessions", "POST /quote"]);
  assert.deepEqual(log, ["navigate:/book/pay"]);
  assert.equal(store.get().persisted.draft, null);
  assert.deepEqual([store.get().booking.studio, store.get().booking.slot, store.get().booking.quote], [1, "2026-11-27 10:00", { total: 50000 }]);
});

test("register: data tidak valid → pesan tanpa permintaan; valid → POST /auth/register lalu /browse", async () => {
  const invalid = setup();
  await invalid.controller.register({ name: "Dewi", phone: "12", email: "d@x.id", password: "secret1" });
  assert.equal(invalid.store.get().runtime.toast.error, "Lengkapi data: email valid, telepon 8-15 digit, password min. 6 karakter.");
  assert.deepEqual(invalid.store.get().runtime.auth.form, { mode: "register", values: { name: "Dewi", phone: "12", email: "d@x.id" } });
  assert.deepEqual(invalid.api.calls, []);
  const valid = setup({ responses: { "POST /auth/register": { body: { token: "jwt", user } }, ...mine } });
  await valid.controller.register({ name: " Dewi ", phone: "0812345678", email: "d@x.id ", password: "secret1" });
  assert.deepEqual(valid.api.calls[0].body, { name: "Dewi", email: "d@x.id", phone: "0812345678", password: "secret1" });
  assert.deepEqual(valid.log, ["navigate:/browse"]);
  assert.equal(valid.store.get().runtime.auth.form, null);
});

test("forgot: email tidak valid → pesan; valid → ke /login dengan pesan dari server", async () => {
  const invalid = setup();
  await invalid.controller.forgot({ email: "bukan-email" });
  assert.equal(invalid.store.get().runtime.toast.error, "Masukkan email yang valid.");
  const valid = setup({ responses: { "POST /auth/forgot": { body: { message: "Jika email terdaftar, tautan sudah dikirim." } } } });
  await valid.controller.forgot({ email: "d@x.id" });
  assert.deepEqual(valid.log, ["navigate:/login", "render"]);
  assert.deepEqual(valid.store.get().runtime.toast, { message: "Jika email terdaftar, tautan sudah dikirim.", error: "" });
});

test("reset: password pendek / tidak sama → pesan; valid → POST token + password, token dibuang, ke /login dengan pesan", async () => {
  const token = "b".repeat(64);
  const invalid = setup({ runtime: { auth: { mode: "reset", resetToken: token } } });
  await invalid.controller.reset({ password: "baru123", confirmation: "baru124" });
  assert.equal(invalid.store.get().runtime.toast.error, "Password min. 6 karakter dan kedua isian harus sama.");
  const valid = setup({ runtime: { auth: { mode: "reset", resetToken: token } }, responses: { "POST /auth/reset": { body: { ok: true } } } });
  await valid.controller.reset({ password: "baru123", confirmation: "baru123" });
  assert.deepEqual(valid.api.calls, [{ method: "POST", path: "/auth/reset", body: { token, password: "baru123" } }]);
  assert.equal(valid.store.get().runtime.auth.resetToken, "");
  assert.deepEqual(valid.log, ["navigate:/login", "render"]);
  assert.equal(valid.store.get().runtime.toast.message, "Sandi berhasil diubah. Silakan masuk dengan sandi baru.");
});

test("logout: token dan token staf dibuang, slice user/admin/draf/data/booking berjalan dikosongkan, state admin direset, ke /", () => {
  const { store, api, log, sessionStorage, controller, adminResets } = setup({ token: "jwt", persisted: { me: 5, user, staff: true, draft: { studio: 1 } }, booking: { studio: 1, date: "2026-11-27", slot: "2026-11-27 10:00" } });
  api.staffToken = "staf";
  store.persistSession();
  controller.logout();
  assert.deepEqual([api.token, api.staffToken], ["", ""]);
  const { persisted, data, booking, runtime } = store.get();
  assert.deepEqual([persisted.user, persisted.me, persisted.staff, persisted.admin, persisted.draft], [null, null, false, false, null]);
  assert.deepEqual(data, { bookings: [], sessions: [] });
  assert.deepEqual(booking, { studio: null, date: null, slot: null, quote: null, rescheduleId: null });
  assert.equal(runtime.auth.mode, "login");
  assert.equal(adminResets(), 1);
  assert.deepEqual(log, ["navigate:/"]);
  store.persistSession();
  assert.equal(sessionStorage.getItem("snapia_booking"), null);
});

test("toggleStaff: modal PIN; ditutup → tidak ada apa-apa; PIN benar → Mode Staf aktif; salah → toast; aktif → nonaktif tanpa modal", async () => {
  const closed = setup({ persisted: { me: 5, user }, modalAnswers: [{ value: null, data: "" }] });
  await closed.controller.toggleStaff();
  assert.deepEqual(closed.log, ["modal:Masuk Mode Staf"]);
  assert.deepEqual(closed.api.calls, []);
  const right = setup({ persisted: { me: 5, user }, modalAnswers: [{ value: "ok", data: "1234" }], responses: { "POST /staff/login": { body: { token: "staf" } } } });
  await right.controller.toggleStaff();
  assert.deepEqual(right.api.calls, [{ method: "POST", path: "/staff/login", body: { pin: "1234" } }]);
  assert.equal(right.api.staffToken, "staf");
  assert.equal(right.store.get().persisted.staff, true);
  assert.deepEqual(right.log, ["modal:Masuk Mode Staf", "render"]);
  const wrong = setup({ persisted: { me: 5, user }, modalAnswers: [{ value: "ok", data: "9" }], responses: { "POST /staff/login": { status: 401, body: { error: "PIN staf salah" } } } });
  await wrong.controller.toggleStaff();
  assert.equal(wrong.store.get().runtime.toast.error, "PIN staf salah");
  assert.equal(wrong.store.get().persisted.staff, false);
  const off = setup({ persisted: { me: 5, user, staff: true } });
  off.api.staffToken = "staf";
  await off.controller.toggleStaff();
  assert.deepEqual([off.store.get().persisted.staff, off.api.staffToken], [false, ""]);
  assert.deepEqual(off.log, ["render"]);
});

test("restoreSession customer: Mode Staf tidak dipulihkan, data user dimuat, render diminta", async () => {
  const { store, api, controller } = setup({ token: "jwt", persisted: { user, staff: true }, responses: mine });
  assert.equal(await controller.restoreSession(), true);
  assert.deepEqual(paths(api), ["GET /bookings", "GET /sessions"]);
  assert.deepEqual([store.get().persisted.me, store.get().persisted.staff], [5, false]);
});

test("restoreSession admin: GET /admin/me ke slice admin", async () => {
  const { store, controller } = setup({ token: "adm", persisted: { user: { name: "Admin", id: 0 }, admin: true }, responses: { "GET /admin/me": { body: { username: "adminstudio", must_change: false } } } });
  assert.equal(await controller.restoreSession(), true);
  assert.equal(store.get().persisted.me, "admin");
  assert.equal(store.get().admin.me.username, "adminstudio");
});

test("restoreSession admin dengan /admin/me 403 \"Hanya admin\" → Akses Ditolak (dulu test-imk: main.js memanggil aDenied)", async () => {
  const { controller, denials, adminResets, log } = setup({ token: "pelanggan", persisted: { user: { name: "Admin", id: 0 }, admin: true }, responses: { "GET /admin/me": { status: 403, body: { error: "Hanya admin" } } } });
  assert.equal(await controller.restoreSession(), false);
  assert.equal(denials(), 1);
  assert.equal(adminResets(), 0);
  assert.deepEqual(log, []);
});

test("restoreSession: galat lain → logout; tanpa token → tidak masuk", async () => {
  const failed = setup({ token: "lama", persisted: { user }, responses: { "GET /bookings": { status: 401, body: { error: "Token tidak valid" } } } });
  assert.equal(await failed.controller.restoreSession(), false);
  assert.equal(failed.api.token, "");
  assert.equal(failed.store.get().persisted.user, null);
  assert.deepEqual(failed.log, ["navigate:/"]);
  const guest = setup({ persisted: { user, me: 5 } });
  assert.equal(await guest.controller.restoreSession(), true);
  assert.equal(guest.store.get().persisted.me, null);
  assert.deepEqual(guest.api.calls, []);
});
