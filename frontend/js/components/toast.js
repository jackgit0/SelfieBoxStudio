// Toast di atas isi halaman (dulu toasts() di core.js), dibaca dari runtime.toast = { message, error }.
import { html } from "../core/html.js";

export function renderToasts(toast = {}) {
  return html`${toast.message ? html`<div class="toast">${toast.message}</div>` : ""}${toast.error ? html`<div class="toast err">${toast.error}</div>` : ""}`;
}
