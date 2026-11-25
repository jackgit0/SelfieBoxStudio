import { test } from "node:test";
import assert from "node:assert/strict";
import * as payment from "../../js/models/payment.js";
import { createFakeApi } from "../helpers/fakeApi.js";

test("pay: POST /bookings/:id/pay dengan metode; emailInvoice: POST /bookings/:id/invoice/email", async () => {
  const api = createFakeApi({ "POST /bookings/12/pay": { body: { status: "Terbayar" } }, "POST /bookings/12/invoice/email": { body: { dev: true } } });
  assert.deepEqual(await payment.pay(api, 12, "Transfer Bank"), { status: "Terbayar" });
  assert.deepEqual(await payment.emailInvoice(api, 12), { dev: true });
  assert.deepEqual(api.calls, [
    { method: "POST", path: "/bookings/12/pay", body: { method: "Transfer Bank" } },
    { method: "POST", path: "/bookings/12/invoice/email", body: {} },
  ]);
});
