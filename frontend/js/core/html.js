// Template HTML yang otomatis meng-escape: setiap nilai di dalam html`…` di-escape kecuali sudah berupa Safe.
// Dipakai semua view; jangan menyusun HTML dengan template literal biasa atau "+".

// HTML yang sudah aman (hasil html`…` atau raw()); toString() mengembalikan markup-nya
export class Safe {
  constructor(markup) {
    this.markup = markup;
  }

  toString() {
    return this.markup;
  }
}

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// teks → HTML aman; null/undefined menjadi kosong (sama dengan esc() lama)
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ENTITIES[character]);
}

// markup tepercaya milik kode sendiri (mis. SVG ikon); jangan untuk data dari server atau pengguna
export function raw(markup) {
  return new Safe(String(markup ?? ""));
}

function renderValue(value) {
  if (value instanceof Safe) {
    return value.markup;
  }
  if (Array.isArray(value)) {
    return value.map(renderValue).join("");
  }
  if (value === null || value === undefined || value === false) {
    return "";
  }
  if (typeof value === "number") {
    return String(value);
  }
  return esc(value);
}

export function html(strings, ...values) {
  let markup = strings[0];
  values.forEach((value, index) => {
    markup += renderValue(value) + strings[index + 1];
  });
  return new Safe(markup);
}
