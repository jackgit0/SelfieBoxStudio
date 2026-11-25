import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../../js/models/api.js";
import { createFakeStorage } from "../helpers/fakeStorage.js";

// fetch palsu: mencatat permintaan dan menjawab dengan status + body JSON (body null = bukan JSON)
function fakeFetch(status = 200, body = {}) {
  const requests = [];
  const fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (body === null) throw new SyntaxError("bukan JSON");
        return body;
      },
    };
  };
  return { fetch, requests };
}

test("tanpa token: hanya Content-Type, URL = base + /api + path", async () => {
  const { fetch, requests } = fakeFetch(200, { ok: 1 });
  const api = createApi({ base: "https://be.example", fetch, storage: createFakeStorage() });
  assert.deepEqual(await api.get("/master"), { ok: 1 });
  assert.equal(requests[0].url, "https://be.example/api/master");
  assert.equal(requests[0].options.method, "GET");
  assert.deepEqual(requests[0].options.headers, { "Content-Type": "application/json" });
  assert.equal(requests[0].options.body, undefined);
});

test("token dibaca dari storage snapia_t dan dikirim sebagai Bearer; token staf sebagai X-Staff-Token", async () => {
  const { fetch, requests } = fakeFetch();
  const api = createApi({ base: "", fetch, storage: createFakeStorage({ snapia_t: "jwt1" }) });
  assert.equal(api.token, "jwt1");
  api.staffToken = "staf9";
  await api.post("/sessions/1/control", { action: "pause" });
  assert.equal(requests[0].url, "/api/sessions/1/control");
  assert.deepEqual(requests[0].options.headers, { "Content-Type": "application/json", Authorization: "Bearer jwt1", "X-Staff-Token": "staf9" });
  assert.equal(requests[0].options.body, JSON.stringify({ action: "pause" }));
});

test("mengisi dan mengosongkan token menulis ke storage", () => {
  const storage = createFakeStorage();
  const api = createApi({ fetch: fakeFetch().fetch, storage });
  api.token = "baru";
  assert.equal(storage.getItem("snapia_t"), "baru");
  assert.equal(api.token, "baru");
  api.token = "";
  assert.equal(storage.getItem("snapia_t"), null);
  assert.equal(api.token, "");
});

test("post tanpa body mengirim {}; put/patch/del memakai metode yang benar", async () => {
  const { fetch, requests } = fakeFetch();
  const api = createApi({ fetch, storage: createFakeStorage() });
  await api.post("/bookings/1/pay");
  await api.put("/me", { name: "A" });
  await api.patch("/photos/2", { fav: true });
  await api.del("/photos/2");
  await api.request("PATCH", "/admin/bookings/3", { status: "Selesai" });
  assert.deepEqual(requests.map(request => [request.options.method, request.options.body]), [
    ["POST", "{}"],
    ["PUT", '{"name":"A"}'],
    ["PATCH", '{"fav":true}'],
    ["DELETE", undefined],
    ["PATCH", '{"status":"Selesai"}'],
  ]);
});

test("respons bukan 2xx melempar Error dengan message, status, data", async () => {
  const { fetch } = fakeFetch(409, { error: "Jadwal sudah tidak tersedia", needs_confirm: true });
  const api = createApi({ fetch, storage: createFakeStorage() });
  await assert.rejects(api.post("/bookings", {}), error => {
    assert.equal(error.message, "Jadwal sudah tidak tersedia");
    assert.equal(error.status, 409);
    assert.deepEqual(error.data, { error: "Jadwal sudah tidak tersedia", needs_confirm: true });
    return true;
  });
});

test("galat tanpa body JSON memakai pesan bawaan", async () => {
  const api = createApi({ fetch: fakeFetch(500, null).fetch, storage: createFakeStorage() });
  await assert.rejects(api.get("/x"), error => error.message === "Terjadi kesalahan" && error.status === 500 && JSON.stringify(error.data) === "{}");
});

test("respons 2xx tanpa JSON mengembalikan {}", async () => {
  const api = createApi({ fetch: fakeFetch(200, null).fetch, storage: createFakeStorage() });
  assert.deepEqual(await api.get("/x"), {});
});

test("invoiceUrl dan imageUrl menyertakan token", () => {
  const api = createApi({ base: "https://be.example", fetch: fakeFetch().fetch, storage: createFakeStorage({ snapia_t: "abc" }) });
  assert.equal(api.invoiceUrl(12), "https://be.example/api/bookings/12/invoice?t=abc");
  assert.equal(api.invoiceUrl(12, 1), "https://be.example/api/bookings/12/invoice?t=abc&dl=1");
  assert.equal(api.imageUrl(5), "https://be.example/api/photos/5/image?t=abc");
});

test("storage yang melempar galat: token tetap di memori", () => {
  const storage = { getItem() { throw new Error("diblokir"); }, setItem() { throw new Error("diblokir"); }, removeItem() { throw new Error("diblokir"); } };
  const api = createApi({ fetch: fakeFetch().fetch, storage });
  assert.equal(api.token, "");
  api.token = "x";
  assert.equal(api.token, "x");
});
