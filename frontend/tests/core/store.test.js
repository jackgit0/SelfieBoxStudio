import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, migrateSaved } from "../../js/core/store.js";
import { createFakeStorage } from "../helpers/fakeStorage.js";

const initial = () => ({ persisted: { user: null, pkg: null, bm: [] }, runtime: { toast: { message: "" } }, data: { bookings: [] } });

test("set dan update memberi tahu pelanggan sekali per panggilan", () => {
  const store = createStore(initial());
  const seen = [];
  store.subscribe(state => seen.push(state.runtime.toast));
  store.set({ data: { bookings: [1] } });
  store.update("runtime", { toast: { message: "Tersimpan" } });
  assert.equal(seen.length, 2);
  assert.deepEqual(store.get().data.bookings, [1]);
  assert.equal(store.get().runtime.toast.message, "Tersimpan");
});

test("update dengan silent tidak memberi tahu pelanggan", () => {
  const store = createStore(initial());
  let calls = 0;
  store.subscribe(() => calls++);
  store.update("runtime", { draft: "ketik" }, { silent: true });
  assert.equal(calls, 0);
  assert.equal(store.get().runtime.draft, "ketik");
});

test("unsubscribe menghentikan pemberitahuan", () => {
  const store = createStore(initial());
  let calls = 0;
  const unsubscribe = store.subscribe(() => calls++);
  unsubscribe();
  store.update("runtime", { x: 1 });
  assert.equal(calls, 0);
});

test("update menggabungkan ke objek slice yang sama (rujukan lama tetap berlaku)", () => {
  const start = initial();
  const runtime = start.runtime;
  const store = createStore(start);
  store.update("runtime", { x: 1 });
  assert.equal(store.get().runtime, runtime);
  assert.equal(runtime.x, 1);
});

test("hanya slice persisted yang disimpan ke persistKey", () => {
  const storage = createFakeStorage();
  const store = createStore(initial(), { storage, persistKey: "snapia" });
  store.update("persisted", { pkg: 2 });
  store.update("runtime", { toast: { message: "tidak disimpan" } });
  assert.deepEqual(JSON.parse(storage.getItem("snapia")), { user: null, pkg: 2, bm: [] });
  assert.equal(storage.length, 1);
});

test("perubahan slice lain tidak menulis ke storage", () => {
  const storage = createFakeStorage();
  const store = createStore(initial(), { storage, persistKey: "snapia" });
  store.update("data", { bookings: [2] });
  assert.equal(storage.getItem("snapia"), null);
  store.persist();
  assert.deepEqual(JSON.parse(storage.getItem("snapia")).bm, []);
});

test("state tersimpan dimuat ke objek persisted awal (rujukannya tetap sama)", () => {
  const start = initial();
  const persisted = start.persisted;
  const storage = createFakeStorage({ snapia: JSON.stringify({ user: { id: 3 }, pkg: 4 }) });
  const store = createStore(start, { storage, persistKey: "snapia" });
  assert.equal(store.get().persisted, persisted);
  assert.deepEqual(persisted, { user: { id: 3 }, pkg: 4, bm: [] });
});

test("state awal tidak punya quiz/setup, dan state lama dibersihkan saat dimuat", () => {
  const saved = { user: { id: 1 }, quiz: { step: 2 }, setup: { acc: [1] }, bookings: [], sessions: [], acct: "pref", pkg: 3 };
  const storage = createFakeStorage({ snapia: JSON.stringify(saved) });
  const store = createStore(initial(), { storage, persistKey: "snapia" });
  const persisted = store.get().persisted;
  for (const key of ["quiz", "setup", "bookings", "sessions"]) assert.equal(key in persisted, false, key);
  assert.equal(persisted.acct, "profile");
  assert.equal(persisted.pkg, 3);
  assert.deepEqual(persisted.user, { id: 1 });
  store.persist();
  const written = JSON.parse(storage.getItem("snapia"));
  for (const key of ["quiz", "setup", "bookings", "sessions"]) assert.equal(key in written, false, key);
});

test("acct selain pref tidak diubah", () => {
  assert.equal(migrateSaved({ acct: "pay" }).acct, "pay");
});

test("isi storage rusak, null, atau bukan objek diabaikan", () => {
  for (const value of ["{rusak", "null", "[1,2]", "5"]) {
    const store = createStore(initial(), { storage: createFakeStorage({ snapia: value }), persistKey: "snapia" });
    assert.deepEqual(store.get().persisted, { user: null, pkg: null, bm: [] }, value);
  }
});

