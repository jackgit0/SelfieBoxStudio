import { test } from "node:test";
import assert from "node:assert/strict";
import * as photoSession from "../../js/models/photoSession.js";
import { createFakeApi } from "../helpers/fakeApi.js";

test("listMine: GET /sessions, foto tanpa img mendapat URL gambar dari api (dulu fixS)", async () => {
  const api = createFakeApi({ "GET /sessions": { body: [{ id: 4, photos: [{ id: 10, img: "" }, { id: 11, img: "/media/11.jpg" }] }, { id: 5, photos: [] }] } });
  api.imageUrl = id => `/api/photos/${id}/img?t=tok`;
  const sessions = await photoSession.listMine(api);
  assert.deepEqual(api.calls, [{ method: "GET", path: "/sessions", body: undefined }]);
  assert.deepEqual(sessions[0].photos.map(photo => photo.img), ["/api/photos/10/img?t=tok", "/media/11.jpg"]);
  assert.deepEqual(sessions[1].photos, []);
});

test("start, sync, shoot, markDrive, staffAction: endpoint sesi foto", async () => {
  const api = createFakeApi({
    "POST /bookings/7/start": { body: { id: 41 } },
    "GET /sessions/41": { body: { id: 41, left: 300, paused: false, status: "Aktif" } },
    "POST /sessions/41/photos": { body: { id: 90, t: 1000 } },
    "PATCH /photos/90": { body: { ok: true } },
    "POST /sessions/41/control": { body: { left: 299, paused: true, status: "Aktif" } },
  });
  assert.deepEqual(await photoSession.start(api, 7), { id: 41 });
  assert.equal((await photoSession.sync(api, 41)).left, 300);
  assert.deepEqual(await photoSession.shoot(api, 41, "data:image/jpeg;base64,AA"), { id: 90, t: 1000 });
  await photoSession.markDrive(api, 90, "lokal");
  assert.equal((await photoSession.staffAction(api, 41, "pause")).paused, true);
  assert.deepEqual(api.calls.map(call => [call.method, call.path, call.body]), [
    ["POST", "/bookings/7/start", {}],
    ["GET", "/sessions/41", undefined],
    ["POST", "/sessions/41/photos", { img: "data:image/jpeg;base64,AA" }],
    ["PATCH", "/photos/90", { drive: "lokal" }],
    ["POST", "/sessions/41/control", { action: "pause" }],
  ]);
});

test("activeSession: sesi Aktif terakhir milik user; photoLimit = 2 × kuota paket", () => {
  const sessions = [{ id: 1, user_id: 5, status: "Aktif" }, { id: 2, user_id: 6, status: "Aktif" }, { id: 3, user_id: 5, status: "Aktif" }, { id: 4, user_id: 5, status: "Selesai" }];
  assert.equal(photoSession.activeSession(sessions, 5).id, 3);
  assert.equal(photoSession.activeSession(sessions, 9), undefined);
  assert.equal(photoSession.photoLimit({ photo_count: 3 }), 6);
});

test("shownSession: sesi yang sedang dibuka (photo.session), selain itu sesi aktif user", () => {
  const sessions = [{ id: 1, user_id: 5, status: "Selesai" }, { id: 3, user_id: 5, status: "Aktif" }];
  assert.equal(photoSession.shownSession(sessions, 5, 1).id, 1);
  assert.equal(photoSession.shownSession(sessions, 5, null).id, 3);
  assert.equal(photoSession.shownSession([], 5, null), undefined);
});
