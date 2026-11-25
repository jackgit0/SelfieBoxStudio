import { test } from "node:test";
import assert from "node:assert/strict";
import * as live from "../../../js/models/admin/liveSession.js";
import { createFakeApi } from "../../helpers/fakeApi.js";
import { sampleMaster } from "../../helpers/fixtures.js";

test("endpoint tablet studio dan check-in", async () => {
  const api = createFakeApi({
    "GET /admin/studios/1/live": { body: { state: "idle" } },
    "POST /admin/bookings/7/checkin": { body: { id: 7, checked_in_at: 1 } },
    "POST /admin/bookings/7/start": { body: { id: 41, status: "Aktif" } },
    "GET /admin/photo-sessions/41": { body: { id: 41, left: 300 } },
    "POST /admin/photo-sessions/41/photos": { body: { id: 90, t: 1000 } },
    "DELETE /admin/photos/90": { body: { ok: true } },
    "POST /admin/photo-sessions/41/end": { body: { status: "Selesai" } },
    "POST /admin/verify-password": { body: { ok: true } },
  });
  assert.equal((await live.loadLive(api, 1)).state, "idle");
  assert.equal((await live.checkIn(api, 7)).checked_in_at, 1);
  assert.equal((await live.startSession(api, 7)).id, 41);
  assert.equal((await live.syncSession(api, 41)).left, 300);
  assert.deepEqual(await live.shoot(api, 41, "data:image/jpeg;base64,AA"), { id: 90, t: 1000 });
  await live.deletePhoto(api, 90);
  assert.equal((await live.endSession(api, 41, "rahasia")).status, "Selesai");
  assert.ok((await live.verifyPassword(api, "rahasia")).ok);
  assert.deepEqual(api.calls.map(call => [call.method, call.path, call.body]), [
    ["GET", "/admin/studios/1/live", undefined],
    ["POST", "/admin/bookings/7/checkin", {}],
    ["POST", "/admin/bookings/7/start", {}],
    ["GET", "/admin/photo-sessions/41", undefined],
    ["POST", "/admin/photo-sessions/41/photos", { img: "data:image/jpeg;base64,AA" }],
    ["DELETE", "/admin/photos/90", undefined],
    ["POST", "/admin/photo-sessions/41/end", { password: "rahasia" }],
    ["POST", "/admin/verify-password", { password: "rahasia" }],
  ]);
});

test("photoLimit = 2 × kuota paket; timer foto 3/5 detik (Figma)", () => {
  assert.equal(live.photoLimit({ photo_count: 4 }), 8);
  assert.deepEqual(live.SELF_TIMERS, [3, 5]);
});

test("backgroundsOf: properti kategori/tipe Background; backgroundFill: warna pertama, null tanpa warna", () => {
  const master = sampleMaster({ properties: [{ id: 1, category: "Background", bg: "#c33,#a22" }, { id: 2, category: "Topi" }, { id: 3, type: "background", img: "/media/x.jpg" }] });
  assert.deepEqual(live.backgroundsOf(master).map(item => item.id), [1, 3]);
  assert.equal(live.backgroundFill(master.properties[0]), "#c33");
  assert.equal(live.backgroundFill(master.properties[2]), null);
  assert.equal(live.backgroundFill(null), null);
});