test("storage yang melempar galat tidak menghentikan store", () => {
  const storage = { getItem() { throw new Error("diblokir"); }, setItem() { throw new Error("penuh"); } };
  const store = createStore(initial(), { storage, persistKey: "snapia" });
  store.update("persisted", { pkg: 2 });
  assert.equal(store.get().persisted.pkg, 2);
});

test("view dan p dari state lama dibuang saat dimuat (halaman aktif kini dari URL, refactor fase 3)", () => {
  const storage = createFakeStorage({ snapia: JSON.stringify({ user: { id: 1 }, view: "my", p: { id: 4 }, bm: [2] }) });
  const store = createStore(initial(), { storage, persistKey: "snapia" });
  assert.equal("view" in store.get().persisted, false);
  assert.equal("p" in store.get().persisted, false);
  assert.deepEqual(store.get().persisted.bm, [2]);
  store.persist();
  assert.equal(JSON.parse(storage.getItem("snapia")).view, undefined);
});

// ---------- booking berjalan per tab di sessionStorage (decisions.md 26, refactor fase 3) ----------

const bookingInitial = () => ({ persisted: { pkg: null }, booking: { studio: null, date: null, slot: null, quote: null, rescheduleId: null }, runtime: {} });
const sessionOption = storage => ({ session: { storage, key: "snapia_booking", slices: { booking: ["studio", "date", "slot", "rescheduleId"] } } });

test("slice booking ditulis ke session storage tanpa quote", () => {
  const session = createFakeStorage();
  const store = createStore(bookingInitial(), sessionOption(session));
  store.update("booking", { studio: 2, date: "2026-12-01", slot: "2026-12-01 10:00", quote: { total: 90000 } });
  assert.deepEqual(JSON.parse(session.getItem("snapia_booking")), { booking: { studio: 2, date: "2026-12-01", slot: "2026-12-01 10:00" } });
});

test("store baru memulihkan booking dari session storage ke objek slice yang sama; quote tidak ikut", () => {
  const session = createFakeStorage({ snapia_booking: JSON.stringify({ booking: { studio: 3, date: "2026-12-02", slot: "2026-12-02 09:00", rescheduleId: 7, quote: { total: 1 } } }) });
  const start = bookingInitial();
  const booking = start.booking;
  const store = createStore(start, sessionOption(session));
  assert.equal(store.get().booking, booking);
  assert.deepEqual(booking, { studio: 3, date: "2026-12-02", slot: "2026-12-02 09:00", quote: null, rescheduleId: 7 });
});

test("booking yang dikosongkan menghapus kuncinya dari session storage", () => {
  const session = createFakeStorage();
  const store = createStore(bookingInitial(), sessionOption(session));
  store.update("booking", { studio: 2, date: "2026-12-01" });
  assert.notEqual(session.getItem("snapia_booking"), null);
  store.update("booking", { studio: null, date: null, slot: null, rescheduleId: null });
  assert.equal(session.getItem("snapia_booking"), null);
});

test("persist() dan persistSession() juga menyimpan booking yang diubah langsung oleh kode lama", () => {
  const session = createFakeStorage();
  const local = createFakeStorage();
  const start = bookingInitial();
  const store = createStore(start, { storage: local, persistKey: "snapia", ...sessionOption(session) });
  start.booking.studio = 4; // kode lama: BK.studio = 4 tanpa store.update
  store.persistSession();
  assert.equal(JSON.parse(session.getItem("snapia_booking")).booking.studio, 4);
  start.booking.studio = null;
  store.persist();
  assert.equal(session.getItem("snapia_booking"), null);
  assert.equal(local.getItem("snapia_booking"), null); // booking tidak pernah masuk localStorage
});

test("isi session storage rusak atau storage yang melempar galat diabaikan", () => {
  const broken = createStore(bookingInitial(), sessionOption(createFakeStorage({ snapia_booking: "{rusak" })));
  assert.equal(broken.get().booking.studio, null);
  const throwing = { getItem() { throw new Error("diblokir"); }, setItem() { throw new Error("penuh"); }, removeItem() { throw new Error("diblokir"); } };
  const store = createStore(bookingInitial(), sessionOption(throwing));
  store.update("booking", { studio: 1 });
  assert.equal(store.get().booking.studio, 1);
});
