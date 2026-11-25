import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../js/core/store.js";
import { createInitialState } from "../../js/core/state.js";
import { createNavigator } from "../../js/core/navigation.js";
import { createFakeStorage } from "../helpers/fakeStorage.js";

// navigate(path) = goPath() lama: toast dan cache slot dibersihkan, state disimpan, gulir ke atas, lalu router.navigate
test("navigate: bersihkan toast + cache ketersediaan, simpan state, gulir ke atas, lalu pindah rute", () => {
  const storage = createFakeStorage();
  const store = createStore(createInitialState(), { storage, persistKey: "snapia" });
  const log = [];
  store.subscribe(() => log.push("render"));
  store.update("runtime", { toast: { message: "Tersimpan", error: "Gagal" }, availability: { "1|2026-12-01": [8] } }, { silent: true });
  store.get().persisted.bm.push(4);
  const navigator = createNavigator({ store, router: { navigate: path => log.push(`navigate ${path}`) }, scrollToTop: () => log.push("scroll") });
  navigator.navigate("/bookings");
  assert.deepEqual(store.get().runtime.toast, { message: "", error: "" });
  assert.deepEqual(store.get().runtime.availability, {});
  assert.deepEqual(JSON.parse(storage.getItem("snapia")).bm, [4]);
  assert.deepEqual(log, ["scroll", "navigate /bookings"]);
});
