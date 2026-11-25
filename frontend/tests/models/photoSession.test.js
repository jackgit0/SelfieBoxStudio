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

test("sessionOfBooking: sesi foto milik booking (status di Detail Booking), null bila belum ada", () => {
  const sessions = [{ id: 1, booking_id: 7 }, { id: 2, booking_id: 9 }];
  assert.equal(photoSession.sessionOfBooking(sessions, 9).id, 2);
  assert.equal(photoSession.sessionOfBooking(sessions, "7").id, 1);
  assert.equal(photoSession.sessionOfBooking(sessions, 3), null);
});

test("pelanggan tidak lagi memulai sesi, mengambil foto, atau memakai Kendali Staf (sesi dijalankan admin dari tablet studio)", () => {
  for (const name of ["start", "sync", "shoot", "markDrive", "staffAction", "activeSession", "shownSession", "photoLimit"]) assert.equal(photoSession[name], undefined, name);
});
