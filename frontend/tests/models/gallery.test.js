import { test } from "node:test";
import assert from "node:assert/strict";
import * as gallery from "../../js/models/gallery.js";
import { createFakeApi } from "../helpers/fakeApi.js";

test("panggilan galeri: pilih, favorit, hapus, hapus massal, konfirmasi", async () => {
  const api = createFakeApi({
    "PATCH /photos/9": { body: { ok: true } },
    "DELETE /photos/9": { body: { ok: true } },
    "POST /photos/bulk-delete": { body: { deleted: 2, skipped_favorites: 1 } },
    "POST /sessions/41/confirm": { body: { ok: true } },
  });
  await gallery.setSelected(api, 9, true);
  await gallery.setFavourite(api, 9, false);
  await gallery.remove(api, 9);
  assert.deepEqual(await gallery.removeMany(api, [9, 10]), { deleted: 2, skipped_favorites: 1 });
  await gallery.confirmSelection(api, 41);
  assert.deepEqual(api.calls.map(call => [call.method, call.path, call.body]), [
    ["PATCH", "/photos/9", { sel: true }],
    ["PATCH", "/photos/9", { fav: false }],
    ["DELETE", "/photos/9", undefined],
    ["POST", "/photos/bulk-delete", { ids: [9, 10] }],
    ["POST", "/sessions/41/confirm", {}],
  ]);
});

test("groupSimilar: foto yang diambil < 20 detik dari foto sebelumnya satu kelompok", () => {
  const photos = [{ id: 1, t: 0 }, { id: 2, t: 19999 }, { id: 3, t: 45000 }, { id: 4, t: 50000 }, { id: 5, t: 90000 }];
  assert.deepEqual(gallery.groupSimilar(photos).map(group => group.map(photo => photo.id)), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(gallery.groupSimilar([]), []);
});

test("downloadUrl: URL gambar dengan dl=1", () => {
  assert.equal(gallery.downloadUrl({ imageUrl: id => `/api/photos/${id}/img?t=tok` }, 9), "/api/photos/9/img?t=tok&dl=1");
});
