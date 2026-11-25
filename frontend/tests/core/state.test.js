import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../../js/core/state.js";

// isi awal sama dengan objek lama di js/legacy/state.js (S, M, BK, R, D), kini satu fungsi per slice store
test("createInitialState: slice persisted, master, booking, runtime, data dengan isi awal lama", () => {
  const state = createInitialState();
  assert.deepEqual(Object.keys(state).sort(), ["booking", "data", "master", "persisted", "runtime"]);
  assert.deepEqual(state.persisted, { user: null, me: null, admin: false, pkg: null, bm: [], staff: false, log: [] });
  assert.deepEqual(state.master, { packages: [], allPackages: [], favouritePackageId: null, discount: { pct: 0, label: "" }, peopleRanges: [], budgetRanges: [], studios: [], allStudios: [], properties: [], poses: {}, policy: { refund_hours: 2 }, json: "" });
  assert.deepEqual(state.booking, { studio: null, date: null, slot: null, quote: null, rescheduleId: null });
  assert.deepEqual(state.data, { bookings: [], sessions: [] });
  assert.deepEqual(state.runtime, {
    route: { name: "landing", path: "/", params: {}, query: {}, title: "", tab: null },
    toast: { message: "", error: "" },
    availability: {},
    calendar: {},
    cancel: { reason: "", detail: "" },
    auth: { mode: "login", resetToken: "" },
    contact: { n: "", e: "", m: "", ok: "", err: "", busy: false },
    accessDeniedOpen: false,
  });
});

test("createInitialState: setiap panggilan memberi objek baru (tidak berbagi rujukan)", () => {
  const first = createInitialState();
  const second = createInitialState();
  first.persisted.bm.push(3);
  first.runtime.toast.message = "x";
  assert.deepEqual(second.persisted.bm, []);
  assert.equal(second.runtime.toast.message, "");
});
