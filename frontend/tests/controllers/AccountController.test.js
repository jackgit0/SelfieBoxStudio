import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../js/core/store.js";
import { createAccountController } from "../../js/controllers/AccountController.js";
import * as accountModel from "../../js/models/account.js";
import * as authModel from "../../js/models/auth.js";
import { createFakeApi } from "../helpers/fakeApi.js";
import { createFakeStorage } from "../helpers/fakeStorage.js";
import { sampleState } from "../helpers/fixtures.js";

function setup(responses = {}) {
  const storage = createFakeStorage();
  const store = createStore(sampleState({ persisted: { me: 5, user: { id: 5, name: "Dewi", email: "d@x.id", phone: "0812345678" } }, runtime: { toast: { message: "lama", error: "lama" } } }), { storage, persistKey: "snapia" });
  const api = createFakeApi(responses);
  const log = [];
  store.subscribe(() => log.push("render"));
  const controller = createAccountController({ api, store, models: { account: accountModel, auth: authModel } });
  return { store, api, log, storage, controller };
}

test("saveProfile: PATCH /me, persisted.user diperbarui dan disimpan, toast Profil disimpan., satu render", async () => {
  const { store, api, log, storage, controller } = setup({ "PATCH /me": { body: { id: 5, name: "Dewi Baru", email: "d@x.id", phone: "0899999999" } } });
  await controller.saveProfile({ name: "Dewi Baru", phone: "0899999999" });
  assert.deepEqual(api.calls, [{ method: "PATCH", path: "/me", body: { name: "Dewi Baru", phone: "0899999999" } }]);
  assert.deepEqual(store.get().persisted.user, { id: 5, name: "Dewi Baru", email: "d@x.id", phone: "0899999999" });
  assert.equal(JSON.parse(storage.getItem("snapia")).user.name, "Dewi Baru");
  assert.deepEqual(store.get().runtime.toast, { message: "Profil disimpan.", error: "" });
  assert.deepEqual(log, ["render"]);
});

test("saveProfile: galat server → toast galat, user tidak berubah", async () => {
  const { store, controller } = setup({ "PATCH /me": { status: 400, body: { error: "Nama wajib diisi dan telepon 8-15 digit" } } });
  await controller.saveProfile({ name: "", phone: "1" });
  assert.deepEqual(store.get().runtime.toast, { message: "", error: "Nama wajib diisi dan telepon 8-15 digit" });
  assert.equal(store.get().persisted.user.name, "Dewi");
});

test("requestPasswordChange: POST /auth/forgot dengan email user, toast tautan dikirim", async () => {
  const { store, api, controller } = setup({ "POST /auth/forgot": { body: { message: "ok" } } });
  await controller.requestPasswordChange();
  assert.deepEqual(api.calls, [{ method: "POST", path: "/auth/forgot", body: { email: "d@x.id" } }]);
  assert.deepEqual(store.get().runtime.toast, { message: "Tautan untuk mengubah sandi telah dikirim ke d@x.id", error: "" });
});

test("requestPasswordChange: galat → toast galat", async () => {
  const { store, controller } = setup({ "POST /auth/forgot": { status: 429, body: { error: "Terlalu banyak permintaan" } } });
  await controller.requestPasswordChange();
  assert.equal(store.get().runtime.toast.error, "Terlalu banyak permintaan");
});
