import { test } from "node:test";
import assert from "node:assert/strict";
import { sendMessage } from "../../js/models/contact.js";
import { createFakeApi } from "../helpers/fakeApi.js";

test("sendMessage: POST /contact { name, email, message }, jawaban server apa adanya", async () => {
  const api = createFakeApi({ "POST /contact": { body: { message: "Terima kasih!" } } });
  assert.deepEqual(await sendMessage(api, { name: "Ana", email: "a@x.id", message: "Halo" }), { message: "Terima kasih!" });
  assert.deepEqual(api.calls, [{ method: "POST", path: "/contact", body: { name: "Ana", email: "a@x.id", message: "Halo" } }]);
});
