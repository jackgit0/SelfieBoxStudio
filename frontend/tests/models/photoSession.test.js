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
