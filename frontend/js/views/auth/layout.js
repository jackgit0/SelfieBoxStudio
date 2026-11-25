// Kartu form masuk bersama (dulu wrap() di V.auth, core.js): tombol kembali, merek, toast, catatan draf booking, lalu isi form.
// Datang dari popup Belum Login (Figma 585:4400): "Masuk untuk melanjutkan booking", dan "Kembali ke booking" bila sesi dan rincian harga masih ada.
import { html } from "../../core/html.js";
import { BRAND } from "../../config.js";
import { icon } from "../../components/icon.js";
import { renderToasts } from "../../components/toast.js";

// mode = login | register | forgot | reset
export function authCard(state, mode, content) {
  const { persisted, booking, runtime } = state;
  const draft = Boolean(persisted.draft) && ["login", "register"].includes(mode);
  const back = draft && booking.slot && booking.quote;
  const note = draft
    ? html`<h2 class="h3">Masuk untuk melanjutkan booking</h2>
        <div class="mnote" style="margin:8px 0 14px">
          ${icon("info", 16)} Kamu belum login. Silakan masuk terlebih dahulu untuk membooking sesi.
        </div>`
    : "";
  return html`<div class="authcard">
    <button class="back" data-route="${back ? "/book/pay" : "/"}">
      ${icon("left", 16)} ${back ? "Kembali ke booking" : "Beranda"}
    </button>
    <div class="brand">${BRAND}</div>
    <p class="sub center" style="margin-bottom:14px">Sesi foto self-service, tinggal pilih dan datang.</p>
    ${renderToasts(runtime.toast)}${note}${content}
  </div>`;
}

// tab Masuk / Daftar
export function authTabs(mode) {
  return html`<div class="seg">
    ${[
      ["login", "Masuk", "/login"],
      ["register", "Daftar", "/register"],
    ].map(
      ([tab, label, path]) => html`<button class="${mode === tab ? "on" : ""}" data-route="${path}">${label}</button>`,
    )}
  </div>`;
}

// isian yang diketik sebelum galat (bukan password), hanya untuk form yang sama (AuthController, decisions.md 54)
export function typedValue(state, mode, name) {
  const form = state.runtime.auth.form;
  return form && form.mode === mode ? form.values[name] || "" : "";
}
