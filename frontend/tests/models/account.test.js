import { test } from "node:test";
import assert from "node:assert/strict";
import * as account from "../../js/models/account.js";
import * as auth from "../../js/models/auth.js";
import { createFakeApi } from "../helpers/fakeApi.js";

test("updateProfile: PATCH /me dengan name dan phone", async () => {
  const api = createFakeApi({ "PATCH /me": { body: { id: 5, name: "Dewi", email: "d@x.id", phone: "0812345678" } } });
  const answer = await account.updateProfile(api, { name: "Dewi", phone: "0812345678" });
  assert.deepEqual(api.calls, [{ method: "PATCH", path: "/me", body: { name: "Dewi", phone: "0812345678" } }]);
  assert.equal(answer.name, "Dewi");
});

test("paymentHistory: hanya pembayaran yang pernah terjadi (bukan pending/batal), terbaru dulu", () => {
  const bookings = [
    { id: 1, pay_status: "paid", paid_at: 100 },
    { id: 2, pay_status: "pending", paid_at: null },
    { id: 3, pay_status: "refunded", paid_at: 300 },
    { id: 4, pay_status: "batal", paid_at: null },
    { id: 5, pay_status: "refund_failed", paid_at: 200 },
    { id: 6, pay_status: null },
  ];
  assert.deepEqual(account.paymentHistory(bookings).map(item => item.id), [3, 5, 1]);
  assert.deepEqual(bookings.map(item => item.id), [1, 2, 3, 4, 5, 6]);
});

test("auth.forgot: POST /auth/forgot dengan email", async () => {
  const api = createFakeApi({ "POST /auth/forgot": { body: { message: "Jika email terdaftar…" } } });
  assert.equal((await auth.forgot(api, "d@x.id")).message, "Jika email terdaftar…");
  assert.deepEqual(api.calls, [{ method: "POST", path: "/auth/forgot", body: { email: "d@x.id" } }]);
});
