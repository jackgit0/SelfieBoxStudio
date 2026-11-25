// Dialog bersama (Figma "Konfirmasi …" dan popup galat), dulu modal() di core.js.
// renderModal() murni (dites di tests/components/modal.test.js); openModal() bagian DOM-nya: Promise, fokus terkunci di dalam dialog,
// Escape dan klik di luar menutup, fokus kembali ke elemen pembuka.
import { html } from "../core/html.js";
import { icon } from "./icon.js";

// elemen yang bisa difokus di dalam dialog (kunci Tab berputar di antaranya)
const FOCUSABLE = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]";

// options = { title, body, buttons, kicker, className }
// body dan kicker: Safe (html`…`/raw) dipasang apa adanya, teks biasa di-escape;
// buttons = [{ label, value, style ("ghost"/"soft"/"danger"), icon }]
export function renderModal({ title, body = "", buttons = [{ label: "Tutup", value: null }], kicker = "", className = "" }) {
  const buttonMarkup = buttons.map((button, index) => html`<button class="btn sm ${button.style || ""}" data-i="${index}">${button.icon ? icon(button.icon, 16) : ""}${button.label}</button>`);
  return html`<div class="mbox ${className}" role="dialog" aria-modal="true" aria-labelledby="mdl-t">${kicker}<h3 id="mdl-t">${title}</h3><div class="mtx">${body}</div><div class="row mbtn">${buttonMarkup}</div></div>`;
}

// fokus awal: tombol aksi pertama (bukan tombol di dalam isi, mis. daftar paket), kecuali initialFocus menunjuk elemen lain (mis. isian PIN)
export function focusTarget(options = {}) {
  return options.initialFocus || ".mbtn button";
}

// ikon bulat di atas judul popup galat; variant = kelas warna ("no" merah, "blue")
export function modalIcon(name, variant = "no") {
  return html`<div class="mico ${variant}">${icon(name, 28)}</div>`;
}

// elemen yang menerima fokus lagi setelah dialog ditutup: pembukanya, atau options.returnFocus (selector) bila pembuka ikut tersembunyi
export function returnFocusTarget(opener, options, documentRef) {
  const replacement = options.returnFocus ? documentRef.querySelector(options.returnFocus) : null;
  return replacement || opener;
}

// Membuka dialog; resolve dengan value tombol yang ditekan, null bila ditutup (Escape / klik di luar).
// Tombol di dalam body dengan data-v="…" juga menutup dialog dan resolve dengan string itu.
// Opsi tambahan: enterValue = Enter di sebuah isian menutup dialog dengan nilai ini;
// read(box) = dibaca tepat sebelum dialog ditutup, lalu Promise resolve dengan { value, data } (mis. isi PIN);
// initialFocus = selector fokus awal; returnFocus = selector fokus setelah ditutup (lihat returnFocusTarget).
export function openModal(options) {
  const { buttons = [{ label: "Tutup", value: null }], enterValue, read } = options;
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    const opener = document.activeElement;
    overlay.className = "mdl";
    overlay.innerHTML = String(renderModal({ ...options, buttons }));
    const box = overlay.firstElementChild;

    function close(value) {
      const data = read ? read(box) : undefined;
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      const back = returnFocusTarget(opener, options, document);
      if (back && back.focus && document.contains(back)) {
        back.focus();
      }
      resolve(read ? { value, data } : value);
    }

    function onKey(event) {
      if (event.key === "Escape") {
        close(null);
        return;
      }
      if (event.key === "Enter" && enterValue !== undefined && event.target && event.target.tagName === "INPUT" && box.contains(event.target)) {
        event.preventDefault();
        close(enterValue);
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        const focusable = [...box.querySelectorAll(FOCUSABLE)];
        const index = focusable.indexOf(document.activeElement);
        const step = event.shiftKey ? focusable.length - 1 : 1;
        focusable[(index + step) % focusable.length].focus();
      }
    }

    overlay.addEventListener("click", event => {
      const button = event.target.closest("button[data-i], button[data-v]");
      if (button) {
        close(button.dataset.i !== undefined ? buttons[button.dataset.i].value : button.dataset.v);
      } else if (event.target === overlay) {
        close(null);
      }
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    const first = box.querySelector(focusTarget(options));
    if (first) {
      first.focus();
    }
  });
}
