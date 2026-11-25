import { test } from "node:test";
import assert from "node:assert/strict";
import { uploadImage } from "../../../js/models/admin/uploads.js";
import { createFakeApi } from "../../helpers/fakeApi.js";

test("uploadImage: POST /admin/media dengan data URL, mengembalikan url dari server", async () => {
  const api = createFakeApi({ "POST /admin/media": { body: { url: "/media/abc.jpg" } } });
  assert.equal(await uploadImage(api, "data:image/jpeg;base64,AAAA"), "/media/abc.jpg");
  assert.deepEqual(api.calls, [{ method: "POST", path: "/admin/media", body: { data: "data:image/jpeg;base64,AAAA" } }]);
});
