// Hubungi Customer Service (dulu csContact() di core.js): WhatsApp bila nomornya diatur, selain itu email,
// selain itu modal berisi petunjuk (dulu dialog bawaan browser, decisions.md 4, 27, 45).
// config = { wa, email } dari config.js; ui = { modal, openUrl } milik controller.
import { html } from "../core/html.js";

export function contactCustomerService(config, ui) {
  if (config.wa) {
    ui.openUrl("https://wa.me/" + config.wa, { newTab: true });
    return;
  }
  if (config.email) {
    ui.openUrl("mailto:" + config.email, { newTab: false });
    return;
  }
  ui.modal({ title: "Hubungi Customer Service", body: html`<p>Silakan hubungi staf di studio atau kontak Customer Service Anda. (Atur nomor di frontend/js/config.js)</p>` });
}
