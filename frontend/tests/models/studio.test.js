import { test } from "node:test";
import assert from "node:assert/strict";
import { availability, availabilityKey, freeHours, toggleBookmark } from "../../js/models/studio.js";
import { createFakeApi } from "../helpers/fakeApi.js";

// 25 Nov 2026 pukul 13.20 waktu lokal
const now = new Date(2026, 10, 25, 13, 20);

test("availabilityKey: studio dan tanggal digabung dengan |", () => {
  assert.equal(availabilityKey(4, "2026-11-25"), "4|2026-11-25");
});

test("freeHours tanpa cache, hari ini: hanya jam setelah jam sekarang", () => {
  assert.deepEqual(freeHours({}, 1, "2026-11-25", now), [14, 15, 16, 17, 18, 19, 20]);
});

test("freeHours tanpa cache, tanggal mendatang: semua jam sesi", () => {
  assert.deepEqual(freeHours({}, 1, "2026-11-26", now), [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
});

test("freeHours tanpa cache, tanggal lampau: tidak ada jam", () => {
  assert.deepEqual(freeHours({}, 1, "2026-11-24", new Date(2026, 10, 25, 21, 0)), []);
});

test("freeHours: nilai cache menang, termasuk daftar kosong dari server", () => {
  assert.deepEqual(freeHours({ "1|2026-11-26": [9, 10] }, 1, "2026-11-26", now), [9, 10]);
  assert.deepEqual(freeHours({ "1|2026-11-26": [] }, 1, "2026-11-26", now), []);
  assert.deepEqual(freeHours({ "2|2026-11-26": [9] }, 1, "2026-11-26", now), [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
});

test("availability: GET /availability, mengembalikan daftar jam kosong", async () => {
  const api = createFakeApi({ "GET /availability?studio_id=3&date=2026-11-26": { body: { free: [9, 12] } } });
  assert.deepEqual(await availability(api, 3, "2026-11-26"), [9, 12]);
  assert.equal(api.calls.length, 1);
});

test("availability: 400 (mis. studio tidak tersedia) = tidak ada slot", async () => {
  const api = createFakeApi({ "GET /availability?studio_id=3&date=2026-11-26": { status: 400, body: { error: "Studio tidak tersedia" } } });
  assert.deepEqual(await availability(api, 3, "2026-11-26"), []);
});

test("availability: galat lain diteruskan ke pemanggil", async () => {
  const api = createFakeApi({ "GET /availability?studio_id=3&date=2026-11-26": { status: 500, body: { error: "Rusak" } } });
  await assert.rejects(() => availability(api, 3, "2026-11-26"), error => error.status === 500);
});

test("toggleBookmark: menambah atau menghapus id, daftar asli tidak diubah", () => {
  const list = [2];
  assert.deepEqual(toggleBookmark(list, 5), [2, 5]);
  assert.deepEqual(toggleBookmark(list, 2), []);
  assert.deepEqual(list, [2]);
  assert.deepEqual(toggleBookmark(undefined, 1), [1]);
});
