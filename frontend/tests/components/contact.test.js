import { test } from "node:test";
import assert from "node:assert/strict";
import { contactCustomerService } from "../../js/components/contact.js";
import { createFakeUi } from "../helpers/fakeUi.js";

function uiWithLinks() {
  const ui = createFakeUi();
  ui.opened = [];
  ui.openUrl = (url, options) => ui.opened.push([url, options]);
  return ui;
}

test("nomor WhatsApp diatur: wa.me di tab baru", () => {
  const ui = uiWithLinks();
  contactCustomerService({ wa: "628123", email: "cs@x.id" }, ui);
  assert.deepEqual(ui.opened, [["https://wa.me/628123", { newTab: true }]]);
  assert.equal(ui.modals.length, 0);
});

test("hanya email: mailto di tab ini", () => {
  const ui = uiWithLinks();
  contactCustomerService({ wa: "", email: "cs@x.id" }, ui);
  assert.deepEqual(ui.opened, [["mailto:cs@x.id", { newTab: false }]]);
});

test("tanpa kontak: modal \"Hubungi Customer Service\" dengan satu tombol Tutup", () => {
  const ui = uiWithLinks();
  contactCustomerService({ wa: "", email: "" }, ui);
  assert.equal(ui.opened.length, 0);
  assert.equal(ui.modals.length, 1);
  assert.equal(ui.modals[0].title, "Hubungi Customer Service");
  assert.match(String(ui.modals[0].body), /Silakan hubungi staf di studio atau kontak Customer Service Anda/);
  assert.equal(ui.modals[0].buttons, undefined);
});
